import {useEffect, useState} from 'react';
import SettingsSwitch from './SettingsSwitch';

export default function LaunchAtLoginSetting() {
  const desktop = window.desktop;
  const [checked, setChecked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!desktop?.getLaunchAtLogin) return;
    let active = true;
    void desktop.getLaunchAtLogin().then(value => {
      if (active) setChecked(value);
    }, () => {
      if (active) setError('暂时无法读取开机自启动设置。');
    });
    return () => { active = false; };
  }, [desktop]);

  async function change(enabled: boolean) {
    if (busy || !desktop?.setLaunchAtLogin) return;
    setBusy(true);
    setError('');
    try {
      const actual = await desktop.setLaunchAtLogin(enabled);
      setChecked(actual);
      if (actual !== enabled) setError('系统未应用开机自启动设置，请在系统设置中检查。');
    } catch {
      setError('暂时无法修改开机自启动设置，请重试。');
    } finally {
      setBusy(false);
    }
  }

  return <>
    {checked !== null && <SettingsSwitch label="开机自启动" checked={checked} disabled={busy} onChange={enabled=>void change(enabled)}/>}
    {error && <p className="settings-hint" role="alert">{error}</p>}
  </>;
}
