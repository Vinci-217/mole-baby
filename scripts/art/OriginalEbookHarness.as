// Offline capture adapter for 1200026.swf. Artwork and all nested timelines stay
// in the original SWF. Event handling follows LamuUIManage (ClientAppDLL.swf).
package §1200026_fla§ {
 import flash.display.MovieClip;
 import flash.display.DisplayObjectContainer;
 import flash.events.Event;
 import flash.geom.ColorTransform;
 import flash.external.ExternalInterface;
 import flash.text.TextField;
 public dynamic class lamu_mc_1 extends MovieClip {
  public var lamu_txt:TextField;
  public var bones:Array=[null,null,null];
  public var directionMC:MovieClip;
  public var animate:Boolean=true;
  public var tint:ColorTransform=new ColorTransform();
  public function lamu_mc_1(){super();addFrameScript(0,frame1);}
  internal function frame1():* {
   stop();
   loaderInfo.sharedEvents.addEventListener("getLamuMC",onDirection);
   loaderInfo.sharedEvents.addEventListener("petBone0",onBone);
   loaderInfo.sharedEvents.addEventListener("petBone1",onBone);
   loaderInfo.sharedEvents.addEventListener("petBone2",onBone);
   if(ExternalInterface.available){
    ExternalInterface.addCallback("selectForm",selectForm);
    ExternalInterface.addCallback("captureLayer",captureLayer);
    ExternalInterface.addCallback("poseInfo",poseInfo);
    ExternalInterface.addCallback("setBodyColor",setBodyColor);
   }
   x=480;y=360;scaleX=4;scaleY=4;
   gotoAndStop("level101_7");lamu_txt.visible=false;
  }
  public function selectForm(label:String):void {
   bones=[null,null,null];animate=label!="level2"&&label!="level3";
   gotoAndStop("level1");gotoAndStop(label);lamu_txt.visible=false;
  }
  public function onDirection(e:Event):void {
   directionMC=e["EventObj"] as MovieClip;
   directionMC.addFrameScript(0,null);directionMC.gotoAndStop("down");
  }
  public function onBone(e:Event):void {
   var index:int=int(e.type.charAt(7));
   var mc:MovieClip=e["EventObj"] as MovieClip;
   bones[index]=mc;mc.addFrameScript(0,null);if(index==1)mc.transform.colorTransform=tint;
   mc.addFrameScript(mc.totalFrames-3,restartBody);
   if(index==1){mc.addFrameScript(2,syncBones);if(animate)mc.gotoAndPlay(2);else mc.gotoAndStop(2);}
   syncBones();
  }
  public function syncBones():void {
   if(!bones[1])return;
   var num:int=bones[1].currentFrame+1;
   for each(var mc:MovieClip in bones)if(mc){if(animate)mc.gotoAndPlay(num);else mc.gotoAndStop(2);}
  }
  public function restartBody():void {if(bones[1])bones[1].gotoAndPlay(2);}
  public function setBodyColor(r:int,g:int,b:int):void {tint=new ColorTransform(1,1,1,1,r,g,b,0);if(bones[1])bones[1].transform.colorTransform=tint;}
  public function captureLayer(layer:String):void {
   for(var i:int=0;i<3;i++)if(bones[i])bones[i].visible=layer=="all"||layer==String(i);
  }
  public function stateTree(mc:DisplayObjectContainer):Array {
   var result:Array=[];
   if(mc is MovieClip)result.push([MovieClip(mc).currentFrame,MovieClip(mc).totalFrames]);
   for(var i:int=0;i<mc.numChildren;i++)if(mc.getChildAt(i) is DisplayObjectContainer)result.push(stateTree(mc.getChildAt(i) as DisplayObjectContainer));
   return result;
  }
  public function poseInfo():Array {
   var result:Array=[];
   for each(var mc:MovieClip in bones)result.push(mc?stateTree(mc):null);
   result.push(directionMC?stateTree(directionMC):null);
   return result;
  }
 }
}
