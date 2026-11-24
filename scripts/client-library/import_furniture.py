#!/usr/bin/env python3
"""Export original placement art from the pinned local client archive."""
import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zlib

from amf3 import AMF3Reader
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
VAULT = ROOT / 'local-assets'
PUBLIC = ROOT / 'public/assets/original/furniture'
CONFIG = VAULT / 'extracted/root/dll/ClientConfigDLL.swf/binaryData/40_com.global.staticData.XMLInfo_itemXmlData_com.global.staticData.XMLInfo_itemXmlData.bin'
TASKS = VAULT / 'raw/root/resource/xml/task/TaskSummary.xml'
CATALOG = 'archive-catalog.json'
RECEIPT = 'original-furniture-import.json'
MUSIC_BOX = '160169'
MESSAGE_BOARD = '160131'
LAYERS = {
    'resource/goods/': ('house', {'1': 'floor', '2': 'floor', '4': 'wall'}),
    'resource/home/item/': ('garden', {'4': 'floor', '6': 'floor'}),
}
SPIRIT = re.compile(r'[魔摩]\s*[灵靈]|摩界|食人花[园園]|光明小[cｃ]|黑暗小[cｃ]|小[仙萌]草|璨[之殿]|magic[\s_-]*spirit', re.I)
SPIRIT_DECOR = {
    '1220285': '原摩灵怪物表中的食人花造型',
    '1220427': '摩灵幻境套装，摩法阶梯',
    **{str(item_id): '原 HomeSpecialGoods 配置的摩灵世界地图入口' for item_id in range(1220428, 1220436)},
    '1220436': '封印之地，原摩灵世界地图提示',
    '1220437': '摩灵幻境套装，摩幻大黄鸭',
    '161438': '小仙草剧情，Task1019 与 Task1020',
    '161439': '摩灵小萌剧情房型，远古鹦鹉螺',
    '161440': '小萌剧情，Task1020 与小屋家具调用 MoeSecretPanel',
    '161441': '摩灵黑龙剧情房型，寒心龙窟',
    **{str(item_id): '寒心龙窟成套摆设' for item_id in range(161442, 161447)},
    '161450': '摩灵中秋关卡绿豆沙月饼',
    '161451': '摩灵中秋关卡云腿月饼',
    '161452': '摩灵中秋关卡冰皮月饼',
    '161453': '摩灵中秋关卡蛋黄月饼',
    '161454': '摩灵中秋关卡紫薯月饼',
    '161463': '璨之花房的入口道具，原 GoodsLogic 与摩灵传说',
    '161464': '璨之花房的密室',
}


def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, value, pretty=False):
    temp = path.with_suffix(path.suffix + '.part')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2 if pretty else None) + '\n')
    temp.replace(path)


def related_rewards():
    rewards = {}
    for group in ET.parse(TASKS).getroot().iter('Group'):
        if SPIRIT.search(group.get('Name', '')):
            for task in group.iter('Task'):
                for item_id in re.findall(r'\d+', task.get('AwardIDList', '')):
                    rewards[item_id] = f'原摩灵传说任务奖励「{task.get("Name")}」'
    return rewards


def classify():
    archive = zlib.decompress(CONFIG.read_bytes())
    reader = AMF3Reader(archive)
    items = reader.read()
    if reader.offset != len(archive):
        raise ValueError('Original item configuration was not fully decoded.')
    existing = {item['sourceId'] for item in json.loads((PUBLIC / 'catalog.json').read_text())}
    existing.add(MESSAGE_BOARD)
    exclusions = {**related_rewards(), **SPIRIT_DECOR}
    jobs, excluded, backgrounds, missing, kept, placeholders = [], [], [], [], [], []
    for item_id, item in sorted(items.items(), key=lambda pair: int(pair[0])):
        source = item.get('typeObject', {}).get('resourePath')
        if source not in LAYERS:
            continue
        area, surfaces = LAYERS[source]
        name = item['name'].strip()
        layer = str(item.get('Layer'))
        row = dict(id=item_id, name=name, area=area, layer=layer)
        descriptor = f'{name} {item.get("Desc", "")}'
        reason = exclusions.get(item_id) or ('原物品名或描述属于摩灵主题' if SPIRIT.search(descriptor) else None)
        if reason:
            excluded.append(dict(row, reason=reason))
        elif layer not in surfaces:
            backgrounds.append(row)
        elif item_id in existing:
            kept.append(row)
        elif name in ('', '待定', '删除'):
            placeholders.append(row)
        else:
            sources = [f'root/{source}{kind}/{item_id}.swf' for kind in ('swf', 'icon')]
            placement, icon = (file if (VAULT / 'raw' / file).is_file() else '' for file in sources)
            if placement or icon:
                jobs.append(dict(row, surface=surfaces[layer], placement=placement, icon=icon))
            else:
                missing.append(row)
    return jobs, dict(excluded=excluded, roomAndGardenBackgrounds=backgrounds, availableBefore=kept,
                      placeholders=placeholders, missingArtwork=missing)


