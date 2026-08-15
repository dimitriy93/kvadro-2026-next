/**
 * Генерирует временные изображения-заглушки (cover + in-article images)
 * внутрь каталога статьи `content/articles/<slug>/`.
 * Медиа хранятся только там и отдаются route handler'ами по URL
 * `/articles/<slug>/...` (см. `lib/articles/assets.ts`).
 *
 * Запуск:  node scripts/generate-article-images.mjs [slug ...]
 * Без аргументов — обрабатываются все статьи, у которых ещё нет cover.
 */

import {readdirSync, readFileSync, existsSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const contentRoot = path.join(projectRoot, 'content', 'articles');

const args = process.argv.slice(2);
const targets = args.length ? args : null;

/** Простая двухцветная «заглушка» с диагональным акцентом. */
async function placeholder(width, height, base, accent) {
    const svg = Buffer.from(`
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="${base}"/>
            <rect x="0" y="0" width="${width}" height="${height}" fill="url(#g)"/>
            <rect x="${Math.round(width * 0.08)}" y="${Math.round(height * 0.06)}"
                  width="${Math.round(width * 0.05)}" height="${Math.round(height * 0.88)}" fill="${accent}"/>
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="rgba(255,255,255,0.06)"/>
                    <stop offset="1" stop-color="rgba(0,0,0,0.35)"/>
                </linearGradient>
            </defs>
        </svg>`);
    return sharp(svg).webp({quality: 85}).toBuffer();
}

const dirs = existsSync(contentRoot)
    ? readdirSync(contentRoot, {withFileTypes: true})
          .filter((e) => e.isDirectory())
          .map((e) => e.name)
    : [];

for (const slug of dirs) {
    if (targets && !targets.includes(slug)) {
        continue;
    }

    const outDir = path.join(contentRoot, slug);
    const imagesOut = path.join(outDir, 'images');
    mkdirSync(imagesOut, {recursive: true});

    const coverOut = path.join(outDir, 'cover.webp');
    if (!existsSync(coverOut)) {
        const cover = await placeholder(1600, 900, '#101418', '#c9a962');
        await sharp(cover).toFile(coverOut);
        console.log('created:', path.relative(projectRoot, coverOut));
    }

    // Сколько изображений внутри статьи: считаем по article.md.
    let count = 2;
    const mdPath = path.join(contentRoot, slug, 'article.md');
    if (existsSync(mdPath)) {
        const md = readFileSync(mdPath, 'utf8');
        const matches = md.match(/!\[[^\]]*\]\(\.?\/?images\//g) ?? [];
        count = Math.max(count, matches.length);
    }

    for (let i = 1; i <= count; i += 1) {
        const name = `${String(i).padStart(2, '0')}.webp`;
        const file = path.join(imagesOut, name);
        if (!existsSync(file)) {
            const colors = ['#1a232b', '#2b201a', '#1a2b22', '#231a2b'];
            const img = await placeholder(1200, 700, colors[(i - 1) % colors.length], '#c9a962');
            await sharp(img).toFile(file);
            console.log('created:', path.relative(projectRoot, file));
        }
    }
}
