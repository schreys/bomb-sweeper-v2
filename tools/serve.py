"""Serve the game without browser caching: python3 tools/serve.py [port] [host]
Use host 0.0.0.0 to make it reachable from other devices on the LAN."""
import functools
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
host = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
handler = functools.partial(NoCacheHandler, directory="game")
http.server.ThreadingHTTPServer((host, port), handler).serve_forever()
