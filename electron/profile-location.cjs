const fs=require('node:fs'),path=require('node:path');
/** Prefer an existing browser profile over a settings-only directory. Once
 * selected, pin it so an install/rename cannot select another empty profile.
 * Never move, merge, clear or open an older Chromium profile in legacy mode. */
function selectProfile({appData,original,packaged,explicit,legacyName}){
 if(explicit)return path.resolve(explicit);
 if(legacyName)return path.join(appData,legacyName);
 if(!packaged)return original;
 const candidates=[...new Set([path.join(appData,'mole-baby'),path.join(appData,'拉姆陪伴'),original])];
 const marker=path.join(appData,'mole-baby-profile-location.json');
 try{const pinned=JSON.parse(fs.readFileSync(marker,'utf8')).directory;if(candidates.includes(pinned))return pinned}catch{}
 const hasStorage=profile=>fs.existsSync(path.join(profile,'Local Storage'))||fs.existsSync(path.join(profile,'save-backups','latest.json'));
 const chosen=candidates.find(hasStorage)??candidates.find(profile=>fs.existsSync(path.join(profile,'window-state.json')))??candidates[0];
 try{fs.mkdirSync(appData,{recursive:true});fs.writeFileSync(marker,JSON.stringify({version:1,directory:chosen}),{mode:0o600,flag:'wx'})}catch{/* Existing profiles are still usable without a new marker. */}
 return chosen;
}
module.exports={selectProfile};
