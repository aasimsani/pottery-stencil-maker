// Downloads Pattern Monster's pattern list (MIT, github.com/catchspider2002/svelte-svg-patterns)
// and keeps only the fields the app needs. Run with: node scripts/vendor-pattern-monster.mjs
import { writeFileSync } from 'node:fs';

const url = 'https://raw.githubusercontent.com/catchspider2002/svelte-svg-patterns/master/src/routes/_index.js';
const src = await (await fetch(url)).text();
const json = src.slice(src.indexOf('['), src.lastIndexOf(']') + 1);
const patterns = JSON.parse(json).map((p) => ({
  slug: p.slug, title: p.title, mode: p.mode, width: p.width, height: p.height,
  stroke: p.maxStroke, tags: p.tags, layers: p.path.split('~'),
}));
writeFileSync(new URL('../src/sources/data/pattern-monster.json', import.meta.url), JSON.stringify(patterns));
console.log(`${patterns.length} patterns, modes:`, [...new Set(patterns.map((p) => p.mode))]);
