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
 root.AgendaRules=Object.freeze({expand,upcoming,parseMonthly,add,diff,monday,valid,lastDay});
})(typeof window!=='undefined'?window:globalThis);
