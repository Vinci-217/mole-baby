import sites from '../electron/external-sites.json';

export async function openManorSite(){
 if(window.desktop){await window.desktop.openManorSite();return;}
 window.open(sites.manor,'_blank','noopener,noreferrer');
}
