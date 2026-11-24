#!/usr/bin/env python3
"""Export the original book artwork with unopened purchase dialogs hidden."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile


ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / 'public/assets/original/reading-books'
SCRIPT = Path(__file__).resolve().parent
FFDEC = Path('/opt/jpexs/26.4.0/lib')
DIALOG_LAYERS = ['mc_1', 'mc_3', 'mc_no']
MODES = {'supplies': 'plain', 'library-chevalierclothbook': 'wrap'}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def replace_file(path, data):
    temporary = path.with_name(path.name + '.restored')
    temporary.write_bytes(data)
    temporary.replace(path)


def write_json(path, value):
    replace_file(path, (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode())


def restore():
    sources = json.loads((BOOKS / 'source.json').read_text())
    layouts = json.loads((BOOKS / 'layout.json').read_text())
    pending = [record for record in sources['sources'] if record['id'] in MODES
               and (record.get('hiddenDialogLayers') != DIALOG_LAYERS
                    or any(not (BOOKS / page['file']).is_file() or sha256(BOOKS / page['file']) != page['sha256']
                           for page in record['pages']))]
    if not pending:
        return

    with tempfile.TemporaryDirectory(prefix='mole-book-pages-') as directory:
        stage = Path(directory)
        classes = stage / 'classes'
        classes.mkdir()
        subprocess.run(['java', '-m', 'jdk.compiler/com.sun.tools.javac.Main', '-cp', str(FFDEC / 'ffdec_lib.jar'),
                        '-d', str(classes), str(SCRIPT / 'BookLayoutProbe.java'),
                        str(SCRIPT / 'ReadingBookExporter.java')], check=True)
        for record in pending:
            key = record['id']
            source = ROOT / 'local-assets/raw/root' / record['path']
            if sha256(source) != record['sourceSha256']:
                raise ValueError(f'Book source differs from the archive receipt: {key}')
            raw = stage / (key + '-raw')
            saved = stage / key
            raw.mkdir()
            selected = record.get('selectedFrames', list(range(record['frames'])))
            command = ['java', '-Djava.awt.headless=true', '-Xmx380m', '-cp', f'{classes}:{FFDEC}/*',
                       'ReadingBookExporter', str(source), str(record['sprite']), MODES[key],
                       ','.join(map(str, selected)), str(raw), ','.join(DIALOG_LAYERS)]
            probe = json.loads(subprocess.check_output(command, text=True, timeout=180).splitlines()[-1])
            layout_path = stage / (key + '.json')
            request = dict(files=[str(path) for path in raw.rglob('*.png')], selected=selected, probe=probe,
                           output=str(saved), layout=str(layout_path), pageFormat='png')
            subprocess.run(['node', str(SCRIPT / 'measure_library_pages.cjs')], input=json.dumps(request),
                           text=True, check=True, stdout=subprocess.DEVNULL)
            layout = json.loads(layout_path.read_text())
            if len(layout['frames']) != len(record['pages']):
                raise ValueError(f'Incomplete restored book: {key}')

            cover = BOOKS / key / 'cover.png'
            if cover.is_file():
                cover_frame = layout['frames'][0]
                bounds = cover_frame['rect']
                view = cover_frame['viewRect']
                crop = dict(left=round(view[0] - bounds[0]), top=round(view[1] - bounds[1]),
                            width=round(view[2]), height=round(view[3]))
                subprocess.run(['node', str(SCRIPT / 'crop_reading_covers.cjs')],
                               input=json.dumps([dict(source=str(saved / '1.png'),
                                                      destination=str(saved / 'cover.png'), rect=crop)]),
                               text=True, check=True, stdout=subprocess.DEVNULL)
                replace_file(cover, (saved / 'cover.png').read_bytes())
            for page in record['pages']:
                output = BOOKS / page['file']
                replace_file(output, (saved / output.name).read_bytes())
                page['sha256'] = sha256(output)
            layouts[key] = layout
            record['hiddenDialogLayers'] = DIALOG_LAYERS
            print(f'{key}: {len(record["pages"])} original pages restored')

    write_json(BOOKS / 'layout.json', layouts)
    write_json(BOOKS / 'source.json', sources)


if __name__ == '__main__':
    restore()
