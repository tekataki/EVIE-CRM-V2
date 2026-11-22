'use strict';
// v10 · Chat Markdown renderer: structures render, and nothing the model writes can inject HTML or scripts.
const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const ctx={};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/evie-chat-md.js'),'utf8'),ctx);const M=ctx.EvieMarkdown;

test('structures: headings, bold/italic, code (inline + fenced with copy), lists (nested, tasks), quote, table, rule, links',()=>{
 const h=M.render('## Plan\n**Meta:** ahorrar *cada* mes con `ahorro()`.\n\n- uno\n  - uno.a\n- [x] hecho\n1. paso\n\n> nota\n\n| Mes | Monto |\n|---|---:|\n| Ene | $1,000 |\n\n---\n```js\nconst x = 1 < 2;\n```\nVer [docs](https://example.com/a?b=1&c=2) o https://claude.ai/x.');
 assert.match(h,/<h3>Plan<\/h3>/);assert.match(h,/<strong>Meta:<\/strong>/);assert.match(h,/<em>cada<\/em>/);assert.match(h,/<code>ahorro\(\)<\/code>/);
 assert.match(h,/<ul><li>uno<ul><li>uno\.a<\/li><\/ul><\/li><li class="md-task"><span class="md-check" data-done="true"/);assert.match(h,/<ol><li>paso<\/li><\/ol>/);
 assert.match(h,/<blockquote><p>nota<\/p><\/blockquote>/);assert.match(h,/<th>Mes<\/th><th style="text-align:right">Monto<\/th>/);assert.match(h,/<td style="text-align:right">\$1,000<\/td>/);
 assert.match(h,/<hr>/);assert.match(h,/<div class="md-code"><div class="md-code-head"><span>js<\/span><button type="button" class="md-copy" data-md-copy/);assert.match(h,/const x = 1 &lt; 2;/);
 assert.match(h,/<a href="https:\/\/example.com\/a\?b=1&amp;c=2" target="_blank" rel="noopener noreferrer nofollow">docs<\/a>/);assert.match(h,/<a href="https:\/\/claude.ai\/x"/);});

test('XSS: raw HTML, event handlers, javascript:/data: links, quotes in URLs and fenced HTML stay inert',()=>{
 const evil=['<script>alert(1)</script>','<img src=x onerror=alert(1)>','[x](javascript:alert(1))','[x](data:text/html,<script>)','[x](https://a.com" onmouseover="alert(1))','`<b>` **<i>x</i>**','```html\n<iframe src="javascript:alert(1)"></iframe>\n```','| <svg onload=alert(1)> | b |\n|---|---|\n| c | d |','![x](https://evil/x.png)','<a href="javascript:alert(1)">x</a>'];
 for(const e of evil){const h=M.render(e);assert.ok(!/<(script|img|iframe|svg|i)\b/i.test(h),e+' → '+h);for(const tag of h.match(/<[^>]+>/g)||[])assert.ok(!/\son\w+\s*=/i.test(tag),'no live handlers in real tags: '+tag);assert.ok(!/href="(javascript|data):/i.test(h),h);}
 assert.equal(M.render('[x](javascript:alert(1))'),'<p>x</p>');});

test('plain() for speech drops markup, code and URLs',()=>{
 assert.equal(M.plain('## Hola\n**Sam**, ve [esto](https://x.com) y `npm i`:\n```\nrm -rf\n```\n- uno'),'Hola Sam, ve esto y npm i: (bloque de código) uno');});
