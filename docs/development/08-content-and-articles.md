# 08. Контент и статьи (блог)

## Как устроена система

Статьи — **не CMS и не база**: каждая статья — автономный каталог в репозитории. Article Loader (`lib/articles/loader.ts`) автоматически обнаруживает все каталоги в `content/articles/` при сборке — новая папка подхватывается без правок кода.

```text
content/articles/
└── ohrannaya-signalizaciya-dlya-biznesa/     # имя папки = slug статьи
    ├── article.md        # текст статьи (Markdown, рендерится marked'ом)
    ├── meta.ts           # метаданные (export default {...})
    ├── cover.webp        # обложка
    └── images/           # изображения внутри статьи (если есть)
```

## Формат `meta.ts`

Реальный пример (`content/articles/ohrannaya-signalizaciya-dlya-biznesa/meta.ts`):

```ts
export default {
    slug: 'ohrannaya-signalizaciya-dlya-biznesa',
    title: 'Охранная сигнализация для бизнеса: как построить систему, которая действительно защищает объект',
    description:
        'Как спроектировать охранную сигнализацию для бизнеса: зоны охраны, датчики, контроль периметра...',
    category: 'Охранная сигнализация',
    publishedAt: '2026-08-16',
    status: 'published',
};
```

| Поле | Обязательное | Формат / значения |
|---|---|---|
| `slug` | да | латиница/цифры/дефисы; loader дополнительно нормализует (`loader.ts` — `readMeta`); URL статьи = `/articles/<slug>` |
| `title` | да | заголовок статьи (используется в списке, на странице, в SEO/OG) |
| `description` | да | описание для списка и SEO description |
| `category` | да | человекочитаемое название; slug категории строится в `lib/articles/format.ts` (`CATEGORY_SLUGS`: «Пожарная безопасность» → `fire-safety`, «Охранная сигнализация» → `security-alarm`, «Видеонаблюдение» → `video-surveillance`, «СКУД» → `access-control`, «Слаботочные системы» → `low-current`, «Проектирование» → `design`; неизвестная категория — slug генерируется автоматически) |
| `publishedAt` | да | строго `YYYY-MM-DD`; в UI форматируется в `DD.MM.YYYY` (`formatPublishedAt`) |
| `status` | да | `'published'` \| `'draft'` \| `'archived'` (невалидное значение → считается `draft`); на сайте видны только `published` |
| `cover` | нет | по умолчанию `/articles/<slug>/cover.webp` (loader подставляет автоматически) |

## Изображения: как хранятся и отдаются

Медиа **не лежат в `public/`** — они внутри каталога статьи и отдаются рантайм-обработчиками:

- обложка: `GET /articles/<slug>/cover.webp` → `app/(pages)/articles/[slug]/cover.webp/route.ts`;
- изображения статьи: `GET /articles/<slug>/images/<file>` → `.../images/[file]/route.ts`;
- чтение файлов — `lib/articles/assets.ts` (`readArticleAsset`), с защитой от path traversal (пути вне каталога статьи блокируются).

В `article.md` изображения ссылается на эти URL:

```markdown
![Схема зон охраны](/articles/<slug>/images/01.webp)
```

Вспомогательный скрипт `scripts/generate-article-images.mjs` генерирует временные картинки-заглушки (cover + `images/`) внутрь каталога статьи:

```bash
node scripts/generate-article-images.mjs <slug>   # конкретная статья
node scripts/generate-article-images.mjs          # все статьи без cover
```

## Что система делает автоматически

| Функция | Где | Как |
|---|---|---|
| Обнаружение статей | `lib/articles/loader.ts` | сканирует `content/articles/`, читает `meta.ts` (парсинг build-time доверенного контента через `new Function` — импорты вырезаются регэкспами) и `article.md` |
| Markdown → HTML | `loader.ts` | `marked`; заголовкам h2/h3 проставляются стабильные `id` (`lib/articles/headings.ts`) — из них строится боковое «Содержание» |
| Время чтения | `lib/articles/reading-time.ts` | из текста вычищается разметка, слова / 200 в минуту, округление |
| Список статей | `app/(pages)/articles/page.tsx` | `getArticles()` — без ручных массивов |
| Страницы статей | `app/(pages)/articles/[slug]/page.tsx` | `generateStaticParams()` — SSG всех `published`; draft/archived/несуществующий slug → штатная 404 |
| SEO | `generateMetadata` там же | title/description/OG/og:image из `meta.ts`, canonical `/articles/<slug>` |

## Пошаговая инструкция: «Как добавить новую статью»

