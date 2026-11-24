"""Build and verify a Mac test image from an already checked application ZIP."""
from hashlib import file_digest
import json
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess
from tempfile import TemporaryDirectory
import time
from urllib.parse import urlsplit
from urllib.request import urlopen

ENDPOINT = "41ba51dcc62e4225ddb789c5f9fc3024.r2.cloudflarestorage.com"

def run(*argv, **options):
    return subprocess.run(argv, check=True, **options)

def hash_file(path):
    with path.open("rb") as file:
        return file_digest(file, "sha256").hexdigest()

def signed_url(info, name):
    value = info[name]
    parsed = urlsplit(value)
    assert parsed.scheme == "https" and parsed.netloc == ENDPOINT
    assert parsed.path.startswith("/mole-baby/preview/") and re.fullmatch(r"[^\s\"\\]+", value)
    # Read the event file inside the runner so these URLs never appear in step env logs.
    print("::add-mask::" + value, flush=True)
    return value

def check_bundle(app, version):
    contents = app / "Contents"
    plist = plistlib.loads((contents / "Info.plist").read_bytes())
    assert plist["CFBundleIdentifier"] == "com.molebaby.ramuhouse"
    assert plist["CFBundleExecutable"] == "拉姆" and plist["LSUIElement"] is True
    assert plist["CFBundleShortVersionString"] == version.split("-")[0]
    assert plist["LSMinimumSystemVersion"] == "12.0"
    executable = contents / "MacOS" / plist["CFBundleExecutable"]
    arch = run("/usr/bin/lipo", "-archs", str(executable), capture_output=True, text=True)
    assert arch.stdout.strip() == "arm64"
    package = contents / "Resources" / "app"
    meta = json.loads((package / "package.json").read_text())
    assert meta["animationPreview"] is True and meta["version"] == version
    return executable, package / "dist"

def verify_assets(dist):
    manifest = json.loads((dist / "offline-resources.json").read_text())
    expected_bytes = 0
    entries = {}
    for item in manifest["files"]:
        path = (dist / item["path"]).resolve()
        assert path.is_relative_to(dist.resolve())
        assert path.stat().st_size == item["bytes"] and hash_file(path) == item["sha256"], item["path"]
        expected_bytes += item["bytes"]
        entries[item["path"]] = item
    assert manifest["bytes"] == expected_bytes
    assert len(json.loads((dist / "book-packs.json").read_text())["books"]) == 245
    clips = json.loads((dist / "assets/original/official/manifest.json").read_text())["clips"]
    assert len(manifest["files"]) > 5700 and len(clips) == 567
    for clip in clips:
        entry = entries["assets/original/official/files/" + clip["path"]]
        assert entry["sha256"] == clip["sha256"] and entry["bytes"] == clip["bytes"]
    print(f'PASS mounted app media {len(manifest["files"])} files, {len(clips)} original SWFs, renderer {manifest["revision"]}')

def detach(mount):
    for second in range(5):
        result = subprocess.run(("/usr/bin/hdiutil", "detach", str(mount)), capture_output=True)
        if result.returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError("The preview disk image could not be unmounted")

def main():
    info = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())["inputs"]
    source = signed_url(info, "source_url")
    target = signed_url(info, "destination_url")
    version = info["version"]
    assert re.fullmatch(r"\d+\.\d+\.\d+-preview\.\d+\.\d+", version)
    checksum = info["source_sha256"]
    assert re.fullmatch(r"[0-9a-f]{64}", checksum)
    assert run("/usr/bin/uname", "-m", capture_output=True, text=True).stdout.strip() == "arm64"
    with TemporaryDirectory(prefix="ramu-preview-", dir=os.environ["RUNNER_TEMP"]) as folder:
        root = Path(folder)
        preview_zip = root / "checked-preview.zip"
        # Supply URLs over stdin, not as subprocess arguments.
        run("/usr/bin/curl", "--fail", "--silent", "--show-error", "--retry", "2", "--max-time", "210",
            "--output", str(preview_zip), "--config", "-", input=f'url = "{source}"\n', text=True)
        assert hash_file(preview_zip) == checksum
        print("PASS fetched byte-identical preview ZIP")
        image_files = root / "volume"
        image_files.mkdir()
        run("/usr/bin/ditto", "-x", "-k", str(preview_zip), str(image_files))
        app = image_files / "拉姆.app"
        executable, _ = check_bundle(app, version)
        native_test = Path(__file__).with_name("smoke-mac-preview.cjs")
        run("/usr/bin/codesign", "--force", "--deep", "--sign", "-", "--preserve-metadata=identifier,entitlements,flags", str(app))
        run("/usr/bin/codesign", "--verify", "--deep", "--strict", str(app))
        run("node", str(native_test), str(executable), str(root / "preflight-profile"), "staging")
        (image_files / "Applications").symlink_to("/Applications")
        dmg = root / f"mole-baby-{version}-mac-arm64.dmg"
        run("/usr/bin/hdiutil", "create", "-fs", "HFS+", "-format", "UDZO", "-volname", "拉姆预发布试装",
            "-srcfolder", str(image_files), str(dmg))
        run("/usr/bin/codesign", "--sign", "-", str(dmg))
        run("/usr/bin/hdiutil", "verify", str(dmg))
        run("/usr/bin/codesign", "--verify", "--strict", str(dmg))
        mount = root / "mounted"
        mount.mkdir()
        run("/usr/bin/hdiutil", "attach", "-readonly", "-nobrowse", "-mountpoint", str(mount), str(dmg))
        try:
            assert os.readlink(mount / "Applications") == "/Applications"
            guide = (mount / "Mac 打开说明.html").read_text()
            assert "仍要打开" in guide
            mounted = mount / "拉姆.app"
            executable, renderer = check_bundle(mounted, version)
            run("/usr/bin/codesign", "--verify", "--deep", "--strict", str(mounted))
            verify_assets(renderer)
            run("node", str(native_test), str(executable), str(root / "qa-profile"), "mounted DMG")
        finally:
            detach(mount)
        checksum = hash_file(dmg)
        print(f"VERIFIED_DMG {checksum} {dmg.stat().st_size} {dmg.name}", flush=True)
        headers = 'header = "If-None-Match: *"\n'
        run("/usr/bin/curl", "--fail", "--silent", "--show-error", "--retry", "2", "--max-time", "210",
            "--output", os.devnull, "--upload-file", str(dmg), "--config", "-",
            input=f'url = "{target}"\n{headers}', text=True)
        print("PASS uploaded the verified DMG to the private preview location", flush=True)

if __name__ == "__main__":
    main()
