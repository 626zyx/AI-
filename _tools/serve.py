import http.server
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
http.server.ThreadingHTTPServer.allow_reuse_address = True
http.server.ThreadingHTTPServer(('127.0.0.1', 8080), H).serve_forever()
