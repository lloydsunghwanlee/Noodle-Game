// 단일 HTML 파일 빌드: three.js, CSS, 게임 스크립트를 모두 한 파일에 포함
// 사용법: node build.mjs  →  dist/noodle-game.html
import fs from 'fs';
const r = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
let html = r('./index.html');
html = html.replace(/<!--PWA-->[\s\S]*?<!--\/PWA-->/, '');
html = html.replace('<link rel="stylesheet" href="css/style.css">', () => `<style>\n${r('./css/style.css')}\n</style>`);
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const body = scripts.map(s => `<script>\n${r('./' + s).replace(/<\/script/gi, '<\\/script')}\n</script>`).join('\n');
html = html.replace(/<!--SCRIPTS-->[\s\S]*?<!--\/SCRIPTS-->/, () => `<script>window.NG_NO_SW = true;</script>\n${body}`);
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/noodle-game.html', import.meta.url), html);
console.log('dist/noodle-game.html', (html.length / 1024).toFixed(0) + ' KB');

// claude.ai Artifact용: 문서 골격(doctype/html/head/body)을 제외한 본문 버전
let art = html
  .replace(/<!doctype html>\s*<html[^>]*>\s*<head>/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<\/head>\s*<body>/i, '')
  .replace(/<\/body>\s*<\/html>\s*$/i, '');
fs.writeFileSync(new URL('./dist/artifact.html', import.meta.url), art);
console.log('dist/artifact.html', (art.length / 1024).toFixed(0) + ' KB');
