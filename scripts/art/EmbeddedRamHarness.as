// Generic offline viewer. Loaded artwork and timelines remain in their source
// SWF; only the stage selection and LamuUIManage bone events are adapted.
package §1200026_fla§ {
 import flash.display.*;
 import flash.events.*;
 import flash.external.ExternalInterface;
 import flash.geom.*;
 import flash.net.URLRequest;
 import flash.system.*;
 import flash.text.TextField;
 public dynamic class lamu_mc_1 extends MovieClip {
  public var tint:ColorTransform=new ColorTransform();
  public var sourceLoader:Loader;
  public var baseLoader:Loader;
  public var baseRoot:MovieClip;
  public var holder:Sprite=new Sprite();
  public var selected:DisplayObject;
  public var bones:Array=[null,null,null,null];
  public var directionMC:MovieClip;
  public var form:String="";
  public var direction:String="down";
  public var moving:Boolean=true;
  public var ready:Boolean=false;
  public var ended:Boolean=false;
  public var failure:String="";
  public var requestedSymbol:String="";
  public var settle:int=0;
  public var fittedScale:Number=1;
  public var zoom:Number=1;
  public var registerBody:Boolean=false;
  public var referenceForm:String="";
  public var referenceBounds:Array;
  public var costume:Boolean=false;
  public var registered:Boolean=false;
  public var registration:Object=null;
  public var fitX:Number=0;
  public var fitY:Number=0;
  public function lamu_mc_1(){super();addFrameScript(0,boot);}
  internal function boot():void {
   stop();while(numChildren)removeChildAt(0);addChild(holder);
   x=0;y=0;scaleX=scaleY=1;
   if(ExternalInterface.available){
    ExternalInterface.addCallback("previewStatus",previewStatus);
    ExternalInterface.addCallback("previewSymbol",previewSymbol);
    ExternalInterface.addCallback("previewPose",previewPose);
    ExternalInterface.addCallback("previewZoom",previewZoom);
    ExternalInterface.addCallback("setBodyColor",setBodyColor);
   }
   sourceLoader=new Loader();
   var info:LoaderInfo=sourceLoader.contentLoaderInfo;
   info.sharedEvents.addEventListener("getLamuMC",onDirection);
   info.sharedEvents.addEventListener("getLamuLevelMC",onLevel);
   for(var i:int=0;i<4;i++)info.sharedEvents.addEventListener("petBone"+i,onBone);
   // Instantiated exported classes inherit the containing stage's loaderInfo.
   loaderInfo.sharedEvents.addEventListener("getLamuMC",onDirection);
   loaderInfo.sharedEvents.addEventListener("getLamuLevelMC",onLevel);
   for(i=0;i<4;i++)loaderInfo.sharedEvents.addEventListener("petBone"+i,onBone);
   info.addEventListener(Event.COMPLETE,onLoaded);
   info.addEventListener(IOErrorEvent.IO_ERROR,onError);
   info.addEventListener(SecurityErrorEvent.SECURITY_ERROR,onError);
   addEventListener(Event.ENTER_FRAME,onFrame);
   var params:Object=loaderInfo.parameters;
   requestedSymbol=String(params.symbol||"");
   form=String(params.form||"");
   registerBody=params.registerBody=="1";referenceForm=String(params.referenceForm||form);
   referenceBounds=String(params.referenceBounds||"17.11472,35.95208,82.03084,81.50964").split(",");
   for(var coordinate:int=0;coordinate<referenceBounds.length;coordinate++)referenceBounds[coordinate]=Number(referenceBounds[coordinate]);
   costume=params.kind=="outfit";
   // Register clothes against the resting down pose, before any walk starts.
   // The moving body's squash must not decide a newly worn outfit's size.
   if(registerBody)moving=false;
   if(params.base){
    baseLoader=new Loader();
    baseLoader.contentLoaderInfo.addEventListener(IOErrorEvent.IO_ERROR,onError);
    baseLoader.contentLoaderInfo.addEventListener(Event.COMPLETE,function(e:Event):void {
     sourceLoader.load(new URLRequest(String(params.source)),new LoaderContext(false,new ApplicationDomain()));
    });
    baseLoader.load(new URLRequest(String(params.base)),new LoaderContext(false,new ApplicationDomain()));
   }else sourceLoader.load(new URLRequest(String(params.source)),new LoaderContext(false,new ApplicationDomain()));
  }
  public function onError(e:Event):void {failure=String(e);}
  public function onEnded(e:Event):void {ended=true;}
  public function onLoaded(e:Event):void {ready=true;previewSymbol(requestedSymbol);}
  public function onFrame(e:Event):void {
   stripNameFields(holder);
   if(settle>0&&--settle==0)fit();
   // petView.setPetColor colours the named petBody in item animations.
   if(!bones[1]&&selected is DisplayObjectContainer)tintBodies(selected as DisplayObjectContainer);
  }
  public function stripNameFields(node:DisplayObjectContainer):void {
   for(var i:int=node.numChildren-1;i>=0;i--){
    var child:DisplayObject=node.getChildAt(i);
    child.addEventListener("gotoEnd",onEnded);
    if(child is TextField)node.removeChild(child);
    else if(child is DisplayObjectContainer)stripNameFields(child as DisplayObjectContainer);
   }
  }
  public function tintBodies(container:DisplayObjectContainer):void {
   for(var i:int=0;i<container.numChildren;i++){
    var child:DisplayObject=container.getChildAt(i);
    if(child.name=="petBody"||child.name=="lahm"||child.name=="pet")child.transform.colorTransform=tint;
    else if(child is DisplayObjectContainer)tintBodies(child as DisplayObjectContainer);
   }
  }
  public function previewSymbol(name:String):void {
   if(!ready)return;
   while(holder.numChildren)holder.removeChildAt(0);
   bones=[null,null,null,null];directionMC=null;failure="";ended=false;
   try{
    if(baseLoader){
     var baseClass:Class=baseLoader.contentLoaderInfo.applicationDomain.getDefinition("lamubone_fla.lamu_mc_1") as Class;
     baseRoot=new baseClass() as MovieClip;holder.addChild(baseRoot);
     baseRoot.gotoAndStop(form);
    }
    if(name){var cls:Class=sourceLoader.contentLoaderInfo.applicationDomain.getDefinition(name) as Class;selected=new cls() as DisplayObject;}
    else selected=sourceLoader.content;
    holder.addChild(selected);selected.x=selected.y=0;
    selected.addEventListener("gotoEnd",onEnded);
    requestedSymbol=name;
    if(selected is MovieClip){
     var mc:MovieClip=selected as MovieClip;
     if(form&&hasLabel(mc,form))mc.gotoAndStop(form);else mc.play();
    }
    // Item timelines already start with their complete original body. Register
    // that first pose, before an intro can stretch/shrink it or move a prop.
    settle=costume?12:1;
   }catch(error:Error){failure=error.message;}
  }
  public function hasLabel(mc:MovieClip,label:String):Boolean {
   for each(var f:FrameLabel in mc.currentLabels)if(f.name==label)return true;
   return false;
  }
  public function previewPose(nextForm:String,nextDirection:String,isMoving:Boolean,refreshRegistration:Boolean=false):void {
   if(nextForm!=form||refreshRegistration)registered=false;
   form=nextForm;direction=nextDirection;moving=isMoving;
   bones=[null,null,null,null];directionMC=null;
   if(baseRoot){baseRoot.gotoAndStop(1);baseRoot.gotoAndStop(form);}
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
   if(!mc||index>3)return;
   bones[index]=mc;mc.addFrameScript(0,null);
   // Original GV yellow: additive offsets, applied to the neutral source body.
   if(index==1)mc.transform.colorTransform=tint;
   if(mc.totalFrames>4)mc.addFrameScript(mc.totalFrames-3,restartBody);
   if(index==1||index==0&&!bones[1]){
    if(index==1&&mc.totalFrames>3)mc.addFrameScript(2,syncBones);
    if(moving||form!="level2"&&form!="level3"||index==0&&!baseRoot&&!bones[1])mc.gotoAndPlay(Math.min(2,mc.totalFrames));
    else mc.gotoAndStop(Math.min(2,mc.totalFrames));
   }
   if(bones[1]&&bones[3]&&bones[1].parent&&bones[3].parent!=bones[1].parent){
    // Exported costume direction containers have their own authoring offset.
    // Preserve the original artwork's coordinates when attaching it to the
    // body's rig; addChild alone discards that parent's transformation.
    var cloth:MovieClip=bones[3];
    var parentNode:DisplayObjectContainer=bones[1].parent;
    var origin:Point=parentNode.globalToLocal(cloth.localToGlobal(new Point()));
    var axisX:Point=parentNode.globalToLocal(cloth.localToGlobal(new Point(1,0)));
    var axisY:Point=parentNode.globalToLocal(cloth.localToGlobal(new Point(0,1)));
    parentNode.addChild(cloth);
    cloth.transform.matrix=new Matrix(axisX.x-origin.x,axisX.y-origin.y,axisY.x-origin.x,axisY.y-origin.y,origin.x,origin.y);
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
  public function namedBody(node:DisplayObjectContainer):DisplayObject {
   for(var i:int=0;i<node.numChildren;i++){
    var child:DisplayObject=node.getChildAt(i);
    if(child.name=="petBody"||child.name=="lahm"||child.name=="pet")return child;
    if(child is DisplayObjectContainer){var nested:DisplayObject=namedBody(child as DisplayObjectContainer);if(nested)return nested;}
   }
   return null;
  }
  public function fit():void {
   if(!selected)return;
   var text:Object=("lamu_txt" in Object(selected))?Object(selected)["lamu_txt"]:null;
   if(text&&text.parent)text.parent.removeChild(text);
   if(baseRoot&&("lamu_txt" in Object(baseRoot))){
    text=Object(baseRoot)["lamu_txt"];if(text&&text.parent)text.parent.removeChild(text);
   }
   var bounds:Rectangle=holder.getBounds(holder);
   if(("lamu_txt" in Object(selected))&&Object(selected)["lamu_txt"])
    Object(selected)["lamu_txt"].visible=false;
   if(bounds.width<=0||bounds.height<=0){settle=1;return;}
   var nativeBody:DisplayObject=bones[1]||namedBody(holder)||bones[0]||selected;
   if(registerBody&&nativeBody){
    // Register the original BODY, never the hat/wings/book envelope. Cache the
    // down pose for every direction so changing pose cannot resize the pet.
    if(!registered){
     var body:Rectangle=nativeBody.getBounds(holder);
     var target:Array=referenceBounds;
     if(body.width<=0){settle=1;return;}
     fittedScale=400*(target[2]-target[0])/100/body.width;
     fitX=400*(target[0]+target[2])/200-(body.x+body.width/2)*fittedScale;
     fitY=432*target[3]/108-body.bottom*fittedScale;
     registration={basis:bones[1]?"body-bone":nativeBody!=selected?"named-body":"complete-character",bodyWidth:body.width,bodyHeight:body.height,projectedWidth:(target[2]-target[0]),scale:fittedScale,x:fitX,y:fitY};
     registered=true;
    }
   }else if(!registered){
    fittedScale=Math.min(6,400*.92/bounds.width,432*.88/bounds.height);
    fitX=200-(bounds.x+bounds.width/2)*fittedScale;
    fitY=432*.53-(bounds.y+bounds.height/2)*fittedScale;
    registered=true;
   }
   holder.scaleX=holder.scaleY=fittedScale*zoom;
   // Transparent padding surrounds the fixed logical body viewport. Body
   // registration still uses 400x432; oversized hats must never shrink it.
   holder.x=440+fitX;holder.y=475.2+fitY;
  }
  public function previewZoom(value:Number):void {zoom=value;fit();}
  public function setBodyColor(r:int,g:int,b:int):void {tint=new ColorTransform(1,1,1,1,r,g,b,0);if(bones[1])bones[1].transform.colorTransform=tint;}
  public function previewStatus():Object {
   var frames:Array=[];
   var rig:Array=[];
   for each(var mc:MovieClip in bones)frames.push(mc?mc.currentFrame:0);
   for each(mc in bones){if(mc){var b:Rectangle=mc.getBounds(holder);rig.push({x:mc.x,y:mc.y,scaleX:mc.scaleX,scaleY:mc.scaleY,parent:mc.parent?mc.parent.name:"",bounds:{x:b.x,y:b.y,width:b.width,height:b.height}});}else rig.push(null);}
   var painted:Rectangle=holder.getBounds(this);
   var bodyNode:DisplayObject=bones[1]||namedBody(holder)||bones[0]||selected;
   var bodyPaint:Rectangle=bodyNode?bodyNode.getBounds(this):new Rectangle();
   return {ready:ready,settled:settle==0,ended:ended,error:failure,symbol:requestedSymbol,form:form,direction:direction,moving:moving,
    body:{x:(bodyPaint.x-440)/4,y:(bodyPaint.y-475.2)/4,width:bodyPaint.width/4,height:bodyPaint.height/4},
    viewport:{width:stage.stageWidth,height:stage.stageHeight},painted:{x:painted.x,y:painted.y,width:painted.width,height:painted.height},
    width:holder.getBounds(holder).width,height:holder.getBounds(holder).height,
    registration:registration,bones:frames,rig:rig,frame:selected is MovieClip?MovieClip(selected).currentFrame:0};
  }
 }
}