def render(work, jobs, ffdec_lib, workers):
    classes = work / 'classes'
    classes.mkdir(exist_ok=True)
    subprocess.run(['java', '-m', 'jdk.compiler/com.sun.tools.javac.Main', '-cp', str(ffdec_lib / 'ffdec_lib.jar'),
                    '-d', str(classes), str(Path(__file__).with_name('FurnitureExporter.java'))], check=True)
    classpath = f'{classes}:{ffdec_lib}/*'
    batches = [jobs[start:start + 96] for start in range(0, len(jobs), 96)]

    def export(batch):
        start, batch_jobs = batch
        plan = work / f'jobs-{start}.tsv'
        plan.write_text('\n'.join('\t'.join(row[key] for key in ('id', 'placement', 'icon')) for row in batch_jobs) + '\n')
        result = subprocess.run(
            ['java', '-Djava.awt.headless=true', '-Xmx320m', '-cp', classpath, 'FurnitureExporter',
             str(VAULT / 'raw'), str(plan), str(work / 'renders')],
            check=True, capture_output=True, text=True,
        )
        (work / f'render-{start}.log').write_text(result.stdout + result.stderr)
        outputs = {}
        for line in result.stdout.splitlines():
            if not line.startswith('OK\t'):
                continue
            _, item_id, source, mode, sprite, frame, zoom, png = line.split('\t')
            outputs[item_id] = dict(path=source, mode=mode, sprite=int(sprite),
                                    frame=int(frame), zoom=float(zoom), png=Path(png))
        print(f'Rendered batch {start + 1}/{len(batches)}: {len(outputs)}/{len(batch_jobs)}', flush=True)
        return outputs

    with ThreadPoolExecutor(max_workers=workers) as pool:
        return {item_id: result for batch in pool.map(export, enumerate(batches)) for item_id, result in batch.items()}


def pack(work, jobs, audit, renders):
    assets = work / 'archive'
    assets.mkdir(exist_ok=True)
    catalog, records, failures = [], [], []
    for job in jobs:
        item_id = job['id']
        result = renders.get(item_id)
        if result is None:
            failures.append({key: job[key] for key in ('id', 'name', 'area', 'placement', 'icon')})
            continue
        with Image.open(result['png']) as source:
            art = source.convert('RGBA')
        art = art.crop(art.getchannel('A').getbbox())
        width, height = art.size
        if item_id == MUSIC_BOX:
            output = work / 'music-box.png'
            art.save(output)
        else:
            output = assets / f'{item_id}.webp'
            art.save(output, lossless=True, method=4)
            edge = max(width, height)
            natural_edge = 82 if result['mode'] == 'icon' else edge / result['zoom']
            pixel_width = round(width / edge * min(320, max(55, natural_edge * 1.4)))
            catalog.append(dict(id=f'original-{item_id}', sourceId=item_id, name=job['name'],
                                surface=job['surface'], originalArea=job['area'], pixelWidth=max(16, pixel_width),
                                image=f'./assets/original/furniture/archive/{item_id}.webp'))
        records.append(dict(id=item_id, name=job['name'], area=job['area'], layer=job['layer'],
                            **{key: value for key, value in result.items() if key != 'png'},
                            sourceSha256=checksum(VAULT / 'raw' / result['path']),
                            image=output.relative_to(work).as_posix(), imageSha256=checksum(output), size=art.size))
    if not any(item['id'] == MUSIC_BOX for item in records):
        raise ValueError('The new music box artwork could not be rendered.')
    write_json(work / CATALOG, catalog)
    write_json(work / RECEIPT, dict(
        archiveRevision=json.loads((VAULT / 'source-status.json').read_text())['revision'],
        configuration=str(CONFIG.relative_to(VAULT)), configurationSha256=checksum(CONFIG),
        selection='小屋物品层 1、2、4；家园可摆放物品层 4、6。以原部署 mc2 静态画面为先，辅以原商品图标或根时间轴。',
        musicBoxSource=MUSIC_BOX, newlyAvailable=len(catalog), areaCounts=dict(Counter(row['originalArea'] for row in catalog)),
        renderModes=dict(Counter(row['mode'] for row in records)), **audit, unrenderable=failures, records=records,
    ), pretty=True)
    print(f'Prepared {len(catalog)} archive items and the replacement music box; {len(failures)} unrendered.', flush=True)


def install(work):
    catalog = json.loads((work / CATALOG).read_text())
    receipt = json.loads((work / RECEIPT).read_text())
    if checksum(CONFIG) != receipt['configurationSha256']:
        raise ValueError('The staged artwork was generated from a different item configuration.')
    for record in receipt['records']:
        if checksum(work / record['image']) != record['imageSha256']:
            raise ValueError(f'Incorrect staged artwork for {record["id"]}')
    destination = PUBLIC / 'archive'
    destination.mkdir(exist_ok=True)
    for item in catalog:
        name = f'{item["sourceId"]}.webp'
        shutil.copyfile(work / 'archive' / name, destination / name)
    shutil.copyfile(work / 'music-box.png', PUBLIC / 'music-box.png')
    write_json(PUBLIC / CATALOG, catalog, pretty=True)
    write_json(ROOT / 'src/archived-furniture-ids.json', [item['id'] for item in catalog], pretty=True)
    expected = {f'{item["sourceId"]}.webp' for item in catalog}
    for old in destination.glob('*.webp'):
        if old.stem.isdecimal() and old.name not in expected:
            old.unlink()
    shutil.copyfile(work / RECEIPT, ROOT / 'research' / RECEIPT)
    subprocess.run(['node', 'scripts/art/furniture-bounds.cjs'], cwd=ROOT, check=True)
    print(f'Installed {len(catalog)} archive items.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True, help='staging directory for the render and its receipt')
    parser.add_argument('--ffdec-lib', type=Path, default=Path('/opt/jpexs/26.4.0/lib'))
    parser.add_argument('--workers', type=int, default=2)
    parser.add_argument('--install', action='store_true', help='apply a completed render in the staging directory')
    args = parser.parse_args()
    work = args.work.resolve()
    work.mkdir(parents=True, exist_ok=True)
    if args.install:
        install(work)
    else:
        jobs, audit = classify()
        print(f'{len(jobs)} candidate items, {len(audit["excluded"])} themed exclusions.', flush=True)
        pack(work, jobs, audit, render(work, jobs, args.ffdec_lib, args.workers))


if __name__ == '__main__':
    main()
