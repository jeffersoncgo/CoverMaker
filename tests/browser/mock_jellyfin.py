#!/usr/bin/env python3
"""Minimal Jellyfin API mock for browser tests of CoverMaker and content-recommender.

Usage: python3 -I mock_jellyfin.py <port> [--meili]
User: admin / secret (admin) and guest / guest (non-admin).
Control endpoints: GET /__mock/stats, GET /__mock/set_played?id=<itemId>&played=1
"""
import json, sys, zlib, struct, random, threading
from datetime import datetime, timezone
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8769
MEILI = '--meili' in sys.argv
SERVER_ID = 'mockserver0001'
TOKENS = {}  # token -> user id
USERS = {'admin': ('secret', 'u-admin', True), 'guest': ('guest', 'u-guest', False)}
STATS = {'requests': 0, 'by_path': {}}
LOCK = threading.Lock()

rnd = random.Random(42)
GENRES = ['Action', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Animation', 'Thriller', 'Family']
TAGS = ['space', 'heist', 'robots', 'zombies', 'friendship', 'revenge', 'magic', 'time travel']
STUDIOS = ['Lucas', 'Ghibli', 'Pixar', 'A24', 'Legendary']
LIBS = [
    {'Id': 'lib-movies', 'Name': 'Movies', 'CollectionType': 'movies', 'Type': 'CollectionFolder', 'Path': '/media/movies', 'count': 40, 'kind': 'Movie'},
    {'Id': 'lib-shows', 'Name': 'Shows', 'CollectionType': 'tvshows', 'Type': 'CollectionFolder', 'Path': '/media/shows', 'count': 15, 'kind': 'Series'},
]
ITEMS = {}
for lib in LIBS:
    items = []
    for i in range(lib['count']):
        g = rnd.sample(GENRES, rnd.randint(1, 3))
        items.append({
            'Id': f"{lib['Id']}-{i:03d}", 'Name': f"{lib['Name'][:-1]} {i:03d} {g[0]}",
            'Type': lib['kind'], 'ProductionYear': rnd.randint(1980, 2024),
            'CommunityRating': round(rnd.uniform(4, 9.5), 1), 'OfficialRating': rnd.choice(['PG', 'PG-13', 'R']),
            'PremiereDate': f"{rnd.randint(1980, 2024)}-01-01T00:00:00.0000000Z",
            'Genres': g, 'Tags': rnd.sample(TAGS, rnd.randint(0, 2)),
            'Studios': [{'Name': s, 'Id': s.lower()} for s in rnd.sample(STUDIOS, 1)],
            'ImageTags': {'Primary': f"tag{i}"}, 'Path': f"{lib['Path']}/{i:03d}", 'ParentId': lib['Id'],
            'UserData': {'Played': i % 3 == 0, 'PlayCount': 1 if i % 3 == 0 else 0, 'IsFavorite': False},
            'DateLastSaved': '2026-01-01T00:00:00.0000000Z',
        })
    ITEMS[lib['Id']] = items


def png(w, h, rgb):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    chunk = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'authorization, content-type, x-emby-authorization, x-emby-token')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')

    def send(self, code, body=b'', ctype='application/json'):
        if isinstance(body, (dict, list)):
            body = json.dumps(body).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def user(self):
        auth = self.headers.get('authorization', '') or ''
        if 'Token="' in auth:
            return TOKENS.get(auth.split('Token="', 1)[1].split('"', 1)[0])
        return TOKENS.get(self.headers.get('x-emby-token', ''))

    def do_OPTIONS(self):
        self.send(204)

    def track(self, path):
        with LOCK:
            STATS['requests'] += 1
            key = '/'.join(p if not p.startswith(('u-', 'lib-')) else '{id}' for p in path.split('/'))
            STATS['by_path'][key] = STATS['by_path'].get(key, 0) + 1

    def do_POST(self):
        u = urlparse(self.path); self.track(u.path)
        length = int(self.headers.get('Content-Length') or 0)
        body = json.loads(self.rfile.read(length) or b'{}')
        if u.path.lower() == '/users/authenticatebyname':
            STATS.setdefault('auth_by_name', []).append(body.get('Username'))
            entry = USERS.get(body.get('Username'))
            if not entry or entry[0] != body.get('Pw'):
                return self.send(401, {'error': 'bad credentials'})
            token = f"tok-{entry[1]}-{len(TOKENS)}"
            TOKENS[token] = entry[1]
            return self.send(200, {'AccessToken': token, 'ServerId': SERVER_ID, 'User': {'Id': entry[1], 'Name': body['Username'], 'ServerId': SERVER_ID, 'Policy': {'IsAdministrator': entry[2]}}})
        if u.path.lower() == '/sessions/logout':
            auth = self.headers.get('authorization', '') or self.headers.get('x-emby-authorization', '')
            if 'Token="' in auth:
                TOKENS.pop(auth.split('Token="', 1)[1].split('"', 1)[0], None)  # the token stops working, as in Jellyfin
            return self.send(204)
        return self.send(404, {'error': 'not found'})

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}; p = u.path
        self.track(p)
        lp = p.lower()
        if lp == '/__mock/stats':
            return self.send(200, STATS)
        if lp == '/__mock/revoke_tokens':
            TOKENS.clear()  # like a server restart that dropped every session, or tokens revoked in the dashboard
            return self.send(200, {'ok': True})
        if lp == '/__mock/reset_stats':
            STATS['requests'] = 0; STATS['by_path'] = {}; STATS['auth_by_name'] = []
            return self.send(200, {'ok': True})
        if lp == '/__mock/edit':
            # simulates a metadata edit on the server (new title): DateLastSaved moves to now
            for items in ITEMS.values():
                for it in items:
                    if it['Id'] == q.get('id'):
                        it['Name'] = q.get('name', it['Name'])
                        it['DateLastSaved'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.%f0Z')
            return self.send(200, {'ok': True})
        if lp == '/__mock/set_played':
            for items in ITEMS.values():
                for it in items:
                    if it['Id'] == q.get('id'):
                        it['UserData']['Played'] = q.get('played') == '1'
                        it['UserData']['PlayCount'] = 1 if q.get('played') == '1' else 0
            return self.send(200, {'ok': True})
        if lp == '/system/info/public':
            return self.send(200, {'LocalAddress': f'http://127.0.0.1:{PORT}', 'ServerName': 'Mock', 'Version': '10.10.0', 'ProductName': 'Jellyfin Server', 'OperatingSystem': 'Linux', 'Id': SERVER_ID})
        if lp == '/web/configurationpage':
            if MEILI and q.get('name') == 'Meilisearch':
                return self.send(200, "<div>[Meilisearch plugin]</div><script>const id = 'meili-plugin-id';</script>", 'text/html')
            return self.send(404, 'not found', 'text/plain')
        if lp.startswith('/items/') and lp.endswith('/images/primary'):
            item_id = p.split('/')[2]
            h = zlib.crc32(item_id.encode())
            w = int(q.get('fillWidth', 200)) // 4 or 50; hh = int(q.get('fillHeight', 300)) // 4 or 75
            return self.send(200, png(min(w, 500), min(hh, 500), ((h >> 16) & 255, (h >> 8) & 255, h & 255)), 'image/png')
        uid = self.user()
        if not uid:
            return self.send(401, {'error': 'unauthorized'})
        if lp.startswith('/users/') and lp.count('/') == 2:
            # GET /Users/{userId}: what a client calls to check that a saved token is still valid
            target = p.split('/')[2]
            if target != uid and uid != 'u-admin':
                return self.send(403, {'error': 'forbidden'})
            name = next((n for n, e in USERS.items() if e[1] == target), None)
            if not name:
                return self.send(404, {'error': 'not found'})
            return self.send(200, {'Id': target, 'Name': name, 'ServerId': SERVER_ID, 'Policy': {'IsAdministrator': USERS[name][2]}})
        if lp.startswith('/plugins/') and lp.endswith('/configuration'):
            if uid != 'u-admin':
                return self.send(403, {'error': 'forbidden'})
            return self.send(200, {'Url': 'http://127.0.0.1:1', 'ApiKey': 'k', 'IndexName': ''})
        if lp == '/userviews':
            return self.send(200, {'Items': [{k: v for k, v in l.items() if k not in ('count', 'kind')} | {'ImageTags': {'Primary': 'x'}} for l in LIBS]})
        if lp == '/library/virtualfolders':
            return self.send(200, [{'ItemId': l['Id'], 'Name': l['Name'], 'Locations': [l['Path']]} for l in LIBS])
        if lp.startswith('/users/') and lp.endswith('/items'):
            items = ITEMS.get(q.get('ParentId'), [])
            since = q.get('MinDateLastSaved') or q.get('minDateLastSaved')
            if since:
                def parse(v):
                    v = v.rstrip('Z')
                    if '.' in v:
                        head, frac = v.split('.', 1)
                        v = head + '.' + frac[:6].ljust(6, '0')
                    return datetime.fromisoformat(v + '+00:00')
                t = parse(since)
                items = [it for it in items if parse(it['DateLastSaved']) >= t]
            start = int(q.get('startIndex', q.get('StartIndex', 0)))
            limit = int(q.get('Limit', len(items) or 1))
            return self.send(200, {'Items': items[start:start + limit], 'TotalRecordCount': len(items), 'StartIndex': start})
        return self.send(404, {'error': 'not found', 'path': p})


if __name__ == '__main__':
    print(f'mock jellyfin on :{PORT} meili={MEILI}', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
