#!/usr/bin/env python3
"""Index the existing Ram archives without fetching or copying their originals."""
import collections
import csv
import datetime
import hashlib
import json
import re
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

from collect_ram_official import item_config

ROOT = Path(__file__).resolve().parents[2]
VAULT = ROOT / 'local-assets'
OUT = VAULT / 'ram-inventory'
OFFICIAL = 'ram-official-sweep/2026-11-06/'
RAM = re.compile(r'lamu|lahm|lamoon|ramu|拉姆|超拉', re.I)
DIRECT = re.compile(r'(?:^|/)(?:pet[^/]*|lamu[^/]*|lahm[^/]*|super(?:pet|lamu|lahm)[^/]*|slpet[^/]*)(?:/|\.|$)', re.I)
BOOKS = [
    dict(key='life', path='module/external/BooksUI/petInfoView.swf', title='拉姆生活手册',
         subtitle='封面：拉姆生活 · 关于拉姆的一切', sprite=366, frames=10,
         symbol='petInfoView_fla.bookUI_1',
         description='生活、照料与成长说明；原客户端从宠物店打开。',
         evidence='extracted/root/dll/ClientAppDLL.swf/scripts/com/view/mapView/petmapView.as', line=210),
    dict(key='study', path='module/external/BooksUI/petStudyBook.swf', title='拉姆学习手册',
         subtitle='学院里的学习指南', sprite=186, frames=10,
         symbol='petStudyBook_fla.bookUI_1',
         description='原客户端从菩提大伯处打开的学习手册。',
         evidence='extracted/root/dll/ClientAppDLL.swf/scripts/com/view/mapView/PutiPoppaMapView.as', line=400),
    dict(key='supplies', path='module/house/petBookView.swf', title='拉姆手册',
         subtitle='封面：拉姆手册 · 宠物用品目录', sprite=201, frames=8,
         symbol='petBookView_fla.bookUI_1',
         description='封面题名“拉姆手册”。内容是书页形式的拉姆用品商店；原代码加载提示为“正在打开宠物用品”。',
         evidence='extracted/root/dll/ClientAppDLL.swf/scripts/com/view/mapView/petmapView.as', line=279),
    dict(key='secret', path='resource/besmearBook/SLPetSecret.swf', title='超级拉姆的秘密',
         subtitle='超级拉姆相关书页', sprite=0, frames=18, symbol='',
         description='原客户端以“正在打开超拉的秘密”加载；保留原文件全部根时间轴画面。',
         evidence='extracted/root/dll/ClientAppDLL.swf/scripts/com/module/activityModule/superPetLogin.as', line=136),
    dict(key='classroom', path='module/external/BooksUI/lahmClassRoomBook.swf', title='拉姆小导师',
         subtitle='封面：拉姆小导师 · 教室书籍', sprite=590, frames=12,
         symbol='lahmClassRoomBook_fla.bookUI_1',
         description='封面题名“拉姆小导师”。原代码通过拉姆教室的书本按钮打开。',
         evidence=OFFICIAL+'current-app-scripts/com/module/lahmClassRoom/lahmClassRoomUI.as', line=444),
    dict(key='food', path='resource/pet/petFoodBook/petFoodBook.swf', title='拉姆食谱',
         subtitle='petFoodBook · 食物书', sprite=305, frames=19,
         symbol='petFoodBook_fla.bookUI_1',
         description='原客户端加载提示为“正在打开拉姆食谱”。',
         evidence='extracted/root/dll/ClientAppDLL.swf/scripts/com/view/mapView/foodView.as', line=215),
]
BOOK_BY_PATH = {book['path']: book for book in BOOKS}
CATEGORIES = ['书籍与手册', '角色与成长', '装扮与变身', '道具与互动', '课堂与学习',
              '魔法与战斗', '界面与小游戏', '场景与剧情', '图标与物品图案', '音乐与音效',
              '配置与共享代码', '其他相关素材', '摩尔服饰与手持物', '家具与装饰']


