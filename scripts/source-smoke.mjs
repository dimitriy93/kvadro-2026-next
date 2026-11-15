/**
 * Смоук-сценарии источника данных кабинета (E15, этап 4, сценарии 12–13).
 * Запуск: node scripts/source-smoke.mjs
 *
 * Проверяются без сети:
 *  1) матрица parseAccountDataSource: production всегда 'georitm' —
 *     отсутствие настройки, явный 'demo' и опечатки не активируют демо;
 *     вне production 'demo' по умолчанию, 'georitm' — при явном значении;
 *  2) getAccountDataSource по фактическим переменным окружения (NODE_ENV и
 *     ACCOUNT_DATA_SOURCE подменяются и восстанавливаются);
 *  3) статические проверки единственности определения: диспетчер source.ts,
 *     маршрут входа и session.ts используют getAccountDataSource из
 *     source-config и не читают ACCOUNT_DATA_SOURCE напрямую — именно эта
 *     функция решает demo/georitm для списков объектов, карточки, зон,
 *     журнала, отчётов, управления и вида принимаемой сессии, поэтому в
 *     production demo-ветка диспетчера недостижима ни на одном пути.
 *
 * source.ts в сценарии не импортируется намеренно: модуль использует
 * расширения-less импорты (часть Next.js-сборки) и не загружается чистым
 * Node; поведение диспетчера полностью определяется проверенной функцией
 * source-config и покрывается статическими проверками (подход контрольного
 * смоука control-ui-smoke).
 */

import {readFileSync} from 'node:fs';
import {parseAccountDataSource, getAccountDataSource} from '../lib/account/source-config.ts';

const results = [];
const test = (title, fn) => results.push({title, fn});

const assert = (condition, message) => {
    if (!condition) {
        throw new Error(message);
    }
};

// ————————————— 1. Матрица parseAccountDataSource ————————

test('parseAccountDataSource: production + отсутствие настройки → georitm', () => {
    assert(parseAccountDataSource(undefined, true) === 'georitm', 'production без настройки должен давать georitm');
});

test('parseAccountDataSource: production + явный demo → georitm (demo не активируется)', () => {
    assert(parseAccountDataSource('demo', true) === 'georitm', 'явный demo в production должен игнорироваться');
});

test('parseAccountDataSource: production + явный georitm → georitm', () => {
    assert(parseAccountDataSource('georitm', true) === 'georitm', 'явный georitm в production');
});

test('parseAccountDataSource: production + опечатка/мусор → georitm', () => {
    for (const value of ['', '   ', 'DEMO', 'Demo', 'demo ', 'mock', 'test', 'real']) {
        assert(parseAccountDataSource(value, true) === 'georitm',
            `значение '${value}' в production должно давать georitm`);
    }
});

test('parseAccountDataSource: вне production + отсутствие настройки → demo', () => {
    assert(parseAccountDataSource(undefined, false) === 'demo', 'вне production без настройки — demo');
});

test('parseAccountDataSource: вне production + явный demo → demo', () => {
    assert(parseAccountDataSource('demo', false) === 'demo', 'вне production явный demo');
});

test('parseAccountDataSource: вне production + явный georitm (любой регистр/пробелы) → georitm', () => {
    for (const value of ['georitm', 'GEORITM', ' Georitm ', ' georitm\t']) {
        assert(parseAccountDataSource(value, false) === 'georitm',
            `значение '${value}' вне production должно давать georitm`);
    }
});

test('parseAccountDataSource: вне production + опечатка → demo', () => {
    for (const value of ['', 'georitm2', 'geo ritm', 'true', '1']) {
        assert(parseAccountDataSource(value, false) === 'demo',
            `значение '${value}' вне production должно давать demo`);
    }
});

// ————————————— 2. getAccountDataSource по окружению ————————

const ENV_BACKUP = {
    NODE_ENV: process.env.NODE_ENV,
    ACCOUNT_DATA_SOURCE: process.env.ACCOUNT_DATA_SOURCE,
};

const restoreEnv = () => {
    if (ENV_BACKUP.NODE_ENV === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = ENV_BACKUP.NODE_ENV;
    }
    if (ENV_BACKUP.ACCOUNT_DATA_SOURCE === undefined) {
        delete process.env.ACCOUNT_DATA_SOURCE;
    } else {
        process.env.ACCOUNT_DATA_SOURCE = ENV_BACKUP.ACCOUNT_DATA_SOURCE;
    }
};

test('getAccountDataSource: подмена NODE_ENV=production отключает demo (env-level)', () => {
    try {
        process.env.NODE_ENV = 'production';
        process.env.ACCOUNT_DATA_SOURCE = 'demo';
        assert(getAccountDataSource() === 'georitm', 'production + ACCOUNT_DATA_SOURCE=demo → georitm');

        delete process.env.ACCOUNT_DATA_SOURCE;
        assert(getAccountDataSource() === 'georitm', 'production без настройки → georitm');

        delete process.env.NODE_ENV;
        process.env.ACCOUNT_DATA_SOURCE = 'demo';
        assert(getAccountDataSource() === 'demo', 'вне production с demo — demo (среда разработки)');

        process.env.ACCOUNT_DATA_SOURCE = 'georitm';
        assert(getAccountDataSource() === 'georitm', 'вне production с georitm — georitm');
    } finally {
        restoreEnv();
    }
});

// ————— 3. Статические проверки единственности определения источника —————

const readProjectFile = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('диспетчер source.ts: собственной копии getAccountDataSource больше нет', () => {
    const source = readProjectFile('../lib/account/source.ts');
    assert(!source.includes('process.env.ACCOUNT_DATA_SOURCE'),
        'source.ts не должен читать ACCOUNT_DATA_SOURCE напрямую — только через source-config');
    assert(source.includes("from './source-config'"), 'source.ts импортирует getAccountDataSource из source-config');
});

test('маршрут входа: использует getAccountDataSource, без собственной копии', () => {
    const route = readProjectFile('../app/api/cabinet/login/route.ts');
    assert(route.includes('getAccountDataSource()'), 'маршрут входа вызывает getAccountDataSource');
    assert(!route.includes('process.env.ACCOUNT_DATA_SOURCE'),
        'маршрут входа не читает переменную окружения напрямую');
});

test('session.ts: вид принимаемой сессии определяется тем же источником source-config', () => {
    const session = readProjectFile('../lib/account/session.ts');
    assert(session.includes("from './source-config'"), 'session.ts импортирует getAccountDataSource из source-config');
    assert(!session.includes('process.env.ACCOUNT_DATA_SOURCE'), 'session.ts не читает переменную окружения напрямую');
});

test('source-config.ts: единственный модуль, читающий ACCOUNT_DATA_SOURCE', () => {
    const config = readProjectFile('../lib/account/source-config.ts');
    assert(config.includes('process.env.ACCOUNT_DATA_SOURCE'), 'source-config читает переменную окружения');
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
console.log(failed === 0
    ? 'Все смоук-сценарии источника данных пройдены. Сетевых вызовов не выполнялось.'
    : `Провалено сценариев: ${failed}.`);
process.exitCode = failed === 0 ? 0 : 1;
