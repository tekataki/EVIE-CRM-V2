'use strict';
/* Pure recurrence + occurrence helpers for Agenda v2.4 (no DOM). Backwards compatible with the
   existing record.recurrence shape {frequency, interval, days_of_week, day_of_month, end_date, time_local}
   and adds: days_of_month:[15,30] (several days per month), exceptions:{'YYYY-MM-DD':{cancelled:true}|{title,time_local}}.
   Months without a requested day (e.g. 30 in February) use the LAST day of that month, once (no duplicates). */
(function(root){
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'));
 const add=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
 const diff=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/864e5);
 const lastDay=(y,m)=>new Date(Date.UTC(y,m+1,0)).getUTCDate();
 const monday=d=>{const x=new Date(d+'T12:00:00Z'),w=(x.getUTCDay()+6)%7;return add(d,-w);};
 // Every occurrence date of a recurrence between from..to (inclusive), sorted & unique. Bounded.
 function expand(start,rec,from,to,limit=800){
  if(!valid(start)||!rec)return valid(start)&&start>=from&&start<=to?[start]:[];
  const end=rec.end_date&&valid(rec.end_date)&&rec.end_date<to?rec.end_date:to,iv=Math.max(1,rec.interval|0||1),out=new Set();
  if(end<start||end<from)return [];
  if(rec.frequency==='daily'){let k=Math.max(0,Math.ceil(diff(start,from)/iv));for(let d=add(start,k*iv);d<=end&&out.size<limit;d=add(d,iv))out.add(d);}
  else if(rec.frequency==='weekly'){const wd=rec.days_of_week?.length?rec.days_of_week:[new Date(start+'T12:00:00Z').getUTCDay()],w0=monday(start);for(let d=from>start?from:start;d<=end&&out.size<limit;d=add(d,1)){const weeks=Math.round(diff(w0,monday(d))/7);if(weeks%iv===0&&wd.includes(new Date(d+'T12:00:00Z').getUTCDay()))out.add(d);}}
  else if(rec.frequency==='monthly'||rec.frequency==='yearly'){const s=new Date(start+'T12:00:00Z'),step=rec.frequency==='yearly'?iv*12:iv,doms=(rec.days_of_month?.length?rec.days_of_month:[rec.day_of_month||s.getUTCDate()]).filter(n=>Number.isInteger(n)&&n>=1&&n<=31);
   for(let k=0;k<2400&&out.size<limit;k+=step){const y=s.getUTCFullYear()+Math.floor((s.getUTCMonth()+k)/12),m=(s.getUTCMonth()+k)%12;const first=`${y}-${String(m+1).padStart(2,'0')}-01`;if(first>end)break;for(const dom of doms){const d=`${y}-${String(m+1).padStart(2,'0')}-${String(Math.min(dom,lastDay(y,m))).padStart(2,'0')}`;if(d>=start&&d>=from&&d<=end)out.add(d);}}}
  else if(start>=from&&start<=to)out.add(start);
  const ex=rec.exceptions||{};
  return [...out].filter(d=>!ex[d]?.cancelled).sort();
 }
 const upcoming=(start,rec,from,n=60)=>expand(start,rec,from<start?start:from,add(from<start?start:from,3660),n);
 /* Natural-language helper for EVIE drafts: "el 15 y 30 de cada mes hasta diciembre".
    Returns {days_of_month, end_date, start} or null. Year is resolved from `today` (never in the past). */
 const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
 function parseMonthly(text,today){const q=String(text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(!/(cada mes|mensual|de cada mes|todos los meses|monthly|each month)/.test(q))return null;
  const head=q.split(/hasta/)[0];
  const nums=[...head.matchAll(/\b(\d{1,2})\b(?! ?(?:am|pm|h|hrs|:))/g)].map(m=>+m[1]).filter(n=>n>=1&&n<=31);
  const days=[...new Set(nums)].slice(0,4).sort((a,b)=>a-b);if(!days.length)return null;
  let end=null;const mm=q.match(/hasta (?:el )?(?:(\d{1,2}) de )?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)(?: (?:de )?(\d{4}))?/);
  if(mm){const mi=MONTHS.indexOf(mm[2]),ty=+today.slice(0,4),tm=+today.slice(5,7)-1;let y=mm[3]?+mm[3]:(mi<tm?ty+1:ty);const d=mm[1]?Math.min(+mm[1],lastDay(y,mi)):lastDay(y,mi);end=`${y}-${String(mi+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;}
  return {frequency:'monthly',interval:1,days_of_month:days,end_date:end,start:today};}
 /* ---- Agenda v8 view helpers (pure) ----
    Sections, in reading order. "Esta semana" = after tomorrow up to Sunday of the current Monday-based week. */
 const BUCKETS=Object.freeze([['overdue','Vencidos'],['today','Hoy'],['tomorrow','Mañana'],['week','Esta semana'],['later','Más adelante'],['none','Sin fecha']]);
 const TABS=Object.freeze({hoy:['overdue','today'],proximos:['tomorrow','week','later'],todo:BUCKETS.map(b=>b[0])});
 const real=d=>valid(d)&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 function bucket(date,today){if(!real(date))return 'none';if(date<today)return 'overdue';if(date===today)return 'today';if(date===add(today,1))return 'tomorrow';if(date<=add(monday(today),6))return 'week';return 'later';}
 const RANK={high:0,medium:1,low:2};
 // Same day: "todo el día" first, then by hour; ties by priority (alta primero), title and id → stable, deterministic order.
 function compare(a,b){return (a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||((a.time?1:0)-(b.time?1:0))||String(a.time||'').localeCompare(String(b.time||''))||((RANK[a.priority]??1)-(RANK[b.priority]??1))||String(a.title||'').localeCompare(String(b.title||''),'es')||String(a.id||'').localeCompare(String(b.id||''));}
 // entries: [{id,date:'YYYY-MM-DD'|null,time:'HH:MM'|'',priority,title}] → non-empty sections in order, optionally limited to `keys`.
 function group(entries,today,keys){const by=new Map(BUCKETS.map(([k])=>[k,[]]));for(const x of entries||[])by.get(bucket(x.date,today)).push(x);return BUCKETS.filter(([k])=>!keys||keys.includes(k)).map(([key,label])=>({key,label,items:by.get(key).sort(compare)})).filter(g=>g.items.length);}
 const week=anchor=>{const m=monday(real(anchor)?anchor:new Date().toISOString().slice(0,10));return Array.from({length:7},(_,i)=>add(m,i));};
 const LEGACY_TABS={today:'hoy',day:'hoy',week:'proximos',month:'proximos',calendar:'proximos',tasks:'todo',inbox:'todo',done:'hechos',archive:'hechos'};
 const tab=t=>['hoy','proximos','todo','hechos'].includes(t)?t:LEGACY_TABS[t]||'hoy';
 /* Quick add: the same narrow, deterministic suffix grammar Ivy's command bus already accepts
    ("… hoy", "… mañana", "… 2026-12-01", optionally "a las 17:00"), plus a bare trailing "17:00".
    Nothing else is guessed: unknown words stay in the title. Returns {title,date,time} (date/time may be null). */
 function quick(text,today){const raw=String(text||'').replace(/\s+/g,' ').trim();if(!raw)return null;const plain={title:raw,date:null,time:null};
  const hhmm=(h,m)=>String(h).padStart(2,'0')+':'+m;
  const m=raw.match(/\s(hoy|ma[nñ]ana|\d{4}-\d{2}-\d{2})(?:\s(?:a\s(?:las?\s)?)?([01]?\d|2[0-3]):([0-5]\d))?$/i);
  if(m){const title=raw.slice(0,m.index).trim(),w=m[1].toLowerCase(),date=w==='hoy'?today:w.startsWith('ma')?add(today,1):m[1];if(!title||!real(date))return plain;return {title,date,time:m[2]!=null?hhmm(m[2],m[3]):null};}
  const t=raw.match(/\s(?:a\s(?:las?\s)?)?([01]?\d|2[0-3]):([0-5]\d)$/i);
  if(t){const title=raw.slice(0,t.index).trim();if(!title)return plain;return {title,date:null,time:hhmm(t[1],t[2])};}
  return plain;}
 root.AgendaRules=Object.freeze({expand,upcoming,parseMonthly,add,diff,monday,valid,lastDay,real,BUCKETS,TABS,bucket,compare,group,week,tab,quick});
})(typeof window!=='undefined'?window:globalThis);
