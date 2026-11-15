import type {CommunicationChannel, CommunicationDiagnostics, DiagnosticsAvailability, PowerDiagnostics} from '@/lib/account';
import {formatDateTime} from '@/app/(cabinet)/cabinet/ui/format';
import './object-communication.styles.scss';

interface IObjectCommunicationProps {
    /** Диагностика каналов связи (успешный ответ источника) или null при ошибке загрузки. */
    channels: CommunicationDiagnostics | null;
    /** Диагностика питания (успешный ответ источника) или null при ошибке загрузки. */
    power: PowerDiagnostics | null;
}

/**
 * Подписи доступности данных (E9). Различают «функции нет» и «временная
 * ошибка»: ошибка загрузки показывается предупреждением с призывом
 * обновить страницу, отсутствие поддержки — нейтральным текстом без
 * роли alert, чтобы постоянное состояние не выглядело сбоем.
 */
const AVAILABILITY_MESSAGES: Record<DiagnosticsAvailability, {text: string; tone: 'neutral' | 'warn'}> = {
    available: {text: '', tone: 'neutral'},
    unsupported: {text: 'Сервер мониторинга не передаёт эти данные: метод не поддерживается установленной версией системы.', tone: 'neutral'},
    'not-provided': {text: 'Оборудование объекта не передаёт эти данные.', tone: 'neutral'},
    'no-access': {text: 'Доступ к этим данным для вашей учётной записи не предоставлен.', tone: 'neutral'},
    'device-unreachable': {text: 'Оборудование объекта сейчас недоступно — данные получить не удалось.', tone: 'warn'},
    error: {text: 'Не удалось загрузить данные. Попробуйте обновить страницу позже.', tone: 'warn'},
    absent: {text: 'Данные отсутствуют в ответе системы мониторинга.', tone: 'neutral'},
    unknown: {text: 'Доступность данных определить не удалось.', tone: 'neutral'},
};

const LOAD_FAILED_MESSAGE = 'Не удалось загрузить данные. Попробуйте обновить страницу позже.';

/** Понятные клиенту названия каналов (GEORITM-обозначения в подписи вторичны). */
const CHANNEL_NAMES: Record<CommunicationChannel['kind'], string> = {
    SIM_1: 'SIM-карта 1',
    SIM_2: 'SIM-карта 2',
    LAN: 'Кабель (LAN)',
    WIFI: 'Wi-Fi',
};

const CHANNEL_TYPE_NAMES: Record<CommunicationChannel['kind'], string> = {
    SIM_1: 'Мобильный канал, слот 1',
    SIM_2: 'Мобильный канал, слот 2',
    LAN: 'Проводной канал',
    WIFI: 'Беспроводная сеть',
};

/** Состояние канала — только из фактически переданных флагов; прочерки без домыслов. */
const channelState = (channel: CommunicationChannel): {text: string; tone: 'ok' | 'warn' | 'neutral'} => {
    if (channel.kind === 'SIM_1' || channel.kind === 'SIM_2') {
        if (channel.inserted === false) {
            return {text: 'Карта не установлена', tone: 'neutral'};
        }
        if (channel.online === true) {
            return {text: 'В сети', tone: 'ok'};
        }
        if (channel.online === false) {
            return {text: 'Нет регистрации в сети', tone: 'warn'};
        }
    }
    if (channel.kind === 'LAN') {
        if (channel.connected === true) {
            return {text: 'Кабель подключён', tone: 'ok'};
        }
        if (channel.connected === false) {
            return {text: 'Кабель не подключён', tone: 'warn'};
        }
    }
    return {text: 'Состояние не передаётся', tone: 'neutral'};
};

