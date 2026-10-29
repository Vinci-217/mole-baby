const {GenericProvider}=require('electron-updater/out/providers/GenericProvider');
const {resolveFiles}=require('electron-updater/out/providers/Provider');
const semver=require('semver');
const REPOSITORY='https://github.com/Vinci-217/mole-baby';

function stableVersion(value){
 if(!semver.valid(value)||semver.prerelease(value)||semver.clean(value)!==value)throw Error('Invalid update version');
 return value;
}
/** The metadata channel stays at latest; artifacts and both blockmaps must be
 * pinned to their own release. GenericProvider otherwise looks for old maps
 * in the newest release, which cannot work after an initial full installation.
 * Source options are main-process constants, never renderer input. */
class VersionedGenericProvider extends GenericProvider{
 constructor(options,updater,runtimeOptions){
  super(options,updater,{...runtimeOptions,isUseMultipleRangeRequest:false});
  this.releaseBaseUrl=new URL(options.releaseBaseUrl);
 }
 release(version){return new URL(`v${stableVersion(version)}/`,this.releaseBaseUrl)}
 resolveFiles(info){
  if(!Array.isArray(info.files)||info.files.some(file=>typeof file.url!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(file.url)||file.url.includes('..')))throw Error('Invalid update artifact');
  return resolveFiles(info,this.release(info.version));
 }
 getBlockMapFiles(fileUrl,oldVersion,newVersion){
  const name=fileUrl.pathname.split('/').at(-1);
  stableVersion(oldVersion);stableVersion(newVersion);
  if(!name.includes(newVersion))throw Error('Update filename missing version');
  return [new URL(`${name.split(newVersion).join(oldVersion)}.blockmap`,this.release(oldVersion)),new URL(`${name}.blockmap`,this.release(newVersion))];
 }
}
function productionUpdateSource(channel){
 return{provider:'custom',updateProvider:VersionedGenericProvider,url:`${REPOSITORY}/releases/latest/download/`,releaseBaseUrl:`${REPOSITORY}/releases/download/`,useMultipleRangeRequest:false,...(channel?{channel}:{})};
}
module.exports={REPOSITORY,VersionedGenericProvider,productionUpdateSource};
