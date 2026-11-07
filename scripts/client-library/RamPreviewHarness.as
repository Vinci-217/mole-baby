// Generic offline viewer. Loaded artwork and timelines remain in their source
// SWF; only the stage selection and LamuUIManage bone events are adapted.
package §1200026_fla§ {
 import flash.display.*;
 import flash.events.*;
 import flash.external.ExternalInterface;
 import flash.geom.*;
 import flash.net.URLRequest;
 import flash.system.*;
 public dynamic class lamu_mc_1 extends MovieClip {
  public var sourceLoader:Loader;
  public var holder:Sprite=new Sprite();
  public var selected:DisplayObject;
  public var bones:Array=[null,null,null];
  public var directionMC:MovieClip;
  public var form:String="";
  public var direction:String="down";
  public var moving:Boolean=true;
  public var ready:Boolean=false;
  public var failure:String="";
  public var requestedSymbol:String="";
  public var settle:int=0;
  public var fittedScale:Number=1;
  public var zoom:Number=1;
  public function lamu_mc_1(){super();addFrameScript(0,boot);}
  internal function boot():void {
   stop();while(numChildren)removeChildAt(0);addChild(holder);
   x=0;y=0;scaleX=scaleY=1;
   if(ExternalInterface.available){
    ExternalInterface.addCallback("previewStatus",previewStatus);
    ExternalInterface.addCallback("previewSymbol",previewSymbol);
    ExternalInterface.addCallback("previewPose",previewPose);
    ExternalInterface.addCallback("previewZoom",previewZoom);
   }
   sourceLoader=new Loader();
   var info:LoaderInfo=sourceLoader.contentLoaderInfo;
   info.sharedEvents.addEventListener("getLamuMC",onDirection);
   info.sharedEvents.addEventListener("getLamuLevelMC",onLevel);
   for(var i:int=0;i<3;i++)info.sharedEvents.addEventListener("petBone"+i,onBone);
   // Instantiated exported classes inherit the containing stage's loaderInfo.
   loaderInfo.sharedEvents.addEventListener("getLamuMC",onDirection);
   loaderInfo.sharedEvents.addEventListener("getLamuLevelMC",onLevel);
   for(i=0;i<3;i++)loaderInfo.sharedEvents.addEventListener("petBone"+i,onBone);
   info.addEventListener(Event.COMPLETE,onLoaded);
   info.addEventListener(IOErrorEvent.IO_ERROR,onError);
   info.addEventListener(SecurityErrorEvent.SECURITY_ERROR,onError);
   addEventListener(Event.ENTER_FRAME,onFrame);
   var params:Object=loaderInfo.parameters;
   requestedSymbol=String(params.symbol||"");
   form=String(params.form||"");
   sourceLoader.load(new URLRequest(String(params.source)),new LoaderContext(false,new ApplicationDomain()));
  }
  public function onError(e:Event):void {failure=String(e);}
  public function onLoaded(e:Event):void {ready=true;previewSymbol(requestedSymbol);}
  public function onFrame(e:Event):void {if(settle>0&&--settle==0)fit();}
  public function previewSymbol(name:String):void {
   if(!ready)return;
   while(holder.numChildren)holder.removeChildAt(0);
   bones=[null,null,null];directionMC=null;failure="";
   try{
    if(name){var cls:Class=sourceLoader.contentLoaderInfo.applicationDomain.getDefinition(name) as Class;selected=new cls() as DisplayObject;}
    else selected=sourceLoader.content;
    holder.addChild(selected);selected.x=selected.y=0;
    requestedSymbol=name;
    if(selected is MovieClip){
     var mc:MovieClip=selected as MovieClip;
     if(form&&hasLabel(mc,form))mc.gotoAndStop(form);else mc.play();
    }
    settle=12;
   }catch(error:Error){failure=error.message;}
  }
  public function hasLabel(mc:MovieClip,label:String):Boolean {
   for each(var f:FrameLabel in mc.currentLabels)if(f.name==label)return true;
   return false;
  }
  public function previewPose(nextForm:String,nextDirection:String,isMoving:Boolean):void {
   form=nextForm;direction=nextDirection;moving=isMoving;
   bones=[null,null,null];directionMC=null;
   if(selected is MovieClip){
    var mc:MovieClip=selected as MovieClip;
    if(form&&hasLabel(mc,form)){mc.gotoAndStop(1);mc.gotoAndStop(form);}
    else if(direction&&hasLabel(mc,direction))mc.gotoAndStop(direction);
   }
   settle=12;
  }
  public function onLevel(e:Event):void {
   // Root instances in the base bone library are announced through this event.
   if(!selected)selected=Object(e)["EventObj"] as DisplayObject;
  }
  public function onDirection(e:Event):void {
   directionMC=Object(e)["EventObj"] as MovieClip;
   if(!directionMC)return;
   directionMC.addFrameScript(0,null);
   if(hasLabel(directionMC,direction))directionMC.gotoAndStop(direction);
  }
  public function onBone(e:Event):void {
   var index:int=int(e.type.charAt(7));
   var mc:MovieClip=Object(e)["EventObj"] as MovieClip;
   if(!mc||index>2)return;
   bones[index]=mc;mc.addFrameScript(0,null);
   // Original GV yellow: additive offsets, applied to the neutral source body.
   if(index==1)mc.transform.colorTransform=new ColorTransform(1,1,1,1,0,-21,-255,0);
   if(mc.totalFrames>4)mc.addFrameScript(mc.totalFrames-3,restartBody);
   if(index==1){
    if(mc.totalFrames>3)mc.addFrameScript(2,syncBones);
    if(moving||form!="level2"&&form!="level3")mc.gotoAndPlay(Math.min(2,mc.totalFrames));
    else mc.gotoAndStop(Math.min(2,mc.totalFrames));
   }
   syncBones();
  }
  public function syncBones():void {
   if(!bones[1])return;
   var num:int=bones[1].currentFrame+1;
   for each(var mc:MovieClip in bones)if(mc){
    if(moving||form!="level2"&&form!="level3")mc.gotoAndPlay(Math.min(num,mc.totalFrames));
    else mc.gotoAndStop(Math.min(2,mc.totalFrames));
   }
  }
  public function restartBody():void {if(bones[1])bones[1].gotoAndPlay(Math.min(2,bones[1].totalFrames));}
  public function fit():void {
   if(!selected)return;
   var bounds:Rectangle=selected.getBounds(holder);
   if(Object(selected).hasOwnProperty("lamu_txt")&&Object(selected)["lamu_txt"])
    Object(selected)["lamu_txt"].visible=false;
   if(bounds.width<=0||bounds.height<=0)return;
   fittedScale=Math.min(6,820/bounds.width,400/bounds.height);
   holder.scaleX=holder.scaleY=fittedScale*zoom;
   holder.x=480-(bounds.x+bounds.width/2)*holder.scaleX;
   holder.y=280-(bounds.y+bounds.height/2)*holder.scaleY;
  }
  public function previewZoom(value:Number):void {zoom=value;fit();}
  public function previewStatus():Object {
   var frames:Array=[];
   for each(var mc:MovieClip in bones)frames.push(mc?mc.currentFrame:0);
   return {ready:ready,settled:settle==0,error:failure,symbol:requestedSymbol,form:form,direction:direction,
    width:selected?selected.width:0,height:selected?selected.height:0,
    bones:frames,frame:selected is MovieClip?MovieClip(selected).currentFrame:0};
  }
 }
}