/** Уровень сигнала по документированным шкалам GEORITM (SIM 0–5, Wi-Fi 0–4). */
const channelSignal = (channel: CommunicationChannel): string | null => {
    const parts: string[] = [];
    if (channel.level !== undefined) {
        parts.push(channel.kind === 'WIFI'
            ? `Уровень сигнала: ${channel.level} из 4`
            : `Уровень сигнала: ${channel.level} из 5`);
    }
    if (channel.percent !== undefined) {
        parts.push(`Качество: ${channel.percent}%`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
};

const formatVoltage = (voltage: number): string =>
    `${new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(voltage)} В`;

/** Строка «данные получены: …» — только для доступных данных. */
const FetchedAt = ({fetchedAt}: {fetchedAt: string | undefined}) => {
    if (!fetchedAt) {
        return null;
    }
    return <span className="obj-comms__fetched">Данные получены: {formatDateTime(fetchedAt)} (МСК)</span>;
};

/**
 * Блок диагностики «Каналы связи и питание» (E9). Показывает только
 * фактически переданные источником данные: канал без флагов не получает
 * искусственного состояния, отсутствующие сведения не заменяются значениями.
 * Ошибка загрузки (null) — предупреждение об обновлении; постоянная
 * недоступность — нейтральное пояснение причины.
 */
export const ObjectCommunicationView = ({channels, power}: IObjectCommunicationProps) => {
    const channelsAvailability = channels === null ? 'error' : channels.availability;
    const powerAvailability = power === null ? 'error' : power.availability;
    const channelsMessage = channels === null
        ? LOAD_FAILED_MESSAGE
        : AVAILABILITY_MESSAGES[channelsAvailability].text;
    const powerMessage = power === null
        ? LOAD_FAILED_MESSAGE
        : AVAILABILITY_MESSAGES[powerAvailability].text;

    const powerSource = power?.source === 'main'
        ? {text: 'Основное питание', tone: 'ok' as const}
        : power?.source === 'backup'
            ? {text: 'Резервное питание (аккумулятор)', tone: 'warn' as const}
            : null;

    return (
        <section className="obj-section" aria-label="Каналы связи и питание">
            <h2 className="obj-section__title">Каналы связи и питание</h2>

            <div className="obj-comms">
                <div className="obj-comms__block">
                    <h3 className="obj-comms__subtitle">Каналы связи</h3>

                    {channelsMessage ? (
                        <p className={`obj-comms__note${AVAILABILITY_MESSAGES[channelsAvailability]?.tone === 'warn' || channels === null ? ' obj-comms__note--warn' : ''}`}
                            {...(channels === null ? {role: 'alert'} : {role: 'status'})}
                        >
                            {channelsMessage}
                        </p>
                    ) : (
                        <>
                            <ul className="obj-channels">
                                {channels!.channels.map((channel) => {
                                    const state = channelState(channel);
                                    const signal = channelSignal(channel);
                                    const isActive = channels!.activeChannel === channel.kind;
                                    return (
                                        <li key={channel.kind} className="obj-channel">
                                            <div className="obj-channel__info">
                                                <span className="obj-channel__name">
                                                    {CHANNEL_NAMES[channel.kind]}
                                                    {isActive && <span className="obj-channel__active"> · активный</span>}
                                                </span>
                                                <span className="obj-channel__type">{CHANNEL_TYPE_NAMES[channel.kind]}</span>
                                                {signal && <span className="obj-channel__signal">{signal}</span>}
                                            </div>
                                            <span className={`obj-channel__state obj-channel__state--${state.tone}`}>{state.text}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <FetchedAt fetchedAt={channels!.fetchedAt}/>
                        </>
                    )}
                </div>

                <div className="obj-comms__block">
                    <h3 className="obj-comms__subtitle">Питание</h3>

                    {powerMessage ? (
                        <p className={`obj-comms__note${AVAILABILITY_MESSAGES[powerAvailability]?.tone === 'warn' || power === null ? ' obj-comms__note--warn' : ''}`}
                            {...(power === null ? {role: 'alert'} : {role: 'status'})}
                        >
                            {powerMessage}
                        </p>
                    ) : (
                        <>
                            <div className="obj-power">
                                {powerSource && (
                                    <div className="obj-power__row">
                                        <span className="obj-power__label">Источник питания</span>
                                        <span className={`obj-power__value obj-power__value--${powerSource.tone}`}>{powerSource.text}</span>
                                    </div>
                                )}
                                {power!.voltage !== undefined && (
                                    <div className="obj-power__row">
                                        <span className="obj-power__label">Напряжение</span>
                                        <span className="obj-power__value">{formatVoltage(power!.voltage)}</span>
                                    </div>
                                )}
                            </div>
                            {power!.source === 'backup' && (
                                <p className="obj-comms__note obj-comms__note--warn" role="status">
                                    Прибор работает от резервного питания. При длительной работе проверьте электроснабжение объекта.
                                </p>
                            )}
                            <FetchedAt fetchedAt={power!.fetchedAt}/>
                        </>
                    )}
                </div>
            </div>
        </section>
    );
};
