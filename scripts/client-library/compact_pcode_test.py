import gzip
import io
from pathlib import Path
import tempfile
import unittest

from compact_pcode import compact_file


class CompressionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.vault = Path(self.directory.name)
        self.source = self.vault / 'extracted/module.swf/pcode/test.pcode'
        self.source.parent.mkdir(parents=True)
        self.data = b'original bytecode instruction\n' * 10000
        self.source.write_bytes(self.data)
        self.log = (self.vault / 'index.jsonl').open('a+', encoding='utf-8')
        self.addCleanup(self.log.close)

    def test_verified_archive_and_restore_index_exist_before_plain_copy_is_removed(self):
        record = compact_file(self.source, self.vault, self.log)
        self.assertFalse(self.source.exists())
        self.assertEqual(gzip.decompress((self.vault / record['archive']).read_bytes()), self.data)
        self.assertIn(record['sha256'], (self.vault / 'index.jsonl').read_text())
        self.assertGreater(record['freedAllocatedBytes'], 0)

    def test_conflicting_archive_never_removes_original(self):
        archive = self.source.with_suffix('.pcode.gz')
        archive.write_bytes(gzip.compress(b'different data'))
        with self.assertRaises(ValueError):
            compact_file(self.source, self.vault, self.log)
        self.assertEqual(self.source.read_bytes(), self.data)

    def test_journal_failure_preserves_plain_source_and_verified_archive(self):
        class BrokenLog(io.StringIO):
            def write(self, value):
                raise OSError('disk full')
        with self.assertRaises(OSError):
            compact_file(self.source, self.vault, BrokenLog())
        self.assertEqual(self.source.read_bytes(), self.data)
        self.assertEqual(gzip.decompress(self.source.with_suffix('.pcode.gz').read_bytes()), self.data)

    def test_raw_sources_and_symlinks_are_never_touched(self):
        raw = self.vault / 'raw/original.pcode'
        raw.parent.mkdir()
        raw.write_bytes(self.data)
        with self.assertRaises(ValueError):
            compact_file(raw, self.vault, self.log)
        linked = self.source.with_name('linked.pcode')
        linked.symlink_to(raw)
        with self.assertRaises(ValueError):
            compact_file(linked, self.vault, self.log)
        self.assertEqual(raw.read_bytes(), self.data)


if __name__ == '__main__':
    unittest.main()
