/**
 * Статические проверки UI управления охраной (E13.1).
 *
 * Компонентные тесты в проекте отсутствуют (инфраструктура — только
 * Node-smoуки без зависимостей), поэтому инварианты интерфейса
 * проверяются статически по исходникам:
 *  - тексты диалога (заголовки, демо-уведомление, отсутствие опечатки);
 *  - доступность диалога (role/aria, фокус, trap, Escape, оверлей);
 *  - изоляция Safe Preview: секция рендерится при выключенном gate,
 *    демо-подтверждение заблокировано и не вызывает API;
 *  - единственные сетевые вызовы компонента — опрос partitions и
 *    маршрут control (в рабочем режиме);
 *  - маршрут control: gate-проверка выполняется до ownership-чтений
 *    GEORITM (E14) — при выключенном gate маршрут делает ноль вызовов.
 *
 * Поведенческие сценарии (клики, клавиатура, viewport 375px, темы) —
 * отчёт E13.1, раздел 10 (браузерная проверка на dev-сервере).
 */

import {readFileSync} from 'node:fs';

const read = (relative) =>
    readFileSync(new URL(relative, import.meta.url), 'utf8');

const ui = read('../app/(cabinet)/cabinet/objects/[id]/ui/object-control.ui.tsx');
const shared = read('../app/(cabinet)/cabinet/objects/[id]/ui/object-control.shared.ts');
const stateView = read('../app/(cabinet)/cabinet/objects/[id]/ui/object-state.ui.tsx');
const route = read('../app/api/cabinet/objects/[id]/control/route.ts');

const checks = [];
const check = (name, ok) => checks.push({name, ok: Boolean(ok)});

// ——— Тексты диалога (направление A) ———
check('нет опечатки «Снять с охрану»', !ui.includes('Снять с охрану'));
check('заголовок постановки «Поставить зону N под охрану?»',
    ui.includes('Поставить зону ${zoneNum} под охрану?'));
check('заголовок снятия «Снять зону N с охраны?»',
    ui.includes('Снять зону ${zoneNum} с охраны?'));
check('нейтральное имя зоны при отсутствии названия («Зона N»)',
    ui.includes('`Зона ${zoneNum}`'));
check('название/номер зоны из фактических данных (zoneLabel от partition)',
    ui.includes('zoneLabel(partition.name, partition.num)'));
check('демо-уведомление — точный текст',
    ui.includes('Демонстрационный режим. Реальная команда не отправляется. Управление охраной пока недоступно'));
check('последствия для disarm описаны',
    ui.includes('Объект останется без охранной защиты этого раздела.'));
check('последствия для arm описаны',
    ui.includes('После взятия под охрану движение в охраняемых зонах вызовет тревогу.'));
check('предупреждение рабочего режима о команде в GEORITM',
    ui.includes('Рабочий режим: подтверждение отправит команду'));
check('кнопки «Отмена» и «Подтвердить»',
    ui.includes('Подтвердить') && ui.includes('Отмена'));
check('нет фальшивого «Команда выполнена»', !ui.includes('Команда выполнена'));

// ——— Доступность диалога (направление A) ———
check('role="dialog"', ui.includes('role="dialog"'));
check('aria-modal="true"', ui.includes('aria-modal="true"'));
check('aria-labelledby', ui.includes('aria-labelledby="obj-control-modal-title"'));
check('aria-describedby', ui.includes('aria-describedby="obj-control-modal-description"'));
check('перенос фокуса в диалог при открытии', ui.includes('panelRef.current?.focus()'));
check('возврат фокуса при закрытии', ui.includes('restoreRef.current?.focus()'));
check('focus trap: Tab и Shift+Tab',
    ui.includes("event.key !== 'Tab'") && ui.includes('event.shiftKey'));
check('закрытие по Escape', ui.includes("event.key === 'Escape'"));
check('клик по оверлею закрывает, клик внутри — нет',
    ui.includes('event.target === event.currentTarget'));
check('видимый focus indicator (стили)',
    read('../app/(cabinet)/cabinet/objects/[id]/ui/object-control.styles.scss')
        .includes(':focus-visible'));
check('блокировка подтверждения при выполнении операции', ui.includes('disabled={target.demo || busy}'));
check('блокировка отмены/закрытия при выполнении операции',
    ui.includes('disabled={busy}') && ui.includes('&& !busy'));

// ——— Capability-aware preview при выключенном gate (E16) ———
// GEORITM: разделы preview строятся из capability-оценки сервера в DTO
// управления; подтверждённых разделов нет → секция не отображается вовсе
// (ни декоративных кнопок, ни технических причин). Demo-источник сохраняет
// прежний Safe Preview из DTO зон (E13.1).
check('GEORITM preview фильтрует разделы по подтверждённой доступности',
    ui.includes("partition.arm === 'available' || partition.disarm === 'available'"));
check('GEORITM preview: подтверждённых разделов нет — секция скрывается (return null)',
    /previewRows\.length === 0[\s\S]{0,800}?return null/.test(ui));
