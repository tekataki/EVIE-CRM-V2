# QA-only light server: serves dist/ and answers /api/* with neutral stubs (local mode, no AI).
# Used under low memory instead of wrangler; Playwright tests mock the APIs they exercise.
import http.server, json, os, sys
ROOT = os.path.join(os.path.dirname(__file__), '..', 'dist')
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def _json(s, obj, code=200):
        b = json.dumps(obj).encode(); s.send_response(code); s.send_header('Content-Type', 'application/json'); s.send_header('Content-Length', str(len(b))); s.end_headers(); s.wfile.write(b)
    def do_GET(s):
        if s.path.startswith('/api/runtime'): return s._json({'accountsEnabled': False, 'googleAuth': False, 'ai': {}, 'providers': {}})
        if s.path.startswith('/api/auth/session'): return s._json({'user': None})
        if s.path.startswith('/api/'): return s._json({'error': 'stub'}, 503)
        return super().do_GET()
    def do_POST(s):
        s.rfile.read(int(s.headers.get('Content-Length') or 0)); return s._json({'error': 'stub'}, 503)
http.server.ThreadingHTTPServer(('0.0.0.0', int(sys.argv[1]) if len(sys.argv) > 1 else 3000), H).serve_forever()
