/**
 * Смоук-сценарии постраничного журнала событий (E10). Запуск:
 *
 *   node scripts/event-journal-smoke.mjs
 *
 * Проверяются без сети (детерминированно):
 *   1) движок event-journal на синтетических источниках — первая порция,
 *      последовательные порции, конец истории, пустая история, одинаковые
 *      timestamp (разрез посередине группы), новые записи между запросами,
 *      фильтрация с дозагрузкой глубже «головы», ограничение глубины,
 *      навигация «предыдущая», ошибки источника (400/401/502/тайм-аут);
 *   2) подписанный якорь event-cursor — кодирование/декодирование,
 *      отклонение подделки, чужого объекта и чужого фильтра;
 *   3) демо-источник — прохождение всего журнала (>1000 записей) по
 *      страницам всех размеров без дублей и потерь, фильтры, конец
 *      истории, детерминированность.
 *
 * Live-проверка контракта alerts/history-on-obj/ на реальном сервере
 * выполнена отдельным read-only probe-прогоном (см. отчёт E10); здесь не
 * повторяется, чтобы смоук оставался воспроизводимым без доступа к контуру.
 */

import {fetchEventJournalPage} from '../lib/account/event-journal.ts';
import {
    countDemoEventsForObject,
    getDemoEventJournalPage,
    getDemoEventsForObject,
} from '../lib/account/demo-events.ts';
import {decodeEventCursor, encodeEventCursor} from '../lib/account/event-cursor.ts';

// ——————————————————————————————————————————————————— каркас ————————

const results = [];
const test = (title, fn) => results.push({title, fn});

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

const assertEqual = (actual, expected, message) => {
    const actualText = JSON.stringify(actual);
    const expectedText = JSON.stringify(expected);
    if (actualText !== expectedText) {
        throw new Error(`${message}: ожидалось ${expectedText}, получено ${actualText}`);
    }
};

// ————————————————————————————— синтетический источник ————————

/**
 * Синтетический журнал с управляемыми свойствами. windowCalls считает
 * обращения к окнам. Записи: id `syn-<i>`, метки убывают с шагом gapMs,
 * опциональные группы одинаковых меток.
 */
const makeSyntheticSource = ({count, gapMs = 60_000, groupEvery = 0, typeOf = () => 'system'}) => {
    const windowCalls = [];
    let store = [];
    const build = () => {
        store = [];
        let t = Date.parse('2026-06-01T12:00:00Z');
        for (let index = 0; index < count; index++) {
            const ts = groupEvery > 0 && index > 0 && index % groupEvery === 0 ? store[index - 1].ts : t;
            store.push({
                id: `syn-${index}`,
                ts,
                event: {
                    id: `syn-${index}`,
                    objectId: 'synthetic',
                    occurredAt: new Date(ts).toISOString(),
                    type: typeOf(index),
                    message: `Синтетическая запись ${index}`,
                },
            });
            t = ts - gapMs;
        }
        store.sort((a, b) => b.ts - a.ts || (a.id < b.id ? -1 : 1));
    };
    build();

    const toEntry = (record) => ({event: record.event, receivedAtMs: record.ts});

    return {
        windowCalls,
        get records() {
            return store;
        },
        /** Перезаписывает хранилище (сценарий «новые записи между запросами»). */
        rebuild: build,
        windowFetch: async (fromMs, toMs) => {
            windowCalls.push([fromMs, toMs]);
            return store
                .filter((record) => record.ts >= fromMs && record.ts <= toMs)
                .map(toEntry);
        },
        headFetch: async () => ({entries: store.map(toEntry), capped: false}),
    };
};

const makeCursor = (t, skip = []) => ({t, skip});

/** Проходит журнал от первой страницы до конца, собирая id. */
const walkForward = async (source, pageSize, eventType) => {
    const seen = [];
    const pages = [];
    let cursor = null;
    let guard = 0;
    for (;;) {
        const page = await fetchEventJournalPage({
            pageSize,
            eventType,
            cursor,
            direction: cursor === null ? 'older' : 'older',
            windowFetch: source.windowFetch,
            headFetch: source.headFetch,
        });
        pages.push(page);
        seen.push(...page.events.map((event) => event.id));
        if (!page.hasMore || page.bottomCursor === null) {
            return {pages, seen, lastPage: page};
        }
        cursor = page.bottomCursor;
        if (++guard > 1000) {
            throw new Error('Проход по страницам не завершается — защита смоука');
        }
    }
};

