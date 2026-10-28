package com.module.colorEditor.colorEditorView
{
   import com.common.Alert.Alert;
   import com.core.MainManager;
   import com.core.info.LocalUserInfo;
   import com.event.EventTaomee;
   import com.logic.socket.modUserColor.ModUserColorReq;
   import com.mole.app.manager.BufferManager;
   import com.mole.app.manager.ModuleManager;
   import flash.display.MovieClip;
   import flash.display.Sprite;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.events.TimerEvent;
   import flash.geom.ColorTransform;
   import flash.utils.Timer;

   public class colorEditorView extends Sprite
   {

      public var EffectMC:MovieClip;

      private var Red:Number = 0;

      private var Green:Number = 0;

      private var Blue:Number = 0;

      private var style:Number = 0;

      private var myTimer:Timer;

      private var alphaTimer:Timer;

      private var colorBool:Boolean;

      private var _step:uint;

      public function colorEditorView(target:*)
      {
         super();
         this.EffectMC = target.content.root["editor_mc"];
         this.viewInit();
      }

      private function viewInit() : void
      {
         this.myTimer = new Timer(500,10);
         BC.addEvent(this,this.myTimer,TimerEvent.TIMER,this.changeColor);
         this.alphaTimer = new Timer(20,10);
         BC.addEvent(this,this.alphaTimer,TimerEvent.TIMER,this.AlphaChange);
         BC.addEvent(this,GV.onlineSocket,"removeMapEvent",this.removeHandler);
         BC.addEvent(this,this.EffectMC.red_btn.stage,MouseEvent.MOUSE_UP,this.stageUpAction);
         BC.addEvent(this,this.EffectMC.close_btn,MouseEvent.CLICK,this.closeMC);
         this.EffectMC.red_btn.startX = this.EffectMC.red_btn.x;
         this.EffectMC.red_btn.startY = this.EffectMC.red_btn.y;
         this.EffectMC.red_btn.style = 1;
         this.EffectMC.red_btn.btn.buttonMode = true;
         BC.addEvent(this,GV.MC_AppLever.stage,MouseEvent.MOUSE_UP,this.restartXY);
         BC.addEvent(this,this.EffectMC.red_btn.btn,MouseEvent.MOUSE_DOWN,this.actionDown);
         BC.addEvent(this,this.EffectMC.red_btn.btn,MouseEvent.MOUSE_MOVE,this.actionMove);
         BC.addEvent(this,this.EffectMC.red_btn.btn,MouseEvent.MOUSE_UP,this.actionUp);
         this.EffectMC.green_btn.startX = this.EffectMC.green_btn.x;
         this.EffectMC.green_btn.startY = this.EffectMC.green_btn.y;
         this.EffectMC.green_btn.style = 2;
         this.EffectMC.green_btn.btn.buttonMode = true;
         BC.addEvent(this,this.EffectMC.green_btn.btn,MouseEvent.MOUSE_DOWN,this.actionDown);
         BC.addEvent(this,this.EffectMC.green_btn.btn,MouseEvent.MOUSE_MOVE,this.actionMove);
         BC.addEvent(this,this.EffectMC.green_btn.btn,MouseEvent.MOUSE_UP,this.actionUp);
         this.EffectMC.blue_btn.startX = this.EffectMC.blue_btn.x;
         this.EffectMC.blue_btn.startY = this.EffectMC.blue_btn.y;
         this.EffectMC.blue_btn.style = 3;
         this.EffectMC.blue_btn.btn.buttonMode = true;
         BC.addEvent(this,this.EffectMC.blue_btn.btn,MouseEvent.MOUSE_DOWN,this.actionDown);
         BC.addEvent(this,this.EffectMC.blue_btn.btn,MouseEvent.MOUSE_MOVE,this.actionMove);
         BC.addEvent(this,this.EffectMC.blue_btn.btn,MouseEvent.MOUSE_UP,this.actionUp);
         BC.addEvent(this,this.EffectMC.refurbish_btn,MouseEvent.CLICK,this.refurbishColor);
         BC.addEvent(this,this.EffectMC.compose_btn,MouseEvent.CLICK,this.composeHandler);
         BC.addEvent(this,this.EffectMC.effect_mc.quit_btn,MouseEvent.CLICK,this.quitClickHandler);
      }

      private function actionDown(evt:MouseEvent = null) : void
      {
         this.EffectMC.arrow_mc.stop();
         this.EffectMC.arrow_mc.gotoAndStop(1);
         this.style = evt.currentTarget.parent.style;
         evt.currentTarget.parent.startDrag();
      }

      private function actionUp(evt:MouseEvent = null) : void
      {
         evt.currentTarget.parent.x = evt.currentTarget.parent.startX;
         evt.currentTarget.parent.y = evt.currentTarget.parent.startY;
         evt.currentTarget.parent.gotoAndStop(1);
         this.EffectMC.crock_mc.volution_mc.gotoAndStop(7);
         this.colorBool = false;
         this.myTimer.stop();
         evt.currentTarget.parent.stopDrag();
      }

      private function actionMove(evt:MouseEvent = null) : void
      {
         evt.updateAfterEvent();
         if(Boolean(evt.currentTarget.parent.test_mc.hitTestObject(this.EffectMC.hitMC)))
         {
            if(!this.colorBool)
            {
               evt.currentTarget.parent.gotoAndPlay(2);
               this.colorBool = true;
               this.setAtction();
            }
         }
         else
         {
            evt.currentTarget.parent.gotoAndStop(1);
            this.colorBool = false;
            this.setAtction();
         }
      }

      private function setAtction() : void
      {
         if(this.colorBool)
         {
            this.myTimer.reset();
            this.myTimer.start();
            this.changeAlpha();
            this.EffectMC.crock_mc.volution_mc.gotoAndPlay(2);
         }
         else
         {
            this.myTimer.stop();
            this.EffectMC.crock_mc.volution_mc.gotoAndStop(7);
         }
      }

      private function changeColor(evt:TimerEvent) : void
      {
         if(this.Red >= 255 && this.Green >= 255 && this.Blue >= 255)
         {
            this.refurbishColor();
            this.changeAlpha();
         }
         switch(this.style)
         {
            case 1:
               this.Red += 25.5;
               if(this.Red >= 255)
               {
                  this.Red = 255;
               }
               break;
            case 2:
               this.Green += 25.5;
               if(this.Green >= 255)
               {
                  this.Green = 255;
               }
               break;
            case 3:
               this.Blue += 25.5;
               if(this.Blue >= 255)
               {
                  this.Blue = 255;
               }
         }
         var myColor:Object = {
            "red":this.Red,
            "green":this.Green,
            "blue":this.Blue
         };
         this.EffectMC.crock_mc.water_mc.transform.colorTransform = new ColorTransform(myColor.red / 256,myColor.green / 256,myColor.blue / 256,1);
         this.EffectMC.crock_mc.volution_mc.transform.colorTransform = new ColorTransform(myColor.red - 10 / 256,myColor.green - 10 / 256,myColor.blue - 10 / 256,1);
      }

      private function refurbishColor(evt:MouseEvent = null) : void
      {
         this.EffectMC.crock_mc.water_mc.alpha = 0;
         this.EffectMC.crock_mc.mask_mc.alpha = 1;
         this.Red = 0;
         this.Green = 0;
         this.Blue = 0;
         this.myTimer.reset();
      }

      private function changeAlpha() : void
      {
         if(this.EffectMC.crock_mc.water_mc.alpha < 1)
         {
            this.alphaTimer.reset();
            this.alphaTimer.start();
         }
         else
         {
            this.alphaTimer.stop();
         }
      }

      private function AlphaChange(evt:TimerEvent) : void
      {
         this.EffectMC.crock_mc.water_mc.alpha += 0.1;
         this.EffectMC.crock_mc.mask_mc.alpha -= 0.1;
      }

      private function bufferHanalde(e:EventTaomee) : void
      {
         BufferManager.removeBufferEvent(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,this.bufferHanalde);
         this._step = uint(e.EventObj);
         if(this._step != 3)
         {
            return;
         }
         BufferManager.setBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,4);
         Alert.smileAlart("哇塞，终于获得了第一件宝物，快去看看第二件宝物在哪里吧",function():void
         {
            ModuleManager.openPanel("MagicChristmasHat");
         });
      }

      private function composeHandler(evt:MouseEvent = null) : void
      {
         if(this.Red == 0 && this.Green == 0 && this.Blue == 0)
         {
            this.Red = this.Green = this.Blue = 255;
         }
         var r:String = this.Red.toString(16);
         r = r == "0" ? "00" : r;
         var g:String = this.Green.toString(16);
         g = g == "0" ? "00" : g;
         var b:String = this.Blue.toString(16);
         b = b == "0" ? "00" : b;
         var color:String = "0x";
         color += r + g + b;
         var clorReq:* = new ModUserColorReq();
         clorReq.modUserColor(0,color);
         LocalUserInfo.setFamily(Number(Number(color).toString(10)));
         MainManager.getGlobalObject().data.Family = LocalUserInfo.getFamily();
         try
         {
            MainManager.getGlobalObject().flush();
         }
         catch(e:*)
         {
         }
         var myColor:Object = {
            "red":this.Red,
            "green":this.Green,
            "blue":this.Blue
         };
         this.EffectMC.effect_mc.mole_mc.mc.transform.colorTransform = new ColorTransform(myColor.red / 256,myColor.green / 256,myColor.blue / 256,1);
         this.refurbishColor();
         this.EffectMC.crock_mc.gotoAndStop(2);
      }

      private function closeMC(evt:MouseEvent = null) : void
      {
         this.removeHandler();
      }

      private function quitClickHandler(evt:*) : void
      {
         BufferManager.addBufferEvent(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,this.bufferHanalde);
         BufferManager.getBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT);
         this.removeHandler();
      }

      private function removeEditorMC() : void
      {
         GC.stopAllMC(this.EffectMC);
         GC.clearChildren(this.EffectMC.parent.parent.parent);
      }

      private function stageUpAction(evt:*) : void
      {
         try
         {
            this.EffectMC.red_btn.x = this.EffectMC.red_btn.startX;
            this.EffectMC.red_btn.y = this.EffectMC.red_btn.startY;
            this.EffectMC.red_btn.gotoAndStop(1);
            this.EffectMC.green_btn.x = this.EffectMC.green_btn.startX;
            this.EffectMC.green_btn.y = this.EffectMC.green_btn.startY;
            this.EffectMC.green_btn.gotoAndStop(1);
            this.EffectMC.blue_btn.x = this.EffectMC.blue_btn.startX;
            this.EffectMC.blue_btn.y = this.EffectMC.blue_btn.startY;
            this.EffectMC.blue_btn.gotoAndStop(1);
            this.EffectMC.crock_mc.volution_mc.gotoAndStop(7);
            this.colorBool = false;
            this.myTimer.stop();
         }
         catch(E:*)
         {
         }
      }

      private function restartXY(evt:*) : void
      {
         this.EffectMC.red_btn.x = this.EffectMC.red_btn.startX;
         this.EffectMC.red_btn.y = this.EffectMC.red_btn.startY;
         this.EffectMC.red_btn.stopDrag();
         this.EffectMC.green_btn.x = this.EffectMC.green_btn.startX;
         this.EffectMC.green_btn.y = this.EffectMC.green_btn.startY;
         this.EffectMC.green_btn.stopDrag();
         this.EffectMC.blue_btn.x = this.EffectMC.blue_btn.startX;
         this.EffectMC.blue_btn.y = this.EffectMC.blue_btn.startY;
         this.EffectMC.blue_btn.stopDrag();
      }

      private function removeHandler(evt:Event = null) : void
      {
         BC.removeEvent(this);
         GC.clearAllChildren(this.EffectMC);
         this.EffectMC.parent.parent.parent.parent.removeChild(this.EffectMC.parent.parent.parent);
         GC.clearChildren(this.EffectMC.parent.parent.parent);
         this.EffectMC = null;
      }
   }
}
