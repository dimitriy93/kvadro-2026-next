'use client';
import {FormEvent, useMemo, useState} from 'react';
import {ObjectPageHeader} from '../../ui/object-page-header.ui';
import {cabinetObjectApiRoute} from '@/config/routes/cabinet.routes';
import {Button} from '@/components/button';
import type {MonitorObject, ObjectReportFormat, ObjectReportType} from '@/lib/account';
import './object-reports.styles.scss';

interface IObjectReportsViewProps {
    object: MonitorObject;
    /** Сегодняшняя дата в МСК (YYYY-MM-DD) — максимум периода; считает сервер. */
    todayMsk: string;
    /** Максимальный период отчёта в днях; ограничение сервера, дублируется в форме. */
    maxPeriodDays: number;
    /** true — демонстрационный источник данных; false — реальные данные GEORITM. */
    isDemoData: boolean;
}

/**
 * Типы отчётов, доступные в кабинете. Белый список совпадает с серверным
 * (только подтверждённые на GEORITM 2.27.0); сервер всё равно валидирует —
 * произвольный тип отправить нельзя.
 */
const REPORT_TYPES: ReadonlyArray<{id: ObjectReportType; label: string; hint: string}> = [
    {
        id: 'alerts-summary',
        label: 'Сводный по событиям и тревогам',
        hint: 'Количество событий и тревог по дням за период',
    },
    {
        id: 'alerts-events',
        label: 'События и тревоги (детальный)',
        hint: 'Полный список записей журнала за период',
    },
];

const REPORT_FORMATS: ReadonlyArray<{id: ObjectReportFormat; label: string}> = [
    {id: 'pdf', label: 'PDF'},
    {id: 'excel', label: 'Excel'},
];

type ReportsStatus = 'idle' | 'loading' | 'success' | 'error';