// ——————————————————————————————————————————— тесты ————————

test('E10.1 Первая порция: 15 записей из 40, от новых к старым, есть следующая', async () => {
    const source = makeSyntheticSource({count: 40});
    const page = await fetchEventJournalPage({
        pageSize: 15,
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: source.headFetch,
    });
    assertEqual(page.events.length, 15, 'размер первой страницы');
    assertEqual(page.events[0].id, 'syn-0', 'первая запись — новейшая');
    assertEqual(page.events[14].id, 'syn-14', 'последняя запись первой страницы');
    assert(page.hasMore, 'hasMore');
    assert(page.bottomCursor !== null, 'bottomCursor');
    assertEqual(page.bottomCursor.t, source.records[14].ts, 'якорь — метка последней записи');
    assert(!page.depthLimited, 'без ограничения глубины');
});

test('E10.2 Последовательные порции до конца: 40 записей, без дублей и потерь', async () => {
    const source = makeSyntheticSource({count: 40});
    const {pages, seen, lastPage} = await walkForward(source, 15);
    assertEqual(seen.length, 40, 'суммарно записей');
    assertEqual(new Set(seen).size, 40, 'без дублей');
    for (let index = 0; index < 40; index++) {
        assertEqual(seen[index], `syn-${index}`, `позиция ${index}`);
    }
    assertEqual(pages.length, 3, 'страниц: 15+15+10');
    assertEqual(lastPage.events.length, 10, 'последняя страница неполная');
    assert(!lastPage.hasMore, 'конец истории определён');
    assert(lastPage.bottomCursor === null, 'якоря дальше нет');
});

test('E10.3 Пустая история: пустая страница, hasMore=false', async () => {
    const source = makeSyntheticSource({count: 0});
    const page = await fetchEventJournalPage({
        pageSize: 15,
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: source.headFetch,
    });
    assertEqual(page.events.length, 0, 'записей нет');
    assert(!page.hasMore, 'hasMore=false');
    assert(!page.depthLimited, 'не ограничение глубины, а пустой журнал');
});

test('E10.4 Одинаковые timestamp: разрез посередине группы без дублей и потерь', async () => {
    // Группа из 5 записей с одной меткой каждые 10 записей; pageSize режет
    // группы посередине.
    const source = makeSyntheticSource({count: 45, gapMs: 60_000, groupEvery: 10});
    const {seen} = await walkForward(source, 7);
    assertEqual(seen.length, 45, 'все записи');
    assertEqual(new Set(seen).size, 45, 'без дублей');
    // Метки по страницам не возрастают (постраничный порядок соблюдён).
    let previousTs = Number.POSITIVE_INFINITY;
    const all = source.records;
    for (const id of seen) {
        const ts = all.find((record) => record.id === id).ts;
        assert(ts <= previousTs, `порядок меток нарушен на ${id}`);
        previousTs = ts;
    }
});

test('E10.5 Новые записи между запросами: страница 2 стабильно продолжает страницу 1', async () => {
    const source = makeSyntheticSource({count: 40});
    const first = await fetchEventJournalPage({
        pageSize: 15,
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: source.headFetch,
    });
    const firstIds = first.events.map((event) => event.id);

    // Между запросами пришли новые записи (новее существующих).
    const fresh = [
        {
            id: 'syn-new-1',
            ts: source.records[0].ts + 600_000,
            event: {id: 'syn-new-1', objectId: 'synthetic', occurredAt: new Date(source.records[0].ts + 600_000).toISOString(), type: 'system', message: 'новая'},
        },
        {
            id: 'syn-new-2',
            ts: source.records[0].ts + 1_200_000,
            event: {id: 'syn-new-2', objectId: 'synthetic', occurredAt: new Date(source.records[0].ts + 1_200_000).toISOString(), type: 'system', message: 'новая'},
        },
    ];
    source.records.unshift(...fresh);

    const second = await fetchEventJournalPage({
        pageSize: 15,
        cursor: first.bottomCursor,
        direction: 'older',
        windowFetch: source.windowFetch,
    });
    const secondIds = second.events.map((event) => event.id);
    for (const id of secondIds) {
        assert(!firstIds.includes(id), `дубль на границе: ${id}`);
        assert(id.startsWith('syn-') && !id.includes('new'), `на страницу 2 попала новая запись: ${id}`);
    }
    // syn-15…syn-29 — ровно продолжение.
    for (let index = 15; index < 30; index++) {
        assertEqual(secondIds[index - 15], `syn-${index}`, 'продолжение журнала');
    }
});