def category(path, official_category=''):
    p = path.lower()
    if path in BOOK_BY_PATH:
        return CATEGORIES[0]
    if p.endswith('.mp3'):
        return CATEGORIES[9]
    if p.endswith('.xml') or p.startswith('dll/'):
        return CATEGORIES[10]
    if '/icon/' in p or '/previcon/' in p or '/alertpic/' in p:
        return CATEGORIES[8]
    if '/petcloth/body/' in p or re.search(r'/petcloth/swf2/pet\d+/', p):
        return CATEGORIES[5]
    if '/cloth/' in p:
        return CATEGORIES[12]
    if '/goods/' in p or '/home/' in p:
        return CATEGORIES[13]
    if '/petcloth/' in p or '/lamuworldconvert/' in p:
        return CATEGORIES[2]
    if '/lahmclassroom/' in p or '/pethonor/' in p:
        return CATEGORIES[4]
    if '/lamupksys/' in p or '/petskill/' in p:
        return CATEGORIES[5]
    if 'lamubone' in p or '/pet/avatar/' in p:
        return CATEGORIES[1]
    if '/pet/' in p:
        return CATEGORIES[3]
    if p.startswith('module/'):
        return CATEGORIES[6]
    if '/map/' in p or '/movie/' in p or '场景' in official_category:
        return CATEGORIES[7]
    return CATEGORIES[11]


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f'file:{VAULT}/catalog.sqlite?mode=ro', uri=True) as db:
        db.row_factory = sqlite3.Row
        pinned = {r['path'].removeprefix('root/'): dict(r) for r in db.execute('SELECT * FROM assets')}
    sweep = json.loads((VAULT / OFFICIAL / 'catalog.json').read_text())
    official = {r['path']: r for r in sweep['items']}
    candidates = {}

    def add(path, reason, name=None, shared=False):
        row = candidates.setdefault(path, dict(path=path, names=[], evidence=[], shared=shared))
        if reason not in row['evidence']:
            row['evidence'].append(reason)
        if name and name not in row['names']:
            row['names'].append(name)
        row['shared'] = row['shared'] and shared

    for path, row in pinned.items():
        if DIRECT.search(path) or RAM.search(path):
            add(path, dict(type='archive-path', source=row['path']))
        elif RAM.search(row.get('search') or '') or re.search(r'\blevel101(?:_|\b)|\bbibo\b', row.get('search') or '', re.I):
            add(path, dict(type='archive-symbol-or-rig', source=row['path']), shared=True)
    for path, row in official.items():
        for reason in row['evidence']:
            add(path, reason, shared=not bool(DIRECT.search(path) or RAM.search(path)))
        for name in row.get('names', []) + row.get('aliases', []):
            add(path, dict(type='supplement-name', source=OFFICIAL+'catalog.json'), name,
                shared=not bool(DIRECT.search(path) or RAM.search(path)))

    # Names alone are not enough: a numbered original must also belong to the
    # exact resource prefix in that item's original configuration.
    config_names = collections.defaultdict(set)
    by_stem = collections.defaultdict(list)
    for path in pinned:
        by_stem[Path(path).stem].append(path)
    for relative in ['raw/root/dll/ClientConfigDLL.swf', OFFICIAL+'bootstrap/dll/ClientConfigDLL.swf']:
        table = item_config((VAULT / relative).read_bytes())
        for key, item in table.items():
            ident = str(item.get('ItemID', item.get('id', key)))
            name = item.get('name', item.get('Name', ''))
            if name:
                config_names[ident].add(name)
            kind = item.get('typeObject', {})
            if not RAM.search(name):
                continue
            prefixes = [kind.get('path', ''), kind.get('resourePath', '')]
            for path in by_stem[ident]:
                if any(prefix and path.startswith(prefix) for prefix in prefixes):
                    add(path, dict(type='item-name-and-resource-prefix', source=relative,
                                   itemId=ident, name=name), name)

    # Shared XML tables remain visibly marked as context, not pure Ram artwork.
    for path, row in pinned.items():
        if row['kind'] != 'xml':
            continue
        text = (VAULT / 'raw' / row['path']).read_text(errors='replace')
        match = RAM.search(text)
        if match:
            add(path, dict(type='xml-text', source=row['path'],
                           excerpt=text[max(0, match.start()-45):match.end()+65]), shared=True)

    # Follow the archive's named scene/music mapping; these tracks are shared
    # with other scenes too. Do not label them as exclusive Ram music.
    music_map = 'root/resource/bgSounds/对应表.xml'
    for line in (VAULT / 'raw' / music_map).read_text().splitlines():
        if not RAM.search(line):
            continue
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', line))
        title = re.search(r'<!--(.*?)-->', line)
        title = title.group(1) if title else '拉姆相关场景'
        map_id = attrs.get('id')
        if map_id:
            scene = f'resource/map/{map_id}.swf'
            if scene in pinned:
                add(scene, dict(type='named-scene-map', source=music_map, excerpt=line.strip()), title, shared=True)
        for token in attrs.get('musicId', '').split(','):
            token = token.split(':')[0]
            music = f'resource/bgSounds/{token}.mp3'
            if music in pinned:
                add(music, dict(type='named-scene-music', source=music_map, excerpt=line.strip()), title+' · '+token, shared=True)

    for book in BOOKS:
        add(book['path'], dict(type='book-caller', source=book['evidence'], line=book['line']), book['title'])
    for path in ['dll/ClientAppDLL.swf', 'dll/ClientConfigDLL.swf', 'dll/ClientCommonDLL.swf']:
        if path in pinned:
            add(path, dict(type='shared-client-code', source='原客户端拉姆模块调用与配置'), shared=True)

    items, unavailable = [], []
    for path, candidate in sorted(candidates.items()):
        old, new = pinned.get(path), official.get(path)
        variants = []
        if old:
            variants.append(dict(key='archive', name='固定客户端存档', url='/raw/'+old['path'],
                                 timeline='/timelines/'+old['path']+'.json' if old['kind']=='swf' else None,
                                 bytes=old['bytes'], hashType='Git blob SHA-1', hash=old['sha'],
                                 pinnedPath=old['path']))
        if new and new.get('status') == 'official-ok':
            variant = dict(key='official', name='官方补录 · 2026-11-06',
                           url='/'+OFFICIAL+new['fileUrl'], timeline='/'+OFFICIAL+new['timelineUrl'],
                           bytes=new['bytes'], hashType='SHA-256', hash=new['sha256'],
                           sameAsArchive=new.get('sameAsPinnedArchive', False))
            variants.append(variant)
        if not variants:
            unavailable.append(dict(path=path, names=candidate['names'], category=category(path),
                                    status=new.get('status') if new else 'not-archived',
                                    httpStatus=new.get('httpStatus') if new else None,
                                    evidence=candidate['evidence']))
            continue
        primary = variants[0]
        metadata = {}
        if primary['timeline']:
            metadata = json.loads((VAULT / primary['timeline'].lstrip('/')).read_text())
        names = list(candidate['names'])
        for name in sorted(config_names.get(Path(path).stem, [])):
            if name not in names:
                names.append(name)
        book = BOOK_BY_PATH.get(path)
        labels = sorted({label['name'] for timeline in metadata.get('timelines', []) for label in timeline['labels']})
        symbols = sorted(set(metadata.get('symbols', {}).values()))
        row = dict(path=path, title=book['title'] if book else (names[0] if names else Path(path).stem),
                   names=names, category=category(path, (new or {}).get('category', '')),
                   relation='共享文件中含相关内容' if candidate['shared'] else '拉姆资源／相关物品',
                   kind=Path(path).suffix.lstrip('.'), bytes=primary['bytes'], variants=variants,
                   sourceCount=len(variants), labels=labels, symbols=symbols,
                   multiFrame=sum(t['frames']>1 for t in metadata.get('timelines', [])),
                   images=metadata.get('hasImages', 0), sounds=metadata.get('hasSound', 0),
                   scripts=metadata.get('hasScripts', 0), evidence=candidate['evidence'])
        if book:
            row['book'] = {**book, 'pages': []}
            directory = OUT / 'books' / book['key'] / 'pages'
            if directory.exists():
                row['book']['pages'] = ['/ram-inventory/'+p.relative_to(OUT).as_posix()
                                        for p in sorted(directory.glob('*.png'), key=lambda p:int(p.stem))]
            row['book']['cover'] = row['book']['pages'][0] if row['book']['pages'] else None
        if path.startswith('resource/cloth/'):
            row['note'] = '这是摩尔角色使用的拉姆主题服饰或手持物，按原配置名称关联。'
        # The magic-book outfit is a separate source, not another handbook.
        if Path(path).stem == '1200026':
            row['note'] = '魔法书装扮／读书动作；不属于手册书页。'
        items.append(row)

    counts = collections.Counter(row['category'] for row in items)
    summary = dict(savedPaths=len(items), sourceVersions=sum(len(r['variants']) for r in items),
                   changedPaths=sum(len(r['variants'])>1 and not r['variants'][-1].get('sameAsArchive') for r in items),
                   archivePaths=sum(any(v['key']=='archive' for v in r['variants']) for r in items),
                   officialPaths=sum(any(v['key']=='official' for v in r['variants']) for r in items),
                   unavailablePaths=len(unavailable), books=len(BOOKS),
                   bookFrames=sum(b['frames'] for b in BOOKS),
                   categories=[dict(name=c, count=counts[c]) for c in CATEGORIES if counts[c]],
                   kinds=dict(collections.Counter(row['kind'] for row in items)))
    catalog = dict(createdAt=datetime.datetime.now(datetime.timezone.utc).isoformat(), summary=summary,
                   scope='合并本机固定客户端存档、2026-11-06 官方拉姆补录、物品配置名称与资源前缀、符号／骨骼和 XML／场景音乐引用。按原始路径归并，保留来源版本。覆盖已保存且能确认关联的素材；不代表官方全部历史版本。',
                   archiveCommit='7a6d6b3c7037a85afb28ad6abd4d7f4adfddb5ff',
                   items=items)
    save_json(OUT / 'catalog.json', catalog)
    save_json(OUT / 'unavailable.json', dict(count=len(unavailable), note='候选路径记录，不计入已保存素材；不会在线重试。', items=unavailable))
    with (OUT / 'catalog.csv').open('w', encoding='utf-8-sig', newline='') as stream:
        fields = ['名称', '分类', '原始路径', '格式', '关联范围', '来源', '版本数', '多帧时间轴数', '内嵌位图标签数', '内嵌声音标签数', '名称与别名', '动作标签', '原件位置', '核对依据']
        writer = csv.writer(stream)
        writer.writerow(fields)
        for r in items:
            values = [r['title'], r['category'], r['path'], r['kind'], r['relation'],
                      ' / '.join(v['name'] for v in r['variants']), len(r['variants']), r['multiFrame'], r['images'], r['sounds'],
                      ' / '.join(r['names']), ' / '.join(r['labels']), ' | '.join(v['url'] for v in r['variants']),
                      json.dumps(r['evidence'], ensure_ascii=False)]
            # CSV consumers may execute formula-like names. Preserve readable
            # text while preventing interpretation as an Excel formula.
            writer.writerow(["'"+v if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v for v in values])
    report = ['# 拉姆相关本地素材清单', '', f'整理时间：{catalog["createdAt"]}', '', catalog['scope'], '',
              f'- 已保存：{summary["savedPaths"]:,} 条原始路径，{summary["sourceVersions"]:,} 个来源记录。相同路径归并展示，字节不同的版本保留。',
              f'- 书籍：{summary["books"]} 份，共 {summary["bookFrames"]} 个原时间轴画面（包含封面／封底／过渡，不等同于印刷页码）。',
              f'- 未取得候选：{len(unavailable)} 条，单列于 unavailable.json，不计入已保存数。',
              '- 一个 SWF 可能含多幅位图、矢量元件、音效和脚本；这里以源文件为清单单位，不把每个组件称为一套完整动画。',
              '- 书页为原 SWF 指定时间轴的静态渲染，仅裁去全透明外边缘。交互购买、账号状态及依赖客户端的数据不在静态页中执行。', '',
              '## 书籍与手册', '', '| 名称 | 原始路径 | 时间轴画面 | 依据 |', '| --- | --- | ---: | --- |']
    for b in BOOKS:
        report.append(f'| {b["title"]} | `{b["path"]}` | {b["frames"]} | `{b["evidence"]}:{b["line"]}` |')
    report += ['', '魔法书装扮 `resource/petcloth/swf2/1200026.swf` 是拿书／读书动作，另归装扮类。', '',
               '## 分类', '', '| 分类 | 源路径数 |', '| --- | ---: |']
    report += [f'| {c["name"]} | {c["count"]} |' for c in summary['categories']]
    report += ['', '## 完整已保存清单', '', '| 名称 | 分类 | 原始路径 |', '| --- | --- | --- |']
    for r in items:
        title = r['title'].replace('|', '／').replace('\n', ' ')
        report.append(f'| {title} | {r["category"]} | `{r["path"]}` |')
    (OUT / 'README.md').write_text('\n'.join(report)+'\n')
    for source, destination in [('ram-inventory.html', 'index.html'), ('ram-inventory-preview.html', 'preview.html')]:
        shutil.copyfile(ROOT / 'scripts/client-library' / source, OUT / destination)
    print(json.dumps(summary, ensure_ascii=False))
    return catalog


