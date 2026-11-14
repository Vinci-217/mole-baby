import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {costumePlayback} from '../wardrobe';
import {ramForm} from '../original-actions';
import {edgePeekTilt} from '../edge-motion';
import {petColorName,petColorOffsets} from '../pet-color';
import {costumeAction} from '../costume-action';
import {playbackForm} from '../pet-original-actions';
import {effectiveRamAction} from '../ram-action';
import manifest from '../../public/assets/original/official/manifest.json';
import OfficialRamClip from './OfficialRamClip';
import OfficialOutfitMotion from './OfficialOutfitMotion';
import RamVisual from './RamVisual';
import SharedMagicBox from './SharedMagicBox';
import OfficialTransformation from './OfficialTransformation';
import OriginalElementSkill,{originalElementClip,prepareElementSkill} from './OriginalElementSkill';
import type {RamProps} from './ram-types';
import {recordAnimationLoad} from '../animation-log';
import {playToolClip} from '../original-play-tools';
import {originalCareClip} from '../original-care';
import {outfitPreviewSource,useOutfitPreview} from '../use-outfit-preview';
import {officialViewportScale} from '../original-viewport';
import {preloadOriginalOutfit} from '../original-asset-preload';

/** Growth is data, clothing is the persistent appearance, magic is temporary.
 * Ordinary gestures keep one source engine mounted throughout their life. */