test('E10.6 Фильтр по типу с дозагрузкой глубже усечённой головы', async () => {
    const source = makeSyntheticSource({
        count: 200,
        typeOf: (index) => (index % 20 === 0 ? 'security_alarm' : 'system'),
    });
    // «Голова» сервера усечена: только первые 50 записей, capped=true.
    const cappedHead = async () => ({
        entries: source.records.slice(0, 50).map((record) => ({event: record.event, receivedAtMs: record.ts})),
        capped: true,
    });
    const page = await fetchEventJournalPage({
        pageSize: 3,
        eventType: 'security_alarm',
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: cappedHead,
    });
    assertEqual(page.events.length, 3, 'страница фильтра заполнена');
    assert(page.events.every((event) => event.type === 'security_alarm'), 'все записи нужного типа');
    // Первые совпадения: индексы 0, 20, 40 — внутри головы; но порядок убывания: 0,20,40.
    assertEqual(page.events.map((event) => event.id), ['syn-0', 'syn-20', 'syn-40'], 'первые тревоги');
    assert(page.hasMore, 'фильтрованный журнал продолжается');
});

test('E10.7 Конец истории доказывается: тишина глубже покрытия — hasMore=false без «недоказанного обрыва»', async () => {
    const source = makeSyntheticSource({count: 4});
    // Голова усечена, но записей глубже нет совсем: финальная проба до
    // начала эпохи должна доказать конец журнала.
    const cappedHead = async () => ({
        entries: source.records.map((record) => ({event: record.event, receivedAtMs: record.ts})),
        capped: true,
    });
    const page = await fetchEventJournalPage({
        pageSize: 15,
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: cappedHead,
    });
    assertEqual(page.events.length, 4, 'записи головы показаны');
    assert(!page.hasMore, 'hasMore=false — следующую страницу движок не обещает');
    assert(!page.depthLimited, 'конец доказан финальной пробой, а не ограничением глубины');
    assert(source.windowCalls.some(([from]) => from === 0), 'выполнена проба до начала эпохи');
});

test('E10.7b Глубокий разреженный хвост: записи за пределами лесенки находятся и не теряются', async () => {
    // Голова усечена (только новейшая запись); совпадающая по типу запись —
    // глубже суммарного покрытия лестницы (600 дней). Проба до начала эпохи
    // обязана её найти.
    const source = makeSyntheticSource({
        count: 2,
        gapMs: 600 * 24 * 60 * 60 * 1000,
        typeOf: (index) => (index === 1 ? 'security_alarm' : 'system'),
    });
    const cappedHead = async () => ({
        entries: source.records.slice(0, 1).map((record) => ({event: record.event, receivedAtMs: record.ts})),
        capped: true,
    });
    const page = await fetchEventJournalPage({
        pageSize: 15,
        eventType: 'security_alarm',
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: cappedHead,
    });
    assertEqual(page.events.map((event) => event.id), ['syn-1'], 'запись глубже лесенки найдена пробой');
    assert(!page.hasMore, 'конец журнала после неё доказан');
});

