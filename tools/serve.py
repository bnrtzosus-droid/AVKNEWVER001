#!/usr/bin/env python3
"""Local preview server with the same clean URLs as .htaccess:  python3 tools/serve.py [port]"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def translate_path(self, path):
        p = path.split('?', 1)[0].split('#', 1)[0]
        if p != '/' and not os.path.splitext(p)[1] and os.path.exists(os.path.join(ROOT, p.strip('/') + '.html')):
            path = '/' + p.strip('/') + '.html'
        return super().translate_path(path)

    def send_error(self, code, message=None, explain=None):
        if code == 404 and os.path.exists(os.path.join(ROOT, '404.html')):
            body = open(os.path.join(ROOT, '404.html'), 'rb').read()
            self.send_response(404)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            if self.command != 'HEAD':
                self.wfile.write(body)
        else:
            super().send_error(code, message, explain)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print('http://localhost:%d' % port)
    http.server.ThreadingHTTPServer(('', port), H).serve_forever()
