"""Produce versioned optional resource archives from a verified desktop build.

Pass --verify-only to create and read back every archive in temporary storage.
Regular mode leaves the ZIPs and their manifest ready for GitHub Release assets.
"""
import argparse
from collections import defaultdict
from contextlib import nullcontext
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import tempfile
import zipfile


MAX_PACK_BYTES = 32 * 1024 * 1024
GITHUB_RELEASES = 'https://github.com/Vinci-217/mole-baby/releases/download'
OPTIONAL_EXTENSIONS = {'.webp', '.png', '.jpg', '.jpeg', '.mp3', '.ogg', '.swf'}


def feature_for(name, outfit_sources):
    parts = PurePosixPath(name).parts
    if PurePosixPath(name).suffix not in OPTIONAL_EXTENSIONS:
        return None
    if name in outfit_sources:
        return 'wardrobe', 'original-outfits'
    if parts[:3] == ('assets', 'original', 'reading-books') and len(parts) >= 5:
        return 'books', parts[3]
    if parts[:3] == ('assets', 'original', 'audio') and name.endswith('.mp3'):
        # Game cues live under a separate directory.
        return 'music', 'room-tracks'
    if parts[:3] == ('assets', 'original', 'scenes') and re.fullmatch(r'(?:room-\d+|original-earthen-home|lake-cabin|mystery-flower-sea)\.(?:webp|png)', parts[-1]):
        if parts[-1].startswith('mystery-flower-sea'):
            return None  # Default room background.
        return 'backgrounds', 'original-rooms'
    if parts[:2] == ('assets', 'generated') and re.fullmatch(r'(?:v6-starlight-greenhouse|v6-creek-treehouse|v18-berry-picnic|v18-seashell-cottage|v18-sky-observatory)\.(?:webp|png)', parts[-1]):
        return 'backgrounds', 'extra-rooms'
    if parts[:3] == ('assets', 'original', 'furniture-actions') and len(parts) >= 5:
        return 'furniture', parts[3]
    if parts[:3] == ('assets', 'original', 'element-skills') and not parts[-2] == 'icons':
        return 'actions', 'element-skills'
    if parts[:3] == ('assets', 'original', 'uploaded-actions') and len(parts) >= 5:
        match = re.fullmatch(r'([a-z]+)-(tuya[234]|1800(?:11|12|13|23|26|97))', parts[3])
        if match:
            return 'actions', match[2]
    return None


def digest(file):
    checksum = hashlib.sha256()
    for block in iter(lambda: file.read(1024 * 1024), b''):
        checksum.update(block)
    return checksum.hexdigest()


def batches(entries):
    batch, size = [], 0
    for entry in entries:
        if batch and size + entry['bytes'] > MAX_PACK_BYTES:
            yield batch
            batch, size = [], 0
        batch.append(entry)
        size += entry['bytes']
    if batch:
        yield batch


def write_pack(root, target, entries):
    # The installed images and audio already use compressed formats. Fixed
    # ZIP metadata lets the same build produce byte-identical mirror copies.
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_STORED) as archive:
        for entry in entries:
            filename = entry['path']
            info = zipfile.ZipInfo(filename)
            info.create_system = 3
            info.external_attr = 0o600 << 16
            info.file_size = entry['bytes']
            with (root / filename).open('rb') as source, archive.open(info, 'w') as output:
                while block := source.read(1024 * 1024):
                    output.write(block)
    with zipfile.ZipFile(target) as archive:
        if archive.namelist() != [entry['path'] for entry in entries]:
            raise ValueError(f'Archive file list mismatch: {target.name}')
        for entry in entries:
            with archive.open(entry['path']) as file:
                if archive.getinfo(entry['path']).file_size != entry['bytes'] or digest(file) != entry['sha256']:
                    raise ValueError(f'Archive data mismatch: {entry["path"]}')
    with target.open('rb') as file:
        return {'bytes': target.stat().st_size, 'sha256': digest(file)}


