/** Reparenting Android's live WebView briefly hides both the overlay and the
 * Activity. Only an explicit in-app view switch may bridge that short gap. */
export const WORK_VIEW_SWITCH_MS=4000;
export class WorkPresence {
 private visible=true;
 private switchingUntil=0;
 private targetMode:boolean|null=null;
 private mode:boolean|null=null;
 beginViewSwitch(targetMode:boolean,now=Date.now()){
  this.targetMode=targetMode;this.switchingUntil=now+WORK_VIEW_SWITCH_MS;
 }
 endViewSwitch(){this.targetMode=null;this.switchingUntil=0}
 observeWindow(state:{windowVisible?:boolean;petMode:boolean}){
  if(typeof state.windowVisible==='boolean')this.visible=state.windowVisible;
  this.mode=state.petMode;
 }
 isPresent(hidden:boolean,now=Date.now()){
  if(!hidden&&this.visible&&this.targetMode!==null&&this.mode===this.targetMode)this.endViewSwitch();
  return !hidden&&this.visible||this.targetMode!==null&&now<this.switchingUntil;
 }
}