const dayShift = (iso: string, days: number): string => {
    const date = new Date(`${iso}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};

/** Дата по умолчанию: последние 7 дней включительно (ограничено сегодня/МСК). */
const defaultFrom = (todayMsk: string): string => dayShift(todayMsk, -6);

/** Имя файла из Content-Disposition (filename* RFC 5987, затем filename). */
const dispositionFilename = (disposition: string | null): string | undefined => {
    if (!disposition) {
        return undefined;
    }
    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            // Некорректное кодирование — используем простой fallback.
        }
    }
    const plainMatch = /filename="([^"]+)"/i.exec(disposition);
    return plainMatch?.[1];
};

/**
 * Вкладка «Отчёты» объекта (E4.3): выбор подтверждённого типа отчёта,
 * периода и формата, формирование и скачивание файла. Формирование
 * выполняет сервер (POST /api/cabinet/objects/[id]/reports) — браузер
 * получает только готовый файл; имя файла приходит в Content-Disposition.
 *
 * Демонстрационный источник возвращает честно помеченный демо-CSV
 * (валидный PDF/XLSX с кириллицей без новых зависимостей не собрать),
 * поэтому выбор формата показывается только для реальных данных.
 */
export const ObjectReportsView = ({object, todayMsk, maxPeriodDays, isDemoData}: IObjectReportsViewProps) => {
    const [reportType, setReportType] = useState<ObjectReportType>('alerts-summary');
    const [from, setFrom] = useState(defaultFrom(todayMsk));
    const [to, setTo] = useState(todayMsk);
    const [format, setFormat] = useState<ObjectReportFormat>('pdf');
    const [status, setStatus] = useState<ReportsStatus>('idle');
    const [statusMessage, setStatusMessage] = useState('');

    const periodError = useMemo(() => {
        if (!from || !to) {
            return 'Укажите обе даты периода.';
        }
        if (from > to) {
            return 'Дата начала позже даты конца периода.';
        }
        if (to > todayMsk) {
            return 'Период не может быть в будущем.';
        }
        const spanDays = Math.round(
            (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
        ) + 1;
        if (spanDays > maxPeriodDays) {
            return `Максимальный период отчёта — ${maxPeriodDays} дней.`;
        }
        return null;
    }, [from, to, todayMsk, maxPeriodDays]);

    const setPreset = (days: number) => {
        setFrom(dayShift(todayMsk, -(days - 1)));
        setTo(todayMsk);
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (status === 'loading' || periodError) {
            return;
        }

        setStatus('loading');
        setStatusMessage('Формирование отчёта…');

        try {
            const response = await fetch(cabinetObjectApiRoute(object.id).reports, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({type: reportType, from, to, format}),
            });

            if (!response.ok) {
                let error = 'Не удалось сформировать отчёт';
                try {
                    const result = (await response.json()) as {error?: string};
                    if (typeof result?.error === 'string' && result.error.length > 0) {
                        error = result.error;
                    }
                } catch {
                    // Ответ без JSON — остаётся общее сообщение.
                }
                if (response.status === 401) {
                    error = `${error} Обновите страницу и войдите заново.`;
                }
                throw new Error(error);
            }

            // Ответ — файл: читаем целиком и сохраняем средствами браузера.
            const blob = await response.blob();
            const filename = dispositionFilename(response.headers.get('Content-Disposition'))
                ?? 'report';
            const url = URL.createObjectURL(blob);
            try {
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.append(link);
                link.click();
                link.remove();
            } finally {
                URL.revokeObjectURL(url);
            }

            setStatus('success');
            setStatusMessage(`Отчёт скачан: ${filename}`);
        } catch (err) {
            setStatus('error');
            setStatusMessage(err instanceof Error ? err.message : 'Не удалось сформировать отчёт');
        }
    };

    return (
        <>
            <ObjectPageHeader object={object} activeTab="reports" isDemoData={isDemoData}/>

            <section className="obj-section" aria-label="Отчёты по объекту">
                <h2 className="obj-section__title">Отчёты по объекту</h2>

                <form className="obj-reports" onSubmit={submit}>
                    <fieldset className="obj-reports__group">
                        <legend className="obj-reports__legend">Тип отчёта</legend>
                        <div className="obj-reports__options" role="radiogroup" aria-label="Тип отчёта">
                            {REPORT_TYPES.map((type) => (
                                <label
                                    key={type.id}
                                    className={`obj-reports__option${reportType === type.id ? ' obj-reports__option--active' : ''}`}
                                >
                                    <input
                                        type="radio"
                                        name="report-type"
                                        value={type.id}
                                        checked={reportType === type.id}
                                        onChange={() => setReportType(type.id)}
                                    />
                                    <span className="obj-reports__option-label">{type.label}</span>
                                    <span className="obj-reports__option-hint">{type.hint}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    <fieldset className="obj-reports__group">
                        <legend className="obj-reports__legend">Период (МСК)</legend>
                        <div className="obj-reports__presets" role="group" aria-label="Готовые периоды">
                            <button type="button" className="obj-reports__preset" onClick={() => setPreset(7)}>
                                7 дней
                            </button>
                            <button type="button" className="obj-reports__preset" onClick={() => setPreset(30)}>
                                30 дней
                            </button>
                        </div>
                        <div className="obj-reports__dates">
                            <label className="obj-reports__date">
                                <span>С</span>
                                <input
                                    type="date"
                                    value={from}
                                    max={todayMsk}
                                    onChange={(e) => setFrom(e.target.value)}
                                    aria-label="Дата начала периода"
                                />
                            </label>
                            <label className="obj-reports__date">
                                <span>По</span>
                                <input
                                    type="date"
                                    value={to}
                                    min={from}
                                    max={todayMsk}
                                    onChange={(e) => setTo(e.target.value)}
                                    aria-label="Дата конца периода"
                                />
                            </label>
                        </div>
                        {periodError && (
                            <p className="obj-reports__error" role="alert">{periodError}</p>
                        )}
                    </fieldset>

                    {!isDemoData && (
                        <fieldset className="obj-reports__group">
                            <legend className="obj-reports__legend">Формат файла</legend>
                            <div className="obj-reports__formats" role="radiogroup" aria-label="Формат файла">
                                {REPORT_FORMATS.map((item) => (
                                    <label
                                        key={item.id}
                                        className={`obj-reports__format${format === item.id ? ' obj-reports__format--active' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="report-format"
                                            value={item.id}
                                            checked={format === item.id}
                                            onChange={() => setFormat(item.id)}
                                        />
                                        {item.label}
                                    </label>
                                ))}
                            </div>
                        </fieldset>
                    )}

                    {isDemoData && (
                        <p className="obj-reports__note">
                            В демонстрационном режиме отчёт скачивается как CSV-файл с пометкой «ДЕМО» —
                            вымышленные данные, сформированные из демо-журнала, а не файл GEORITM.
                        </p>
                    )}

                    <div className="obj-reports__actions">
                        <Button mode="primary" type="submit" disabled={status === 'loading' || periodError !== null}>
                            {status === 'loading' ? 'Формирование…' : 'Сформировать и скачать'}
                        </Button>
                    </div>

                    {status !== 'idle' && status !== 'loading' && (
                        <p
                            className={`obj-reports__status obj-reports__status--${status}`}
                            role={status === 'error' ? 'alert' : 'status'}
                            aria-live="polite"
                        >
                            {statusMessage}
                        </p>
                    )}
                </form>
            </section>
        </>
    );
};