def render_books(catalog):
    for row in catalog['items']:
        book = row.get('book')
        if not book:
            continue
        target = OUT / 'books' / book['key']
        source = VAULT / row['variants'][0]['url'].lstrip('/')
        receipt_path = target / 'render-source.json'
        sha = hashlib.sha256(source.read_bytes()).hexdigest()
        if receipt_path.exists():
            receipt = json.loads(receipt_path.read_text())
            if receipt.get('sourceSha256') == sha and len(list((target/'pages').glob('*.png'))) == book['frames']:
                continue
        scratch = target / 'render-work'
        scratch.mkdir(parents=True, exist_ok=True)
        command = ['java', '-Xmx300m', '-Djava.awt.headless=true', '-cp',
                   str(VAULT/'tools')+':/opt/jpexs/26.4.0/lib/*', 'SourceExporter',
                   'frame', str(source), str(scratch), str(book['sprite']), '-1', '1']
        subprocess.run(command, check=True, timeout=90, stdout=subprocess.DEVNULL)
        originals = sorted(scratch.rglob('*.png'), key=lambda p:int(p.stem))
        if len(originals) != book['frames']:
            raise ValueError('Book frame count differs: '+book['path'])
        request = dict(files=[dict(source=str(p), destination=str(target/'pages'/p.name)) for p in originals])
        subprocess.run(['node', str(ROOT/'scripts/client-library/trim_ram_pages.cjs')],
                       input=json.dumps(request), text=True, check=True, timeout=90)
        save_json(receipt_path, dict(source=row['variants'][0]['url'], sourceSha256=sha,
                                    sprite=book['sprite'], symbol=book['symbol'], frames=book['frames'],
                                    exporter='JPEXS 26.4.0 FrameExporter; zoom 1; no ActionScript execution',
                                    adaptation='Crop only fully transparent margins; preserve every nonzero-alpha pixel.',
                                    command=command))
        # Only this invocation's disposable render intermediates are removed.
        shutil.rmtree(scratch)


if __name__ == '__main__':
    catalog = build()
    if '--render-books' in sys.argv:
        render_books(catalog)
        build()
