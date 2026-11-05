"""Private encrypted-object cache. No mailbox credentials or plaintext mail."""
import hmac
import json
import os
import re
import sqlite3
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DB = os.environ.get('CACHE_DB', '/var/lib/cloud-mail-cache/cache.sqlite3')
SECRET = os.environ['BODY_CACHE_SECRET']
TTL = 100 * 365 * 86400  # Retain bodies indefinitely for practical purposes.


def connect():
    db = sqlite3.connect(DB, timeout=10)
    db.execute('PRAGMA journal_mode=WAL')
    return db


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def reply(self, status, body=b''):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def dispatch(self, put=False):
        if not hmac.compare_digest(self.headers.get('Authorization', ''), 'Bearer ' + SECRET):
            return self.reply(401)
        if self.path == '/health' and not put:
            with connect() as db:
                count, size = db.execute('SELECT count(*),coalesce(sum(length(body)),0) FROM objects WHERE expires>?', (time.time(),)).fetchone()
            return self.reply(200, json.dumps({'ok': True, 'objects': count, 'bytes': size}).encode())
        key = self.path.removeprefix('/objects/')
        if not re.fullmatch('[a-f0-9]{64}', key):
            return self.reply(404)
        with connect() as db:
            if put:
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= 8 * 1024 * 1024:
                        return self.reply(413)
                    raw = self.rfile.read(size)
                    envelope = json.loads(raw)
                    if set(envelope) != {'iv', 'data'} or not all(isinstance(v, str) for v in envelope.values()):
                        return self.reply(400)
                except (ValueError, TypeError):
                    return self.reply(400)
                db.execute('DELETE FROM objects WHERE expires<?', (time.time(),))
                db.execute('INSERT OR REPLACE INTO objects VALUES (?,?,?)', (key, raw, time.time()+TTL))
                return self.reply(204)
            row = db.execute('SELECT body FROM objects WHERE key=? AND expires>?', (key, time.time())).fetchone()
            return self.reply(200, row[0]) if row else self.reply(404)

    def do_GET(self):
        self.dispatch()

    def do_PUT(self):
        self.dispatch(True)


if __name__ == '__main__':
    os.umask(0o077)
    os.makedirs(os.path.dirname(DB), exist_ok=True)
    with connect() as db:
        db.execute('CREATE TABLE IF NOT EXISTS objects(key TEXT PRIMARY KEY,body BLOB NOT NULL,expires REAL NOT NULL)')
        db.execute('UPDATE objects SET expires=?', (time.time()+TTL,))
    ThreadingHTTPServer(('127.0.0.1', 18826), Handler).serve_forever()
