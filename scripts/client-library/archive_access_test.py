import gzip
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import server


class ArchiveAccessTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.root = Path(self.folder.name)
        self.file = self.root / 'extracted/module.swf/pcode/original.pcode.gz'
        self.file.parent.mkdir(parents=True)
        self.data = b'original P-code\r\n' * 100
        self.file.write_bytes(gzip.compress(self.data))
        self.patch = patch.object(server, 'ROOT', self.root)
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def handler(self, url):
        handler = object.__new__(server.Handler)
        handler.path = url
        handler.wfile = io.BytesIO()
        handler.headers_sent = []
        handler.send_response = lambda status: setattr(handler, 'status', status)
        handler.send_header = lambda name, value: handler.headers_sent.append((name, value))
        handler.end_headers = lambda: None
        handler.json = lambda value, status=200: (setattr(handler, 'result', value), setattr(handler, 'status', status))
        return handler

    def test_original_text_url_still_returns_exact_bytes_after_archiving(self):
        handler = self.handler('/extracted/module.swf/pcode/original.pcode')
        handler.do_GET()
        self.assertEqual(handler.status, 200)
        self.assertEqual(handler.wfile.getvalue(), self.data)
        self.assertIn(('Content-Type', 'text/plain; charset=utf-8'), handler.headers_sent)

    def test_asset_listing_keeps_original_filename_and_working_url(self):
        handler = self.handler('/api/asset?path=module.swf')
        with patch.object(server, 'asset', return_value={'path': 'module.swf'}):
            handler.do_GET()
        exported = handler.result['exports'][0]
        self.assertEqual(exported['name'], 'pcode/original.pcode')
        self.assertTrue(exported['archived'])
        self.assertFalse(exported['url'].endswith('.gz'))


if __name__ == '__main__':
    unittest.main()
