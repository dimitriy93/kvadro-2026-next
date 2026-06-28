export const AREA_PRICING = {
  'до 100': 120000,
  '100–500': 250000,
  '500–1000': 450000,
  '1000+': 750000,
} as const;

export const SERVICE_MULTIPLIERS: Record<string, number> = {
  Пожарная: 1.2,
  Охранная: 1.1,
  Видеонаблюдение: 1.15,
  СКУД: 1.1,
  Слаботочка: 1.05,
};
