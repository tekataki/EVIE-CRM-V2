# v4 research card: facts (from sources) vs. EVIE's inference kept separate; per-source dates (already shown);
# images only when the hosted search actually returned them (enforced by toolImages). Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('src/research.js',[
 ("  key_points: { type: 'array', maxItems: 5, items: { type: 'string' } },",
  "  key_points: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'Hechos que aparecen explícitamente en las fuentes.' },\n  inference: nstr('Opcional: lo que TÚ deduces o interpretas (no dicho por las fuentes); null si no aplica'),","inference: nstr("),
 ("      'Distingue la fecha de publicación de la fecha del hecho. En sources incluye solo URLs que realmente consultaste.',",
  "      'Distingue la fecha de publicación de la fecha del hecho. En sources incluye solo URLs que realmente consultaste.',\n      'key_points son solo hechos de las fuentes. Cualquier conclusión o interpretación tuya va aparte en inference (o null). Nunca mezcles ambas.',","Cualquier conclusión o interpretación tuya va aparte"),
 ("key_points: (j.key_points || []).map((p) => clean(p, 240)).slice(0, 5),","key_points: (j.key_points || []).map((p) => clean(p, 240)).slice(0, 5), inference: j.inference ? clean(j.inference, 500) : null,","inference: j.inference ? clean("),
])
edit('public/evie-hud-cards.js',[
 ("${d.key_points?.length?`<ul class=\"hud-points\">${d.key_points.map(p=>`<li>${e(p)}</li>`).join('')}</ul>`:''}",
  "${d.key_points?.length?`<section class=\"hud-facts\" aria-label=\"Hechos de las fuentes\"><h4>Lo que dicen las fuentes</h4><ul class=\"hud-points\">${d.key_points.map(p=>`<li>${e(p)}</li>`).join('')}</ul></section>`:''}${d.inference?`<section class=\"hud-inference\" aria-label=\"Interpretación de EVIE\"><h4>Mi interpretación <small>(no es un dato de las fuentes)</small></h4><p>${e(d.inference)}</p></section>`:''}","hud-inference"),
])
edit('public/index.html',[("<link rel=\"stylesheet\" href=\"evie-v31.css\">","<link rel=\"stylesheet\" href=\"evie-v31.css\"><link rel=\"stylesheet\" href=\"evie-v4-shell.css\">","evie-v4-shell.css")])