def book_pages(target):
    with zipfile.ZipFile(target) as archive, target.open('rb') as data:
        pages = []
        for info in archive.infolist():
            if info.compress_type != zipfile.ZIP_STORED:
                raise ValueError(f'Book pages must be stored directly in {target.name}')
            data.seek(info.header_offset + 26)
            filename_bytes, extra_bytes = struct.unpack('<HH', data.read(4))
            pages.append(dict(file=PurePosixPath(info.filename).name, bytes=info.file_size,
                              offset=info.header_offset + 30 + filename_bytes + extra_bytes))
        return pages


def build(root, output, verify_only, books_only=False):
    catalog = json.loads((root / 'offline-resources.json').read_bytes())
    originals = json.loads((root / 'assets/original/official/manifest.json').read_bytes())
    outfits = {'assets/original/official/files/' + clip['path'] for clip in originals['clips'] if clip['kind'] == 'outfit'}
    revision = catalog['revision']
    if catalog['schema'] != 1 or not re.fullmatch(r'[a-f0-9]{24}', revision):
        raise ValueError('Invalid installed resource manifest')
    by_feature, base, seen = defaultdict(list), [], set()
    for entry in sorted(catalog['files'], key=lambda row: row['path']):
        name = entry['path']
        if not name or name.startswith('/') or any(part in ('', '.', '..') for part in name.split('/')) or '\\' in name or name in seen:
            raise ValueError(f'Unsafe or duplicate installed path: {name}')
        seen.add(name)
        feature = feature_for(name, outfits)
        if feature and (not books_only or feature[0] == 'books'):
            by_feature[feature].append(entry)
        else:
            base.append(entry)

    tag = 'assets-' + revision
    packs = []
    output.mkdir(parents=True, exist_ok=True)
    for (group, feature), entries in sorted(by_feature.items()):
        if not re.fullmatch(r'[a-z0-9-]+', feature):
            raise ValueError(f'Invalid feature name: {feature}')
        for part, files in enumerate(batches(entries), 1):
            name = f'{group}-{feature}-{part}.zip'
            with tempfile.TemporaryDirectory(prefix='mole-resource-') if verify_only else nullcontext(output) as directory:
                archive = Path(directory) / name
                meta = write_pack(root, archive, files)
                if books_only:
                    meta['pages'] = book_pages(archive)
            packs.append(dict(group=group, feature=feature, part=part, name=name, files=files, **meta))
    if books_only:
        catalogue = json.loads((root / 'assets/original/reading-books/catalog.json').read_bytes())
        # Program-only edits must keep the same asset tag. The pack checksums
        # also let installed clients keep individual volumes across book sets.
        signature = [[pack['name'], pack['bytes'], pack['sha256']] for pack in packs]
        identity = json.dumps([signature, sorted(book['id'] for book in catalogue)], separators=(',', ':'))
        tag = 'assets-' + hashlib.sha256(identity.encode()).hexdigest()[:24]
    for pack in packs:
        pack['url'] = f'{GITHUB_RELEASES}/{tag}/{pack["name"]}'
    base_bytes = sum(entry['bytes'] for entry in base)
    optional_bytes = sum(file['bytes'] for pack in packs for file in pack['files'])
    if base_bytes + optional_bytes != catalog['bytes'] or len(base) + sum(len(pack['files']) for pack in packs) != len(seen):
        raise ValueError('The packs and base must partition every installed file')
    plan = dict(schema=1, revision=revision, githubReleaseTag=tag, baseBytes=base_bytes, optionalBytes=optional_bytes,
                base=base, packs=packs)
    (output / 'resource-packs.json').write_bytes(encode(plan) + b'\n')
    print(f'{len(base)} base files, {len(packs)} verified optional ZIPs, {base_bytes} base bytes, {optional_bytes} optional bytes')
    return plan


def build_book_index(source, plan):
    catalogue = json.loads((source / 'assets/original/reading-books/catalog.json').read_bytes())
    by_id = {pack['feature']: pack for pack in plan['packs'] if pack['part'] == 1}
    books = []
    for book in sorted(catalogue, key=lambda item: item['id']):
        pack = by_id[book['id']]
        expected = {PurePosixPath(file).stem for file in book['pages']}
        if not expected <= {PurePosixPath(page['file']).stem for page in pack['pages']}:
            raise ValueError(f'Incomplete book archive: {book["id"]}')
        books.append(dict(id=book['id'], bytes=pack['bytes'], sha256=pack['sha256'], pages=pack['pages']))
    return encode(dict(schema=1, release=plan['githubReleaseTag'], books=books))


