# P2 server wiring: /api/map route + map status in /api/runtime; CSP/permissions for geolocation + Stadia tiles. Idempotent.
R='/home/user/webapp/'
def edit(p,pairs):
    s=open(R+p).read()
    for a,b,m in pairs:
        if m in s: continue
        assert a in s,(p,a[:90]); s=s.replace(a,b,1)
    open(R+p,'w').write(s)
edit('src/accounts.js',[
 ("import { createMemory } from './memory.js'","import { createMemory } from './memory.js'\nimport { createMap, mapStatus } from './map.js'","import { createMap"),
 (" api.route('/memory',createMemory({authenticate:bound,seal,unseal}))"," api.route('/memory',createMemory({authenticate:bound,seal,unseal}))\n api.route('/map',createMap({fetcher,authenticate:bound}))","api.route('/map'"),
 ("weather:true,providers:","weather:true,map:{configured:mapStatus(c.env).configured,traffic:mapStatus(c.env).traffic},providers:","map:{configured:mapStatus"),
])
edit('public/_headers',[
 ("geolocation=()","geolocation=(self)","geolocation=(self)"),
 ("img-src 'self' data: blob:;","img-src 'self' data: blob: https://tiles.stadiamaps.com;","blob: https://tiles.stadiamaps.com;"),
 ("connect-src 'self';","connect-src 'self' https://tiles.stadiamaps.com;","connect-src 'self' https://tiles.stadiamaps.com"),
 ("worker-src 'self';","worker-src 'self' blob:;","worker-src 'self' blob:"),
])
print('p2 server ok')
