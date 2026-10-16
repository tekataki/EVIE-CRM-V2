# v4 Kisha character consistency with the user's reference (tricolor Border Collie): tan eyebrow dots + tan
# cheeks, muzzle freckles, pink inner ears; extra poses greet / tilt / wag / sit (lie = existing 'resting').
# Still an ORIGINAL SVG (the reference image is never embedded). Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
edit('public/kisha-character.js',[
 ("const POSES=['idle','listening','thinking','speaking','curious','confused','supportive','happy','resting'];",
  "const POSES=['idle','listening','thinking','speaking','curious','confused','supportive','happy','resting','greet','tilt','wag','sit'];","'greet','tilt','wag','sit'"),
 ("  resting:{tilt:0,lift:-6,earL:14,earR:14,brow:0,lid:.92,jaw:0,tail:.05,tailAmp:.02,lie:1,breathe:.5,smile:.1}",
  "  resting:{tilt:0,lift:-6,earL:14,earR:14,brow:0,lid:.92,jaw:0,tail:.05,tailAmp:.02,lie:1,breathe:.5,smile:.1},\n"
  "  greet:{tilt:-8,lift:5,earL:-16,earR:-16,brow:.3,lid:.12,jaw:.18,tail:.7,tailAmp:.36,lie:0,breathe:1.1,smile:.75},\n"
  "  tilt:{tilt:18,lift:2,earL:-14,earR:10,brow:.45,lid:-.05,jaw:0,tail:.35,tailAmp:.08,lie:0,breathe:.9,smile:.2},\n"
  "  wag:{tilt:3,lift:2,earL:-10,earR:-10,brow:.15,lid:.1,jaw:.12,tail:.65,tailAmp:.42,lie:0,breathe:1,smile:.6},\n"
  "  sit:{tilt:0,lift:-2,earL:-2,earR:-2,brow:0,lid:.08,jaw:0,tail:.15,tailAmp:.05,lie:.25,breathe:.8,smile:.25}","greet:{tilt:-8"),
 ("  <g data-k=\"browL\">",
  "  <g class=\"k-tan\" aria-hidden=\"true\"><ellipse cx=\"156\" cy=\"116\" rx=\"7\" ry=\"5\" fill=\"#c9814a\"/><ellipse cx=\"244\" cy=\"116\" rx=\"7\" ry=\"5\" fill=\"#c9814a\"/><path d=\"M150 168 C 140 172 136 186 146 196 C 156 196 166 186 168 176 C 162 170 156 166 150 168 Z\" fill=\"#b9733f\" opacity=\".9\"/><path d=\"M250 168 C 260 172 264 186 254 196 C 244 196 234 186 232 176 C 238 170 244 166 250 168 Z\" fill=\"#b9733f\" opacity=\".9\"/></g>\n  <g data-k=\"browL\">","class=\"k-tan\""),
 ("  <g data-k=\"blush\" opacity=\"0\">",
  "  <g class=\"k-freckles\" aria-hidden=\"true\" fill=\"#23262f\"><circle cx=\"178\" cy=\"190\" r=\"1.6\"/><circle cx=\"172\" cy=\"196\" r=\"1.6\"/><circle cx=\"180\" cy=\"198\" r=\"1.6\"/></g>\n  <g data-k=\"blush\" opacity=\"0\">","k-freckles"),
 ("fill=\"#6b4b4f\" opacity=\".55\"/>","fill=\"#d9a29a\" opacity=\".55\"/>","fill=\"#d9a29a\" opacity=\".55\"/>"),
])
# Greeting pose while Kisha says hello (state machine stays the source of truth for hard phases).
edit('public/kisha-core.js',[
 ("function pose(){if(phase==='speaking')return 'speaking';","function pose(){if(phase==='greeting')return 'greet';if(phase==='speaking')return 'speaking';","if(phase==='greeting')return 'greet';"),
])