test('E10.8 Навигация «предыдущая»: якорь над страницей воспроизводит предыдущую', async () => {
    const source = makeSyntheticSource({count: 40});
    const page1 = await fetchEventJournalPage({
        pageSize: 15,
        cursor: null,
        direction: 'older',
        windowFetch: source.windowFetch,
        headFetch: source.headFetch,
    });
    const page2 = await fetchEventJournalPage({
        pageSize: 15,
        cursor: page1.bottomCursor,
        direction: 'older',
        windowFetch: source.windowFetch,
    });
    assertEqual(page2.upperCursor.t, page1.bottomCursor.t, 'граница над страницей 2 — якорь страницы 2');

    // «Предыдущая» = выборка «newer» от того же якоря.
    const back = await fetchEventJournalPage({
        pageSize: 15,
        cursor: page2.upperCursor,
        direction: 'newer',
        windowFetch: source.windowFetch,
    });
    assertEqual(back.events.map((event) => event.id), page1.events.map((event) => event.id), 'страница 1 воспроизведена');

    // И её якорь «вперёд» совпадает с якорем между страницами.
    assertEqual(back.bottomCursor.t, page1.bottomCursor.t, 'нижняя граница страницы 1');
    assertEqual(back.bottomCursor.skip.join(','), page1.bottomCursor.skip.join(','), 'skip-список');
});

test('E10.9 Ошибки источника пробрасываются (400/401/502/тайм-аут), не маскируются', async () => {
    for (const failure of [new Error('HTTP 400'), new Error('HTTP 401'), new Error('HTTP 502'), new Error('Тайм-аут')]) {
        let threw = null;
        try {
            await fetchEventJournalPage({
                pageSize: 15,
                cursor: makeCursor(Date.parse('2026-05-01T00:00:00Z')),
                direction: 'older',
                windowFetch: async () => {
                    throw failure;
                },
            });
        } catch (error) {
            threw = error;
        }
        assert(threw === failure, `ошибка ${failure.message} должна пробрасываться`);
    }
});

test('E10.10 Некорректный якорь отклоняется (NaN-метка, отрицательная)', async () => {
    for (const bad of [{t: Number.NaN, skip: []}, {t: -5, skip: []}, {t: 4_200_000_000_000, skip: []}]) {
        let threw = null;
        try {
            await fetchEventJournalPage({
                pageSize: 15,
                cursor: bad,
                direction: 'older',
                windowFetch: async () => [],
            });
        } catch (error) {
            threw = error;
        }
        assert(threw !== null, `якорь ${JSON.stringify(bad)} должен отклоняться`);
    }
});

// —————————————————————————————— якорь (курсор) ————————

const SECRET = 'smoke-secret';

test('E10.11 Якорь: кодирование/декодирование, связанность с объектом и фильтром', async () => {
    const payload = {t: 1_792_769_812_000, skip: ['alert:123', 'action:45'], objectId: 'obj-1', eventType: '', direction: 'older'};
    const token = encodeEventCursor(payload, SECRET);
    const decoded = decodeEventCursor(token, SECRET, {objectId: 'obj-1', eventType: ''});
    assert(decoded !== null, 'якорь декодируется');
    assertEqual(decoded.t, payload.t, 'метка');
    assertEqual(decoded.skip.join(','), 'alert:123,action:45', 'skip-список');
    assertEqual(decoded.direction, 'older', 'направление');

    // Чужой объект.
    assertEqual(decodeEventCursor(token, SECRET, {objectId: 'obj-2', eventType: ''}), null, 'чужой объект отклонён');
    // Чужой фильтр.
    assertEqual(decodeEventCursor(token, SECRET, {objectId: 'obj-1', eventType: 'security_alarm'}), null, 'чужой фильтр отклонён');
    // Подделка подписи.
    assertEqual(decodeEventCursor(`${token}x`, SECRET, {objectId: 'obj-1', eventType: ''}), null, 'подделка отклонена');
    // Другой секрет.
    assertEqual(decodeEventCursor(token, 'other-secret', {objectId: 'obj-1', eventType: ''}), null, 'другой секрет отклонён');
    // Мусор.
    assertEqual(decodeEventCursor('не-якорь', SECRET, {objectId: 'obj-1', eventType: ''}), null, 'мусор отклонён');
    // Без секрета.
    assertEqual(decodeEventCursor(token, null, {objectId: 'obj-1', eventType: ''}), null, 'без секрета якорь не принимается');
});

// ——————————————————————————————————————————— демо ————————

const DEMO_OBJECT = 'demo-object-magazin-belochka';
const DEMO_PAGE_SIZES = [15, 25, 50, 100];