check('demo preview по-прежнему из DTO зон (проп preview используется)',
    ui.includes('preview.map((partition)') || ui.includes('preview === null'));
check('georitm preview НЕ использует DTO зон (строки из initial.partitions)',
    ui.includes('initial.partitions'));
check('isDemoData передаётся в секцию управления (object-state.ui)',
    stateView.includes('isDemoData={isDemoData}'));
check('safePreview из зон вычисляется только для demo-источника',
    /isDemoData && !zonesLoadFailed[\s\S]{0,120}deriveSafePreviewPartitions/.test(stateView)
    || /control !== null && !control\.enabled && isDemoData && !zonesLoadFailed/.test(stateView));
check('demo-подтверждение заблокировано и не вызывает операцию',
    ui.includes('disabled={target.demo || busy}') && ui.includes('onClick={target.demo ? () => undefined : onConfirm}'));
check('разграничение «Состояние неизвестно»', ui.includes('Состояние неизвестно'));
check('демо-кнопка постановки: armAction из guarded=false и arm=available',
    ui.includes("armAction: partition.guarded === false && partition.arm === 'available'"));
check('демо-кнопка снятия: disarmAction из guarded=true и disarm=available',
    ui.includes("disarmAction: partition.guarded === true && partition.disarm === 'available'"));
check('демо-источник: кнопки из guarded (E13.1 сохранён)',
    ui.includes('armAction: partition.guarded === false')
    && ui.includes('disarmAction: partition.guarded === true'));

// ——— Capability-aware отображение (E15, этап 3; скрытие секции E16) ———
// Кнопки постановки/снятия показываются только при подтверждённой сервером
// доступности ('available'): пользователь без подтверждённой возможности
// управления (canArm отсутствует/false, restricted=1, ошибка обогащения)
// не видит активных элементов — ни фиктивных кнопок, ни рабочих, а секция
// управления при отсутствии подтверждённых разделов не отображается (E16).
check('секция фильтрует разделы по подтверждённой доступности (availablePartitions)',
    ui.includes("partition.arm === 'available' || partition.disarm === 'available'"));
check('рабочий режим: подтверждённых разделов нет — секция скрывается (return null)',
    /if \(availablePartitions\.length === 0\) \{[\s\S]{0,800}?return null/.test(ui));
check('кнопка постановки только при arm === available',
    ui.includes("partition.guarded === false && partition.arm === 'available' && ("));
check('кнопка снятия только при disarm === available',
    ui.includes("partition.guarded === true && partition.disarm === 'available' && ("));

// ——— Сетевые вызовы компонента: только partitions-опрос и control-маршрут ———
const fetchCalls = [...ui.matchAll(/fetch\(`([^`]+)`/g)].map((match) => match[1]);
check('в компоненте ровно два fetch-вызова', fetchCalls.length === 2);
check('первый fetch — опрос partitions (GET)',
    fetchCalls.some((url) => url.includes('/partitions')));
check('второй fetch — маршрут control (POST, только рабочий режим)',
    fetchCalls.some((url) => url.includes('/control')));
check('нет вызовов сторонних маршрутов из секции управления',
    fetchCalls.every((url) => url.includes('/api/cabinet/objects/')));
check('маршрут control неизменён: gate-disabled → 403 и controlDisabled',
    route.includes("'gate-disabled': 403") && route.includes('controlDisabled: true'));

// ——— Маршрут: gate до ownership-чтений (E14, раздел 9 постановки) ———
// При выключенном gate маршрут не выполняет ни одного вызова GEORITM:
// ownership-чтения findObjectForUser (tree-set/obj/) выполняются только
// после gate-проверки. Статическая проверка порядка в исходнике маршрута
// (компонентных тестов маршрутов в проекте нет — тот же подход, что выше).
const routeGateIndex = route.indexOf('if (!isGeoritmControlEnabled())');
const routeOwnershipIndex = route.indexOf('findObjectForUser(user.id, id)');
check('маршрут: gate-проверка присутствует', routeGateIndex !== -1);
check('маршрут: gate-проверка до ownership-чтений findObjectForUser',
    routeGateIndex !== -1 && routeOwnershipIndex !== -1 && routeGateIndex < routeOwnershipIndex);
check('маршрут: ранний gate-ответ содержит controlDisabled',
    /if \(!isGeoritmControlEnabled\(\)\)[^]*?controlDisabled: true/.test(route));
check('маршрут: авторизация остаётся до gate (401 раньше 403)',
    route.indexOf('getSessionUser()') !== -1 && route.indexOf('getSessionUser()') < routeGateIndex);
check('маршрут: валидация тела остаётся до gate (400 раньше 403)',
    route.indexOf("action === 'arm' || action === 'disarm'") !== -1
        && route.indexOf("action === 'arm' || action === 'disarm'") < routeGateIndex);

// ——— Отчёт ———
const failed = checks.filter((entry) => !entry.ok);
for (const entry of checks) {
    console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}`);
}
console.log(`\ncontrol-ui-smoke: ${checks.length - failed.length}/${checks.length} проверок пройдено`);
if (failed.length > 0) {
    process.exit(1);
}