def encode(data):
    return json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()


def write_light_renderer(source, target, base, manifest):
    index = json.loads(manifest)
    catalogue = json.loads((source / 'assets/original/reading-books/catalog.json').read_bytes())
    books = {book['id']: book for book in index['books']}
    if index['schema'] != 1 or not re.fullmatch(r'assets-[a-f0-9]{24}', index['release']) or books.keys() != {book['id'] for book in catalogue}:
        raise ValueError('Book source does not match the local catalogue')
    for book in catalogue:
        if not {PurePosixPath(file).stem for file in book['pages']} <= {PurePosixPath(page['file']).stem for page in books[book['id']]['pages']}:
            raise ValueError(f'Incomplete canonical book: {book["id"]}')
    target.mkdir(parents=True)
    changes = {}
    html = (source / 'index.html').read_bytes()
    if b'<head>' not in html:
        raise ValueError('Missing renderer head')
    changes['index.html'] = html.replace(b'<head>', b'<head><meta name="ramu-book-packs" content="1">', 1)
    if (source / 'sw.js').is_file():
        worker = (source / 'sw.js').read_text(encoding='utf-8')
        match = re.search(r'(?m)^const CONFIG=(\{[^\r\n]+\});$', worker)
        if not match:
            raise ValueError('Missing PWA worker configuration')
        config = json.loads(match[1])
        config['shell'].append('book-packs.json')
        config['version'] = hashlib.sha256((config['version'] + index['release']).encode()).hexdigest()[:24]
        changes['sw.js'] = (worker[:match.start(1)] + encode(config).decode() + worker[match.end(1):]).encode()
    for entry in base:
        if entry['path'] in changes:
            continue
        src, dest = source / entry['path'], target / entry['path']
        dest.parent.mkdir(parents=True, exist_ok=True)
        try:
            os.link(src, dest)
        except OSError:
            shutil.copyfile(src, dest)

    changes['book-packs.json'] = manifest
    entries = [entry for entry in base if entry['path'] not in changes]
    for name, content in changes.items():
        (target / name).write_bytes(content)
        entries.append(dict(path=name, bytes=len(content), sha256=hashlib.sha256(content).hexdigest()))
    entries.sort(key=lambda entry: entry['path'])
    index = dict(schema=1, revision=hashlib.sha256(encode(entries)).hexdigest()[:24],
                 bytes=sum(entry['bytes'] for entry in entries), files=entries)
    (target / 'offline-resources.json').write_bytes(encode(index))
    print(f'Light renderer: {len(books)} books on demand; {index["bytes"]} installed bytes.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('renderer', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--verify-only', action='store_true')
    parser.add_argument('--light-renderer', type=Path, help='Build book packs and a separate renderer with book pages supplied on demand.')
    parser.add_argument('--book-index', type=Path, help='Use the release’s existing book index without recreating the archives.')
    args = parser.parse_args()
    if args.light_renderer and args.light_renderer.exists():
        parser.error('--light-renderer requires a new directory')
    if args.book_index:
        if not args.light_renderer:
            parser.error('--book-index requires --light-renderer')
        installed = json.loads((args.renderer / 'offline-resources.json').read_bytes())
        base = [entry for entry in installed['files']
                if (feature_for(entry['path'], set()) or ('base',))[0] != 'books']
        write_light_renderer(args.renderer, args.light_renderer, base, args.book_index.read_bytes())
    else:
        plan = build(args.renderer, args.output, args.verify_only, books_only=bool(args.light_renderer))
        if args.light_renderer:
            manifest = build_book_index(args.renderer, plan)
            write_light_renderer(args.renderer, args.light_renderer, plan['base'], manifest)
            (args.output / 'book-packs.json').write_bytes(manifest)
