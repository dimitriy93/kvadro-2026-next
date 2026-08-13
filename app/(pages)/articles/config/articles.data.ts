export interface Article {
    slug: string;
    title: string;
    description: string;
    category: string;
    categorySlug: string;
    date: string;
    readingTime: number;
    image: string;
    featured?: boolean;
}

export interface ArticleCategory {
    slug: string;
    title: string;
}

export const articleCategories: ArticleCategory[] = [
    {slug: 'all', title: 'Все'},
    {slug: 'fire-safety', title: 'Пожарная безопасность'},
    {slug: 'video-surveillance', title: 'Видеонаблюдение'},
    {slug: 'security-alarm', title: 'Охранная сигнализация'},
    {slug: 'access-control', title: 'СКУД'},
    {slug: 'low-current', title: 'Слаботочные системы'},
    {slug: 'design', title: 'Проектирование'},
] as const;

export const articles: Article[] = [
    {
        slug: 'kak-vybrat-sistemu-videonablyudeniya',
        title: 'Как выбрать систему видеонаблюдения для коммерческого объекта',
        description:
            'Разбираем критерии выбора камер, серверного оборудования и архитектуры хранения для офисов, складов, магазинов и производственных площадок.',
        category: 'Видеонаблюдение',
        categorySlug: 'video-surveillance',
        date: '12.08.2026',
        readingTime: 8,
        image: 'monitoring',
        featured: true,
    },
    {
        slug: 'adresnaya-i-neadresnaya-pozharnaya-signalizaciya',
        title: 'Чем отличается адресная пожарная сигнализация от неадресной',
        description:
            'Объясняем принципиальную разницу, стоимость владения и области применения двух типов систем пожарной сигнализации.',
        category: 'Пожарная безопасность',
        categorySlug: 'fire-safety',
        date: '05.08.2026',
        readingTime: 6,
        image: 'fire-safety',
    },
    {
        slug: 'skud-dlya-biznesa-osnovnye-komponenty',
        title: 'СКУД для бизнеса: основные компоненты системы',
        description:
            'Контроллеры, считыватели, доводчики и программное обеспечение: из чего складывается современная система контроля доступа.',
        category: 'СКУД',
        categorySlug: 'access-control',
        date: '28.07.2026',
        readingTime: 7,
        image: 'access-control',
    },
    {
        slug: 'chto-vhodit-v-proektirovanie-pozharnoy-bezopasnosti',
        title: 'Что входит в проектирование системы пожарной безопасности',
        description:
            'От исходных данных и нормативных требований до рабочей документации: полный состав проектных работ по ПС и СОУЭ.',
        category: 'Проектирование',
        categorySlug: 'design',
        date: '15.07.2026',
        readingTime: 9,
        image: 'design',
    },
    {
        slug: 'slabotochnye-sistemy-sovremennogo-kommercheskogo-zdaniya',
        title: 'Слаботочные системы современного коммерческого здания',
        description:
            'СКС, структурированные кабельные сети и инженерная инфраструктура: почему слаботочка — основа цифрового офиса.',
        category: 'Слаботочные системы',
        categorySlug: 'low-current',
        date: '02.07.2026',
        readingTime: 5,
        image: 'low-current',
    },
    {
        slug: 'okhrannaya-signalizaciya-principy-postroeniya',
        title: 'Охранная сигнализация: принципы построения периметра',
        description:
            'Рубежи защиты, датчики и сценарии реагирования — как выстроить эффективную охранную сигнализацию объекта.',
        category: 'Охранная сигнализация',
        categorySlug: 'security-alarm',
        date: '20.06.2026',
        readingTime: 6,
        image: 'security-alarm',
    },
];
