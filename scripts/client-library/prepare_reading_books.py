#!/usr/bin/env python3
"""Prepare the original six books, then restore the complete furniture library."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VAULT = ROOT / 'local-assets'
OUT = ROOT / 'public/assets/original/reading-books'
ORDER = ['supplies', 'life', 'study', 'food', 'classroom', 'secret']
catalog = json.loads((VAULT / 'ram-inventory/catalog.json').read_text())
books = {row['book']['key']: row for row in catalog['items'] if row.get('book')}
result, sources = [], []
OUT.mkdir(parents=True, exist_ok=True)
for key in ORDER:
    row = books[key]
    book = row['book']
    if len(book['pages']) != book['frames']:
        raise ValueError('Incomplete book: ' + key)
    pages, checksums = [], []
    for index, page in enumerate(book['pages'], 1):
        original = VAULT / page.lstrip('/')
        destination = OUT / key / f'{index}.png'
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.read_bytes() != original.read_bytes():
            shutil.copyfile(original, destination)
        digest = hashlib.sha256(destination.read_bytes()).hexdigest()
        pages.append(f'./assets/original/reading-books/{key}/{index}.png')
        checksums.append(dict(file=f'{key}/{index}.png', sha256=digest))
    result.append(dict(id=key, title=row['title'], description=book['description'], pages=pages,
                       cover=pages[0], source=row['path']))
    receipt = json.loads((VAULT / 'ram-inventory/books' / key / 'render-source.json').read_text())
    sources.append(dict(id=key, path=row['path'], sourceSha256=receipt['sourceSha256'],
                        sprite=book['sprite'], symbol=book['symbol'], frames=book['frames'], pages=checksums))
(OUT / 'catalog.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
(ROOT / 'src/reading-book-page-counts.json').write_text(json.dumps({book['id']: len(book['pages']) for book in result}, indent=2)+'\n')
(OUT / 'source.json').write_text(json.dumps(dict(
    sources=sources, artwork='原客户端 SWF 的静态画面，保留非透明像素，仅裁去透明外边缘。',
    adaptation='家具书架、原书页角透明点击区与阅读进度为本地适配；以原书本边界约束静态导出的文字溢出，PNG 原像素不改写；原书页中的购买按钮仅为画面。',
    rights='原素材归淘米等原权利方；不改变原始素材权属。'), ensure_ascii=False, indent=2)+'\n')
# Geometry must exist for the base books before the extension assembles all books.
# Keeping this in the public entry point prevents a later refresh from silently
# reducing the live catalog back to six books.
for script in ['prepare_reading_layout.py', 'extend_reading_library.py']:
    subprocess.run([sys.executable, str(ROOT / 'scripts/client-library' / script)], check=True)
complete = json.loads((OUT / 'catalog.json').read_text())
print(json.dumps(dict(books=len(complete), pages=sum(len(book['pages']) for book in complete),
                     bytes=sum(p.stat().st_size for p in OUT.rglob('*') if p.is_file()))))
