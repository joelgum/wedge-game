#!/usr/bin/env python3
"""No-cache static server for WEDGE! dev.

Phones (especially iOS Safari) cache ES modules aggressively, which serves a
mismatched mix of old and new files after every edit. no-store fixes that.
"""
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8020
    print(f'WEDGE! dev server (no-cache) on http://0.0.0.0:{port}')
    http.server.ThreadingHTTPServer(('', port), NoCacheHandler).serve_forever()
