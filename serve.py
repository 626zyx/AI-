import http.server
import argparse
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
                      '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html'}
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Serve the demo without browser caching.')
    parser.add_argument('--port', type=int, default=8080)
    args = parser.parse_args()
    http.server.ThreadingHTTPServer.allow_reuse_address = True
    http.server.ThreadingHTTPServer(('127.0.0.1', args.port), H).serve_forever()
