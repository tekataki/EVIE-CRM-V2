'use strict';
/* EVIE v10 · Markdown → safe HTML for the Chat (no dependencies; CSP script-src 'self').
   Escape FIRST, then add a small whitelist of structures: headings, bold/italic/strike, inline code, fenced code
   (with a copy button and language label), lists (nested by indent), blockquotes, tables, horizontal rules,
   http(s)/mailto links (new tab, noopener) and line breaks. Raw HTML from the model is always shown as text. */
(function(root){
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const safeUrl=u=>{const x=String(u||'').trim().replace(/&amp;/g,'&');return /^(https?:\/\/|mailto:)/i.test(x)&&!/[\s"'<>`]/.test(x)?x:null;};
 /** Inline markup on an ALREADY-ESCAPED line. Code spans are protected first. */
 function inline(s){const codes=[];s=s.replace(/`([^`\n]+)`/g,(_,c)=>{codes.push(c);return '\u0000'+(codes.length-1)+'\u0000';});
  s=s.replace(/!\[([^\]]*)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g,(m,alt)=>alt?`[${alt}]`:'');
  s=s.replace(/\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+&quot;[^&]*&quot;)?\)/g,(m,t,u)=>{const ok=safeUrl(u);return ok?`<a href="${esc(ok)}" target="_blank" rel="noopener noreferrer nofollow">${t}</a>`:t;});
  s=s.replace(/(^|[\s(])(https?:\/\/(?:(?!&quot;|&#39;|&lt;|&gt;)[^\s<)])*(?:(?!&quot;|&#39;)[^\s<).,;:!?]))/g,(m,pre,u)=>{const ok=safeUrl(u);return ok?`${pre}<a href="${esc(ok)}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`:m;});
  s=s.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/__([^_\n]+)__/g,'<strong>$1</strong>');
  s=s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\*)/g,'$1<em>$2</em>').replace(/(^|[^_\w])_([^_\n]+)_(?!\w)/g,'$1<em>$2</em>');
  s=s.replace(/~~([^~\n]+)~~/g,'<del>$1</del>');
  return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>`<code>${codes[+i]}</code>`);}
 const LANG=/^[a-z0-9+#._-]{1,20}$/i;
 function codeBlock(lang,body){const l=LANG.test(lang||'')?lang:'';
  return `<div class="md-code"><div class="md-code-head"><span>${esc(l||'código')}</span><button type="button" class="md-copy" data-md-copy aria-label="Copiar código">Copiar</button></div><pre><code${l?` data-lang="${esc(l)}"`:''}>${body}</code></pre></div>`;}
 function table(rows){const cells=r=>r.replace(/^\s*\|/,'').replace(/\|\s*$/,'').split('|').map(c=>inline(c.trim()));
  const head=cells(rows[0]),align=cells(rows[1]).map(a=>/^:-+:$/.test(a)?'center':/^-+:$/.test(a)?'right':'');
  const body=rows.slice(2).map(r=>`<tr>${cells(r).map((c,i)=>`<td${align[i]?` style="text-align:${align[i]}"`:''}>${c}</td>`).join('')}</tr>`).join('');
  return `<div class="md-table"><table><thead><tr>${head.map((c,i)=>`<th${align[i]?` style="text-align:${align[i]}"`:''}>${c}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;}
 /** Lists with nesting by indentation (2+ spaces). */
 function list(lines){let html='',stack=[];
  for(const line of lines){const m=line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);if(!m)continue;const depth=Math.floor(m[1].replace(/\t/g,'  ').length/2),type=/\d/.test(m[2])?'ol':'ul';
   while(stack.length>depth+1)html+=`</li></${stack.pop()}>`;
   if(stack.length===depth+1&&stack.at(-1)!==type){html+=`</li></${stack.pop()}>`;}
   if(stack.length<depth+1){html+=`<${type}>`;stack.push(type);}else html+='</li>';
   const task=m[3].match(/^\[( |x)\]\s+(.*)$/i);html+=task?`<li class="md-task"><span class="md-check" data-done="${task[1].toLowerCase()==='x'}" aria-hidden="true"></span>${inline(task[2])}`:`<li>${inline(m[3])}`;}
  while(stack.length)html+=`</li></${stack.pop()}>`;return html;}
 function render(src){const text=String(src??'').replace(/\r\n?/g,'\n');const lines=text.split('\n');let out='',i=0,para=[];
  const flush=()=>{if(para.length){out+=`<p>${para.map(l=>inline(esc(l))).join('<br>')}</p>`;para=[];}};
  while(i<lines.length){const line=lines[i];
   const fence=line.match(/^\s*(```|~~~)\s*([^\s`]*)\s*$/);
   if(fence){flush();const close=fence[1],body=[];i++;while(i<lines.length&&!lines[i].trim().startsWith(close)){body.push(lines[i]);i++;}i++;out+=codeBlock(fence[2],esc(body.join('\n')));continue;}
   if(!line.trim()){flush();i++;continue;}
   const h=line.match(/^(#{1,4})\s+(.*)$/);if(h){flush();const n=Math.min(4,h[1].length+1);out+=`<h${n}>${inline(esc(h[2]))}</h${n}>`;i++;continue;}
   if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)){flush();out+='<hr>';i++;continue;}
   if(/^\s*>/.test(line)){flush();const q=[];while(i<lines.length&&/^\s*>/.test(lines[i])){q.push(lines[i].replace(/^\s*>\s?/,''));i++;}out+=`<blockquote>${render(q.join('\n'))}</blockquote>`;continue;}
   if(/^\s*\|.*\|\s*$/.test(line)&&i+1<lines.length&&/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i+1])){flush();const rows=[];while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i])){rows.push(esc(lines[i]));i++;}out+=table(rows);continue;}
   if(/^\s*([-*+]|\d+[.)])\s+/.test(line)){flush();const ls=[];while(i<lines.length&&(/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])||(/^\s{2,}\S/.test(lines[i])&&ls.length))){if(/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]))ls.push(esc(lines[i]));else ls[ls.length-1]+=' '+esc(lines[i].trim());i++;}out+=list(ls);continue;}
   para.push(line);i++;}
  flush();return out;}
 /** Plain text for speech (no markup, no URLs, no code blocks). */
 function plain(src){return String(src??'').replace(/```[\s\S]*?```/g,' (bloque de código) ').replace(/`([^`]+)`/g,'$1').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/https?:\/\/\S+/g,'').replace(/^#{1,6}\s+/gm,'').replace(/^\s*[-*+]\s+/gm,'').replace(/^\s*>\s?/gm,'').replace(/\|/g,' ').replace(/[*_~#>]+/g,'').replace(/\s+/g,' ').trim();}
 root.EvieMarkdown=Object.freeze({render,plain,inline:s=>inline(esc(s)),esc});
})(typeof window!=='undefined'?window:globalThis);
