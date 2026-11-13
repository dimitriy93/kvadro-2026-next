export const cabinet = {
  title: 'Личный кабинет',
  href: '/cabinet',
  login: {
    title: 'Вход в личный кабинет',
    href: '/cabinet/login',
  },
  api: {
    login: '/api/cabinet/login',
    logout: '/api/cabinet/logout',
    session: '/api/cabinet/session',
    objects: '/api/cabinet/objects',
  },
} as const;

/** Маршруты страниц конкретного объекта защищённой зоны кабинета. */
export const cabinetObjectRoute = (objectId: string) => ({
  state: `/cabinet/objects/${objectId}`,
  events: `/cabinet/objects/${objectId}/events`,
  map: `/cabinet/objects/${objectId}/map`,
});
