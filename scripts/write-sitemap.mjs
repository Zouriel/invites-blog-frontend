// Writes sitemap.xml for the prerendered site: every page the build wrote out as HTML, except any
// marked noindex. Run after `ng build web-inviter`, with the browser output folder as the argument.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SITE = 'https://invites.blog';
const root = process.argv[2];
if (!root) {
  console.error('usage: node scripts/write-sitemap.mjs <dist/web-inviter/browser>');
  process.exit(1);
}

const pages = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (name === 'index.html') pages.push(full);
  }
})(root);

const today = new Date().toISOString().slice(0, 10);
const urls = pages
  .filter((file) => !/<meta name="robots" content="noindex/.test(readFileSync(file, 'utf8')))
  .map((file) => {
    const dir = relative(root, file).split(sep).slice(0, -1).join('/');
    return dir ? `/${dir}` : '/';
  })
  .sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
  .map((path) => `  <url><loc>${SITE}${path === '/' ? '/' : path}</loc><lastmod>${today}</lastmod></url>`);

writeFileSync(
  join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
console.log(`sitemap.xml: ${urls.length} pages`);