1. **Создайте папку**: `content/articles/<slug>/`, где `<slug>` — латинское имя с дефисами (оно станет URL). Пример: `content/articles/skud-dlya-ofisa/`.
2. **Создайте `meta.ts`** по образцу выше (все поля обязательны, кроме `cover`).
3. **Создайте `article.md`** — Markdown, начиная с `# Заголовок` (H1 дублирует `title` — так сделано в существующих статьях).
4. **Добавьте изображения**: положите файлы в `content/articles/<slug>/images/` (webp/jpg/png). В тексте ссылайтесь на `/articles/<slug>/images/<имя>.webp`. Обложку — `cover.webp` в корень папки (или сгенерируйте заглушку скриптом `scripts/generate-article-images.mjs <slug>`).
5. **Проверьте SEO-поля**: `description` — 1–2 содержательных предложения (попадает в `<meta name="description">` и список статей); `category` — из списка известных (см. таблицу выше), иначе slug сгенерируется автоматически; `publishedAt` — `YYYY-MM-DD`.
6. **Проверьте локально**: `npm run dev` → откройте `http://localhost:3000/articles/<slug>` — страница отрисовалась, заголовки в «Содержании» кликабельны.
7. **Проверьте список**: `http://localhost:3000/articles` — статья в списке, дата `DD.MM.YYYY`, время чтения посчитано.
8. **Проверьте ссылки и картинки**: обложка видна в карточке списка; картинки внутри статьи открываются по прямому URL `/articles/<slug>/images/...` (не 404).
9. **Sitemap**: в проекте sitemap отсутствует — шаг пропускается до появления `app/sitemap.ts`.
10. **Draft-проверка**: на этапе черновика поставьте `status: 'draft'` — статья не появится ни в списке, ни как страница (404). Для публикации — `'published'`.
11. **Сборка и публикация**: `npm run build` (страница статьи пререндерится — в логе сборки появится её путь) → коммит → пуш → деплой на Amvera.

### Пример новой статьи

`content/articles/skud-dlya-ofisa/meta.ts`:

```ts
export default {
    slug: 'skud-dlya-ofisa',
    title: 'СКУД для офиса: контроль доступа без лишних сложностей',
    description:
        'Как выбрать и спроектировать СКУД для офиса: точки прохода, идентификация, интеграция с охранной сигнализацией и типовые ошибки внедрения.',
    category: 'СКУД',
    publishedAt: '2026-11-01',
    status: 'published',
};
```

`content/articles/skud-dlya-ofisa/article.md` (структура):

```markdown
# СКУД для офиса: контроль доступа без лишних сложностей

Вводный абзац: какую задачу решает СКУД и почему «домофон на двери» — не всегда решение.

## Точки прохода и сценарии доступа

Текст с **выделениями** и списками:

* входная группа;
* серверная и кладовые;
* переговорные.

## Выбор идентификации

Текст. Картинка: ![Схема точек прохода](/articles/skud-dlya-ofisa/images/01.webp)

## Типовые ошибки проектирования

Заключительный текст.
```

## Частые ошибки

| Ошибка | Проявление | Как исправить |
|---|---|---|
| Slug не совпадает с именем папки | Путь к обложке `/articles/<slug>/cover.webp` 404 (обложка ищется по `slug` из meta, отдаётся из каталога папки) | Сделать имя папки = `slug` |
| Slug с кириллицей/пробелами | Loader нормализует, но URL получается некрасивым/кривые ссылки | Латиница и дефисы |
| Отсутствует `status` или опечатка в нём | Статья считается `draft` — нигде не видна | `'published'` |
| Дата не `YYYY-MM-DD` | Форматирование вернёт строку как есть (`formatPublishedAt` не сможет распарсить) | `2026-11-01` |
| Картинка в `article.md` лежит в `public/` | Путь сломается после деплоя/переименований | Хранить внутри каталога статьи, ссылаться на `/articles/<slug>/images/...` |
| Обложка называется не `cover.webp` (и нет поля `cover`) | Карточка без картинки (route вернёт 404) | Переименовать или указать `cover: '/articles/<slug>/<имя>.webp'` в `meta.ts` |
| `description`-заглушка «Статья про…» | Плохой сниппет в поиске и список | Осмысленное описание |

## Чек-лист публикации статьи

- [ ] папка `content/articles/<slug>/`, имя папки = slug
- [ ] `meta.ts`: slug/title/description/category/publishedAt (`YYYY-MM-DD`)/status
- [ ] `article.md` начинается с `# <title>`
- [ ] `cover.webp` на месте (или поле `cover` заполнено)
- [ ] изображения в `images/`, пути в тексте `/articles/<slug>/images/...`
- [ ] локально: страница открывается, «Содержание» работает
- [ ] локально: статья в `/articles` с датой и временем чтения
- [ ] `status: 'published'`
- [ ] `npm run build` прошёл, путь статьи появился в логе сборки