test('E10.12 Демо: глубокая история > 1000 записей детерминирована', async () => {
    const total = countDemoEventsForObject(DEMO_OBJECT);
    assert(total > 1000, `демо-журнал должен превышать 1000 записей, фактически ${total}`);
    const firstRun = getDemoEventsForObject(DEMO_OBJECT).map((event) => event.id).join(',');
    const secondRun = getDemoEventsForObject(DEMO_OBJECT).map((event) => event.id).join(',');
    assertEqual(firstRun, secondRun, 'два прогона идентичны');
});

for (const pageSize of DEMO_PAGE_SIZES) {
    test(`E10.13 Демо: полный проход журнала по страницам размера ${pageSize} без дублей и потерь`, async () => {
        const total = countDemoEventsForObject(DEMO_OBJECT);
        const seen = [];
        let cursor = null;
        let pages = 0;
        for (;;) {
            const page = await getDemoEventJournalPage(DEMO_OBJECT, pageSize, undefined, cursor, cursor === null ? 'older' : 'older');
            pages += 1;
            seen.push(...page.events.map((event) => event.id));
            if (!page.hasMore || page.bottomCursor === null) {
                assertEqual(page.events.length <= pageSize, true, 'последняя страница не больше размера');
                break;
            }
            assertEqual(page.events.length, pageSize, 'промежуточная страница полная');
            cursor = page.bottomCursor;
            assert(pages < 500, 'защита от бесконечного прохода');
        }
        assertEqual(seen.length, total, 'все записи журнала');
        assertEqual(new Set(seen).size, total, 'без дублей');
    });
}

test('E10.14 Демо: смена размера страницы сбрасывает позицию корректно (первые страницы совпадают по записям)', async () => {
    // Первая страница каждого размера — префикс одного и того же журнала.
    const ids15 = (await getDemoEventJournalPage(DEMO_OBJECT, 15, undefined, null, 'older')).events.map((event) => event.id);
    const ids50 = (await getDemoEventJournalPage(DEMO_OBJECT, 50, undefined, null, 'older')).events.map((event) => event.id);
    assertEqual(ids50.slice(0, 15).join(','), ids15.join(','), 'префикс журнала совпадает');
});

test('E10.15 Демо: фильтр по типу — полный проход, конец истории, без дублей', async () => {
    const type = 'security_alarm';
    const total = countDemoEventsForObject(DEMO_OBJECT, type);
    assert(total > 0, 'тревоги в демо-журнале есть');
    const seen = [];
    let cursor = null;
    for (;;) {
        const page = await getDemoEventJournalPage(DEMO_OBJECT, 15, type, cursor, cursor === null ? 'older' : 'older');
        seen.push(...page.events.map((event) => event.id));
        assert(page.events.every((event) => event.type === type), 'фильтр соблюдён');
        if (!page.hasMore || page.bottomCursor === null) {
            break;
        }
        cursor = page.bottomCursor;
        assert(seen.length < total + 100, 'защита от бесконечного прохода');
    }
    assertEqual(seen.length, total, 'все тревоги');
    assertEqual(new Set(seen).size, total, 'без дублей');
});

test('E10.16 Демо: пустой журнал («Гвоздика») и фильтр без записей', async () => {
    const empty = await getDemoEventJournalPage('demo-object-office-gvozdika', 15, undefined, null, 'older');
    assertEqual(empty.events.length, 0, 'журнал пуст');
    assert(!empty.hasMore, 'hasMore=false');
    const filtered = await getDemoEventJournalPage(DEMO_OBJECT, 15, 'fire_maintenance', null, 'older');
    assert(filtered.events.every((event) => event.type === 'fire_maintenance'), 'фильтр соблюдён');
});

// ——————————————————————————————————————————— прогон ————————

let failed = 0;
for (const {title, fn} of results) {
    try {
        await fn();
        console.log(`[OK]   ${title}`);
    } catch (error) {
        failed += 1;
        console.log(`[FAIL] ${title}`);
        console.log(`       ${error?.message ?? error}`);
    }
}

console.log('');
console.log(failed === 0 ? 'Все смоук-сценарии пройдены.' : `Провалено сценариев: ${failed}.`);
process.exitCode = failed === 0 ? 0 : 1;
