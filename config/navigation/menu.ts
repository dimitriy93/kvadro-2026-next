import { routes } from '../routes/main.routes';
import { services } from '../routes/services.routes';

export const floatingMenu = [
  routes.about,
  routes.services,
  routes.documents,
  routes.contacts,
] as const;

export const footerMenu = [
  routes.about,
  routes.services,
  routes.documents,
  routes.contacts,
] as const;

export const servicesMenu = [
  services.fireAlarm,
  services.securityAlarm,
  services.videoSurveillance,
  services.accessControl,
  services.lowCurrentSystems,
  services.fireAlarmDesign,
  services.intercomMaintenance,
] as const;
