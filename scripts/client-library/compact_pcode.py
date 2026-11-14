#!/usr/bin/env python3
"""Lossless, resumable compression of derived P-code; original SWFs stay intact."""
import argparse
import gzip
import hashlib
import json
import os
from pathlib import Path
import stat
import tempfile

VAULT = Path(__file__).resolve().parents[2] / 'local-assets'
CHUNK = 1024 * 1024


def digest(stream):
    value = hashlib.sha256()
    count = 0
    while chunk := stream.read(CHUNK):
        value.update(chunk)
        count += len(chunk)
    return value.hexdigest(), count


def compact_file(source, vault, journal):
    source, vault = Path(source), Path(vault).resolve()
    if source.is_symlink() or not source.resolve().is_relative_to(vault / 'extracted'):
        raise ValueError('Only regular derived files inside extracted/ are allowed')
    before = source.stat()
    if source.suffix != '.pcode' or not stat.S_ISREG(before.st_mode):
        raise ValueError('Only P-code exports may be compressed')
    target = source.with_suffix('.pcode.gz')
    if target.is_symlink():
        raise ValueError('Refusing an archive symlink')
    temporary = None
    try:
        if not target.exists():
            handle, name = tempfile.mkstemp(prefix=source.name + '.', suffix='.part', dir=source.parent)
            temporary = Path(name)
            with os.fdopen(handle, 'wb') as output:
                with source.open('rb') as original, gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0, compresslevel=6) as archived:
                    while chunk := original.read(CHUNK):
                        archived.write(chunk)
                output.flush()
                os.fsync(output.fileno())
            candidate = temporary
        else:
            candidate = target
        with source.open('rb') as original, gzip.open(candidate, 'rb') as restored:
            expected, size = digest(original)
            actual, restored_size = digest(restored)
        if actual != expected or restored_size != size:
            raise ValueError('Archive restoration differs; original preserved: ' + str(source))
        current = source.stat()
        if (current.st_size, current.st_mtime_ns) != (before.st_size, before.st_mtime_ns):
            raise ValueError('Source changed during verification; original preserved')
        if temporary:
            if temporary.stat().st_blocks >= before.st_blocks:
                return None
            os.replace(temporary, target)
            temporary = None
        record = {
            'path': source.relative_to(vault).as_posix(),
            'archive': target.relative_to(vault).as_posix(),
            'bytes': size, 'compressedBytes': target.stat().st_size,
            'sha256': expected,
            'freedAllocatedBytes': max(0, (before.st_blocks - target.stat().st_blocks) * 512),
        }
        # Persist the verified restoration index before unlinking the redundant
        # plain-text copy. An interrupted run always retains usable source data.
        journal.write(json.dumps(record, ensure_ascii=False) + '\n')
        journal.flush()
        os.fsync(journal.fileno())
        source.unlink()
        return record
    finally:
        if temporary:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--minimum-bytes', type=int, default=32768)
    args = parser.parse_args()
    if args.minimum_bytes < 8192:
        parser.error('Use at least 8192 bytes; small exports should remain directly readable')
    index = VAULT / 'pcode-archives.jsonl'
    result = {'applied': args.apply, 'files': 0, 'bytes': 0, 'freedAllocatedBytes': 0}
    with index.open('a', encoding='utf-8') if args.apply else open(os.devnull, 'w') as journal:
        for source in (VAULT / 'extracted').rglob('*.pcode'):
            if source.is_symlink() or source.stat().st_size < args.minimum_bytes:
                continue
            if not args.apply:
                result['files'] += 1
                result['bytes'] += source.stat().st_size
                continue
            record = compact_file(source, VAULT, journal)
            if not record:
                continue
            result['files'] += 1
            result['bytes'] += record['bytes']
            result['freedAllocatedBytes'] += record['freedAllocatedBytes']
            if result['files'] % 2000 == 0:
                print(json.dumps(result), flush=True)
    print(json.dumps(result), flush=True)


if __name__ == '__main__':
    main()
