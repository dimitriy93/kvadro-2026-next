import fireImg from '@/app/_assets/images/service_fire_safety.webp';
import alarmImg from '@/app/_assets/images/service_security_alarm.webp';
import lowVoltageImg from '@/app/_assets/images/service_low_voltage.webp';
import securityImg from '@/app/_assets/images/service_security_monitoring.webp';
import { services as servicesRoutes } from '@/config/routes/services.routes';

export const services = [
  {
    id: '01',
    title: 'Пожарная безопасность',
    text: 'Проектирование, монтаж и обслуживание систем пожарной сигнализации, оповещения и противопожарной защиты объектов.',
    image: fireImg,
    href: servicesRoutes.fireAlarm.href,
  },
  {
    id: '02',
    title: 'Охранная сигнализация',
    text: 'Установка охранной сигнализации, видеонаблюдения и контроля доступа с учетом особенностей объекта.',
    image: alarmImg,
    href: servicesRoutes.securityAlarm.href,
  },
  {
    id: '03',
    title: 'Слаботочные системы',
    text: 'Проектирование и монтаж слаботочных систем: сети связи, видеонаблюдение, СКУД, СОУЭ, охранная и пожарная сигнализация.',
    image: lowVoltageImg,
    href: servicesRoutes.lowCurrentSystems.href,
  },
  {
    id: '04',
    title: 'Охрана объектов',
    text: 'Пультовая и физическая охрана объектов, круглосуточный мониторинг и оперативное реагирование для бизнеса и предприятий.',
    image: securityImg,
    href: '',
  },
] as const;
