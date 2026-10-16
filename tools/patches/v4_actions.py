# v4 Ivi typed CRUD: one strict-schema tool `edit_record` (allow-listed ops, enum-checked by the model schema
# and re-checked by EvieActions), dispatch in evie-assistant.js, warmer style rules. Idempotent (markers).
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read();o=s
    for old,new,marker in pairs:
        if marker in s: continue
        assert old in s,(p,old[:80]); s=s.replace(old,new,1)
    if s!=o: open(R+p,'w').write(s); print('patched',p)
# Already applied in this tree (markers present): src/assistant.js «name: 'edit_record'» + «usa edit_record (guarda una vez»,
# public/evie-assistant.js «edit_record(a={},call)», public/index.html «evie-actions.js».
for p,m in [('src/assistant.js',"name: 'edit_record'"),('src/assistant.js','usa edit_record (guarda una vez'),('public/evie-assistant.js','edit_record(a={},call)'),('public/index.html','evie-actions.js')]:
    assert m in open(R+p).read(),(p,m)
print('v4_actions: markers OK')
