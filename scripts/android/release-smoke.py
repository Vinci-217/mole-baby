"""Install the fixed-signed APK, adopt, and install its higher-code fixture.
The fixture APK is never published. UI evidence comes from the actual release app.
"""
import json,re,subprocess,time,xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE='com.molebaby.ramu.preview'
OUT=Path('mobile-release');OUT.mkdir(exist_ok=True)
def adb(*args):return subprocess.check_output(['adb',*args],timeout=35).decode('utf-8','replace')
def nodes():
    adb('shell','uiautomator','dump','/sdcard/ramu-release-ui.xml')
    return list(ET.fromstring(adb('shell','cat','/sdcard/ramu-release-ui.xml')).iter('node'))
def wait_for(predicate,description,timeout=270):
    until=time.monotonic()+timeout
    while time.monotonic()<until:
        try:
            result=next((n for n in nodes() if predicate(n)),None)
            if result is not None:return result
        except (ET.ParseError,subprocess.SubprocessError):pass
        time.sleep(1)
    raise AssertionError(description)
def label(value):return lambda n:n.get('text')==value or n.get('content-desc')==value
def tap(predicate,description):
    n=wait_for(predicate,description);x1,y1,x2,y2=map(int,re.findall(r'\d+',n.get('bounds','')))
    adb('shell','input','tap',str((x1+x2)//2),str((y1+y2)//2))
def start():adb('shell','am','start','-W','-n',PACKAGE+'/com.molebaby.ramu.RamuActivity')
def picture(name):
    (OUT/name).write_bytes(subprocess.check_output(['adb','exec-out','screencap','-p'],timeout=30))
def main():
    # The debug test evidence has already been pulled by emulator-smoke.sh.
    for package in [PACKAGE+'.dev',PACKAGE+'.dev.test']:
        subprocess.run(['adb','uninstall',package],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    apk=next(Path('mobile-release/android-release').glob('*.apk'))
    subprocess.run(['adb','install','-r',str(apk)],check=True)
    start();tap(label('选择蓝色拉姆'),'Signed APK must display adoption')
    tap(label('给它起名'),'Signed APK naming step')
    tap(lambda n:n.get('class')=='android.widget.EditText','Name field')
    adb('shell','input','keyevent','123');adb('shell','input','keyevent',*(['67']*12));adb('shell','input','text','SignedRamu')
    if re.search(r'(mInputShown|isInputViewShown|mIsInputViewShown)=true',adb('shell','dumpsys','input_method')):adb('shell','input','keyevent','4')
    tap(label('带拉姆回家！'),'Adopt using signed APK')
    wait_for(label('SignedRamu'),'Signed APK must persist the adopted pet');time.sleep(2);picture('android-signed-house.png')
    subprocess.run(['adb','install','-r','android/app/build/fixed-upgrade-fixture.apk'],check=True)
    start();wait_for(label('SignedRamu'),'Higher fixed-signed APK must retain the pet')
    tree=nodes();assert not any(label('给它起名')(n)for n in tree),'Upgrade must not reopen adoption'
    assert any(label('打开背包')(n)for n in tree),'Upgraded signed APK must display the house controls'
    picture('android-signed-upgraded.png')
    (OUT/'fixed-signed-upgrade.json').write_text(json.dumps({'package':PACKAGE,'adoptedName':'SignedRamu','fixedSignedInstall':True,'higherSignedApkInstalled':True,'petRetained':True})+'\n')
    print('PASS fixed-signed release APK: real adoption and higher-version installation retain the pet')
if __name__=='__main__':main()