export default function ClothedRam(props:RamProps&{look:ReturnType<typeof costumePlayback>}){
 const {look,color,stage:actualStage,evolution:actualEvolution,actionId,itemId,dragging=false,sound=false,gameSound=sound,soundVolume=.45,onActionEnd}=props;
 const action=effectiveRamAction(props),clip=look.clip!,sourceForm=look.appearance.form,actualForm=ramForm(actualStage,actualEvolution);
 const tool=playToolClip(actualForm,action,itemId);
 const care=originalCareClip(actualForm,action,itemId,typeof actionId==='number'?actionId:0),interaction=tool??care;
 const cachedPreview=useOutfitPreview(outfitPreviewSource(clip,sourceForm,actualForm),petColorOffsets(color),action==='still');
 useEffect(()=>{void preloadOriginalOutfit(clip).catch(()=>{})},[clip.id]);
 const spec=useMemo(()=>costumeAction(action,sourceForm,itemId),[action,sourceForm,itemId]);
 const baseSpec=useMemo(()=>costumeAction('still',sourceForm),[sourceForm]);
 const eventKey=JSON.stringify([clip.id,actualForm,action,actionId,itemId]);
 const clock=useRef({key:'',startedAt:0});if(clock.current.key!==eventKey)clock.current={key:eventKey,startedAt:performance.now()};
 const [subject,setSubject]=useState({key:'',value:'original'});
 const onSubject=useCallback((value:string)=>setSubject({key:eventKey,value}),[eventKey]);
 const transformed=spec.kind==='transform'&&subject.key===eventKey&&subject.value==='box';
 const referenceBody=useMemo(()=>{const [x,y,right,bottom]=manifest.bodyBounds[actualForm];return {x,y,width:right-x,height:bottom-y}},[actualForm]);
 const element=spec.elementId?originalElementClip(spec.elementId):undefined;
 const prepare=useMemo(()=>spec.elementId?prepareElementSkill(spec.elementId):undefined,[spec.elementId]);
 const transformedForm=spec.clip?playbackForm(spec.clip,actualForm):undefined;
 useEffect(()=>{recordAnimationLoad({event:'appearance',clip:clip.id,name:clip.name,form:sourceForm,action,attempt:0,reason:spec.kind==='native'?'完整穿衣原片；成长数据保持不变':spec.kind==='transform'?'保留穿衣原片，烟雾中播放临时变身':'完整穿衣原片＋项目适配动作；成长数据保持不变'})},[clip.id,clip.name,sourceForm,action,spec.kind]);
 const tilt=Math.max(-12,Math.min(12,props.dragTilt??0))+(props.peeking&&!dragging?edgePeekTilt(props.peekSide??'right'):0);
 // Portraits reuse the exact resting pixels painted by the original engine.
 // Live walking/dragging keeps its own timeline and never becomes a still PNG.
 if(action==='still'&&cachedPreview){const scale=officialViewportScale(clip);return <span className="ram-sprite ram-classic ram-outfit-portrait" role="img" aria-label={`${petColorName(color)}拉姆 · ${clip.name}`} data-stage={look.appearance.stage} data-growth-stage={actualStage} data-form={sourceForm} data-color={color} data-action={action} data-source={clip.path}><img className="official-cached-preview" data-cached-original="true" src={cachedPreview} alt="" draggable={false} style={{left:`${-(scale-1)*50}%`,top:`${-(scale-1)*50}%`,width:`${scale*100}%`,height:`${scale*100}%`}}/></span>}
 return <span className={`ram-sprite ram-outfit-host ram-classic ram-official action-${spec.action} ${dragging?'is-dragging':''} ${props.className??''}`} role="img" aria-label={`${petColorName(color)}拉姆 · ${interaction?'原版道具动作':clip.name}`} data-stage={look.appearance.stage} data-growth-stage={actualStage} data-growth-form={actualForm} data-form={sourceForm} data-color={color} data-action={action} data-animation-mode={tool?'original-tool':care?'original-care':spec.kind} data-tool-source={tool?.path} data-care-source={care?.path} data-sleeping={action==='sleep'?'true':'false'}>
  <span className="ram-outfit-source" style={{visibility:transformed||interaction?'hidden':'visible'}} aria-hidden={Boolean(interaction)||transformed}>
   <OfficialOutfitMotion sourceKey={`${clip.id}:${sourceForm}:${actualForm}`} spec={spec.kind==='transform'||interaction?baseSpec:spec} actionId={actionId} stage={look.appearance.stage} evolution={look.appearance.evolution} referenceBody={referenceBody} tilt={tilt} sound={sound&&!transformed&&!interaction} paused={props.paused||transformed||Boolean(interaction)} onEnd={spec.kind==='transform'||interaction?undefined:onActionEnd}>
    {({pose,onReady,onLoading,onError,onBodyBounds})=><OfficialRamClip reloadKey={actionId} clip={clip} form={sourceForm} bodyForm={actualForm} color={color} action={pose} paused={props.paused||transformed||Boolean(interaction)} sound={gameSound&&!transformed&&!interaction} volume={soundVolume} onReady={onReady} onLoading={onLoading} onError={onError} onBodyBounds={onBodyBounds} fallback={<RamVisual color={color} stage={look.appearance.stage} evolution={look.appearance.evolution} action="still" sound={false}/>}/>}
   </OfficialOutfitMotion>
  </span>
  {tool&&<span className="ram-original-tool" style={{position:'absolute',inset:0}}><RamVisual {...props} costume={undefined} action={action}/></span>}
  {care&&!tool&&<span className="ram-original-care" style={{position:'absolute',inset:0}}><RamVisual {...props} costume={undefined} action={action}/></span>}
  {spec.kind==='transform'&&(spec.clip&&transformedForm?<OfficialTransformation key={eventKey} clip={spec.clip} form={transformedForm} bodyForm={actualForm} color={color} startedAt={clock.current.startedAt} sound={gameSound} volume={soundVolume} onSubject={onSubject} onEnd={onActionEnd}>{null}</OfficialTransformation>:<SharedMagicBox key={eventKey} startedAt={clock.current.startedAt} form={actualForm} prepare={prepare} targetDuration={element?.durationMs} onSubject={onSubject} onEnd={onActionEnd} target={spec.elementId&&element?(began=><OriginalElementSkill id={spec.elementId!} startedAt={began} form={actualForm}/>):undefined}>{null}</SharedMagicBox>)}
 </span>;
}
