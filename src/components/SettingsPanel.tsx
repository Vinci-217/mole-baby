import type {ReactNode} from 'react';
import './SettingsPanel.css';

export function SettingsSection({title,children}:{title:string;children:ReactNode}){
 return <section className="settings-section" aria-label={title}><h3>{title}</h3>{children}</section>;
}
export default function SettingsPanel({children}:{children:ReactNode}){
 return <div className="settings-panel" aria-label="拉姆设置">{children}</div>;
}
