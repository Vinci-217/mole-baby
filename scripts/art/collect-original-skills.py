#!/usr/bin/env python3
"""Retrieve the exact original SWFs identified in the original LamuNPC client.

Downloads public assets only; never runs Flash code or sends credentials to the
asset server. Results are independently validated before application use.
"""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import urllib.error
import urllib.request

OUT = Path('research/original-skill-cache')
BRANCH = 'codex/original-skill-resource-cache'


def collect(asset_id):
    attempts = []
    for scheme in ('https', 'http'):
        url = f'{scheme}://mole.61.com/resource/petcloth/swf2/{asset_id}.swf'
        try:
            request = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0', 'Referer': 'http://mole.61.com/',
            })
            with urllib.request.urlopen(request, timeout=20) as response:
                content = response.read(4 * 1024 * 1024 + 1)
            if len(content) > 4 * 1024 * 1024 or len(content) < 8 or content[:3] not in (b'FWS', b'CWS', b'ZWS'):
                attempts.append({'url': url, 'error': 'Not a bounded SWF asset'})
                continue
            declared = int.from_bytes(content[4:8], 'little')
            if declared < 8 or declared > 32 * 1024 * 1024:
                attempts.append({'url': url, 'error': 'Invalid SWF declared size'})
                continue
            path = OUT / 'raw' / f'{asset_id}.swf'
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(content)
            return {'id': asset_id, 'url': url, 'bytes': len(content),
                    'sha256': hashlib.sha256(content).hexdigest(), 'attempts': attempts}
        except Exception as error:
            attempts.append({'url': url, 'error': str(error)[:500]})
    return {'id': asset_id, 'attempts': attempts, 'available': False}


def publish():
    # A private index creates a cache-only branch without modifying the source
    # checkout or placing application files in the resource-cache history.
    with tempfile.TemporaryDirectory(prefix='mole-resource-index-') as folder:
        env = {**os.environ, 'GIT_INDEX_FILE': str(Path(folder) / 'index')}
        def git(*args, **kwargs):
            return subprocess.check_output(['git', *args], env=env, text=True, **kwargs).strip()
        parent = None
        exists = subprocess.run(['git', 'ls-remote', '--exit-code', '--heads', 'origin', f'refs/heads/{BRANCH}'], stdout=subprocess.DEVNULL).returncode == 0
        if exists:
            git('fetch', '--depth=1', 'origin', f'refs/heads/{BRANCH}')
            parent = git('rev-parse', 'FETCH_HEAD')
            git('read-tree', parent)
        else:
            git('read-tree', '--empty')
        git('add', '-f', str(OUT))
        tree = git('write-tree')
        args = ['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit-tree', tree]
        if parent:
            args += ['-p', parent]
        commit = git(*args, '-m', 'Record original skill resource retrieval')
        git('push', 'origin', f'{commit}:refs/heads/{BRANCH}')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        assets = list(executor.map(collect, range(1208000, 1208018)))
    report = {'source': 'Original ClientAppDLL com.module.npc.npcInstance.LamuNPC.useLamuSkill',
              'formula': '1208000 + type - 1 + (level - 1) * 3; fire=1, water=2, wood=3',
              'run': f"https://github.com/{os.environ.get('GITHUB_REPOSITORY', '')}/actions/runs/{os.environ.get('GITHUB_RUN_ID', '')}",
              'assets': assets}
    (OUT / 'report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(f"Retrieved {sum('sha256' in asset for asset in assets)}/{len(assets)} original SWFs")
    if os.environ.get('MOLE_PUBLISH_RESOURCE_REPORT') == '1':
        publish()
