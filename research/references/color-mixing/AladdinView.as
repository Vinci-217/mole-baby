package com.view.mapView
{
   import com.common.Alert.Alert;
   import com.common.data.goodsInfo.GoodsInfo;
   import com.common.util.DisplayUtil;
   import com.common.util.MovieClipUtil;
   import com.core.MainManager;
   import com.core.download.DownLoadEvent;
   import com.core.download.DownLoadManager;
   import com.core.download.ResType;
   import com.core.info.LocalUserInfo;
   import com.core.loading.Loading;
   import com.core.newloader.MCLoader;
   import com.event.EventTaomee;
   import com.event.MCLoadEvent;
   import com.global.staticData.CommandID;
   import com.logic.ClothBuyLogic.ClothAccountLogic;
   import com.logic.socket.AladdinPWD.AladdinPWDReq;
   import com.logic.socket.AladdinPWD.AladdinPWDRes;
   import com.logic.socket.GetItemCount.GetItemCountReq;
   import com.logic.socket.GetItemCount.GetItemCountRes;
   import com.logic.socket.superlamuParty.superlamuPartySocket;
   import com.module.clothBuyModule.clothBuyModule;
   import com.module.colorEditor.colorEditorView.colorEditorView;
   import com.module.loadExtentPanel.LoadGame;
   import com.module.superPetModule.petItemModule;
   import com.mole.app.event.SystemEvent;
   import com.mole.app.manager.ActivityTmpDataManager;
   import com.mole.app.manager.BufferManager;
   import com.mole.app.manager.ModuleManager;
   import com.mole.app.manager.OnlineManager;
   import com.mole.app.manager.QueryItemCntManager;
   import com.mole.app.manager.SystemEventManager;
   import com.mole.app.map.MapBase;
   import com.mole.app.map.MapManager;
   import com.mole.app.task.TaskManager;
   import com.mole.app.type.ModuleType;
   import com.mole.app.ui.LoadingPanel;
   import com.mole.info.ItemInfo;
   import com.mole.net.events.SocketEvent;
   import flash.display.DisplayObjectContainer;
   import flash.display.Loader;
   import flash.display.MovieClip;
   import flash.events.Event;
   import flash.events.MouseEvent;
   import flash.utils.ByteArray;

   public class AladdinView extends MapBase
   {

      public static var pwdArr:*;

      public static var pwd:String = "";

      private var _bottleTip_mc:MovieClip;

      public var effectMC:MovieClip;

      public var effectClass:MCLoader;

      private var passItem:int;

      private var clothesCount:int;

      private var lefttime:int = 0;

      private var totalTime:int;

      private var _kfcChrisStep:uint;

      public function AladdinView()
      {
         super();
      }

      override protected function initView() : void
      {
         this._bottleTip_mc = controlLevel.bottleTip_mc;
         BufferManager.addBufferEvent(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,this.bufferHanalde);
         BufferManager.getBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT);
         topLevel.mouseChildren = topLevel.mouseEnabled = false;
         GV.onlineSocket.addEventListener(AladdinPWDRes.USE_AladdinPWD_SUCC_NEW,this.UsePWDResultNew);
         controlLevel.superPetNPC.visible = true;
         GV.onlineSocket.addEventListener("move_for_game",this.showAladdin);
         controlLevel.passBtn_1.addEventListener(MouseEvent.CLICK,this.onOpenPassBook);
         controlLevel.door_1.addEventListener(MouseEvent.MOUSE_OVER,this.doorOverHandler);
         controlLevel.door_1.addEventListener(MouseEvent.MOUSE_OUT,this.doorOutHandler);
         for(var i:int = 1; i <= 4; i++)
         {
            controlLevel["bookMC_" + i].btn.addEventListener(MouseEvent.MOUSE_OVER,this.boxOverHandler);
            controlLevel["bookMC_" + i].btn.addEventListener(MouseEvent.MOUSE_OVER,this.boxOutHandler);
         }
         for(var j:int = 1; j <= 2; j++)
         {
            controlLevel["ligthMC_" + j].bool = true;
            controlLevel["ligthMC_" + j].btn.addEventListener(MouseEvent.CLICK,this.lightClickHandler);
         }
         controlLevel.changeBtn.buttonMode = true;
         controlLevel.changeBtn.addEventListener(MouseEvent.CLICK,this.changeHandler);
         controlLevel.changeBtn.addEventListener(MouseEvent.MOUSE_OVER,this.overHandler);
         controlLevel.changeBtn.addEventListener(MouseEvent.MOUSE_OUT,this.outHandler);
         petItemModule.itemVisibleHandler(controlLevel);
         controlLevel.bottle_mc.buttonMode = true;
         controlLevel.bottle_mc.btn.addEventListener(MouseEvent.MOUSE_OVER,this.boxOverHandler);
         controlLevel.bottle_mc.btn.addEventListener(MouseEvent.MOUSE_OUT,this.boxOutHandler);
         controlLevel.bottle_mc.btn.addEventListener(MouseEvent.CLICK,this.ShowClorEditor);
         this.initStarHandler();
         BC.addEvent(this,buttonLevel.box_btn,MouseEvent.CLICK,this.onOpenMagic1);
         SystemEventManager.addEventListener("playCrystal",this.onPlayCrystal);
         SystemEventManager.addEventListener("magicCode",this.onMagicCode);
         SystemEventManager.addEventListener("isOpenCloakClothesPanel",this.onChoseCorrect);
         BC.addEvent(this,GV.onlineSocket,"GETPASS_ITEM",this.getPassEvent);
         SystemEventManager.addEventListener("getmmcardReward",this.getcardReward);
         if(LocalUserInfo.isVIP())
         {
            (controlLevel.superPetNPC as MovieClip).visible = true;
         }
         else
         {
            (controlLevel.superPetNPC as MovieClip).visible = false;
         }
         SystemEventManager.addEventListener("jiaoyou",this.jiaoYouHandle);
         BC.addEvent(this,GV.onlineSocket,"backToYouthGameOver",this.backToYouthGameOver);
         SystemEventManager.addEventListener("youthChangeMap",this.youthChangeMap);
         GV.onlineSocket.addCmdListener(CommandID.CLI_PROTO_QUERY_FIFTY_CHARGECARD,this.getTimeHandle);
         GV.onlineSocket.addCmdListener(CommandID.CLI_PROTO_GET_FIFTYCARD_REWARD,this.rewardedHandle);
         GF.sendSocket(CommandID.CLI_PROTO_QUERY_FIFTY_CHARGECARD);
      }

      private function getTimeHandle(e:*) : void
      {
         var byte:ByteArray = e.data as ByteArray;
         if(byte != null)
         {
            this.totalTime = byte.readUnsignedInt();
            this.lefttime = byte.readUnsignedInt();
         }
      }

      private function rewardedHandle(e:*) : void
      {
         var count:uint = 0;
         var msg:String = null;
         var itemid:uint = 0;
         var itemnum:uint = 0;
         var i:int = 0;
         var byte:ByteArray = e.data as ByteArray;
         if(byte != null)
         {
            --this.lefttime;
            count = byte.readUnsignedInt();
            if(count > 0)
            {
               msg = "";
               for(i = 0; i < count; i++)
               {
                  itemid = byte.readUnsignedInt();
                  itemnum = byte.readUnsignedInt();
                  if(i == count - 1)
                  {
                     msg += GoodsInfo.getItemNameByID(itemid) + "x" + itemnum;
                  }
                  else
                  {
                     msg += GoodsInfo.getItemNameByID(itemid) + "x" + itemnum + ",";
                  }
               }
               Alert.smileAlart("恭喜你获得" + msg + "," + "本礼包还可以领取" + this.lefttime + "次。");
            }
         }
         else
         {
            Alert.smileAlart("领取礼包次数已用光");
         }
      }

      private function getcardReward(e:SystemEvent) : void
      {
         if(this.lefttime > 0)
         {
            GF.sendSocket(CommandID.CLI_PROTO_GET_FIFTYCARD_REWARD);
         }
         else
         {
            Alert.smileAlart("领取礼包次数已用光");
         }
      }

      private function backToYouthGameOver(e:Event) : void
      {
         BC.removeEvent(this,GV.onlineSocket,"backToYouthGameOver",this.backToYouthGameOver);
         mapSay(101);
      }

      private function youthChangeMap(e:SystemEvent) : void
      {
         var mapArr:Array = [41,43,42,8,80,330,240];
         var index:uint = Math.floor(Math.random() * 7);
         ActivityTmpDataManager.randomMapID = mapArr[index];
         MapManager.enterMap(mapArr[index]);
      }

      private function bufferHanalde(e:EventTaomee) : void
      {
         BufferManager.removeBufferEvent(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,this.bufferHanalde);
         this._kfcChrisStep = uint(e.EventObj);
         if(this._kfcChrisStep == 2 || this._kfcChrisStep == 3)
         {
            if(Boolean(this._bottleTip_mc))
            {
               this._bottleTip_mc.visible = true;
            }
         }
         else if(Boolean(this._bottleTip_mc))
         {
            DisplayUtil.removeForParent(this._bottleTip_mc);
         }
      }

      private function jiaoYouHandle(e:SystemEvent) : void
      {
         var oneItemhandle:Function = null;
         var query:QueryItemCntManager = null;
         if(TaskManager.getTask(594).state != 2)
         {
            Alert.angryAlart("  小摩尔没有完成“大小摩尔去郊游”任务哦！");
         }
         else
         {
            oneItemhandle = function(e:EventTaomee):void
            {
               query.removeEventListener(QueryItemCntManager.ONEITEM_QUERY,oneItemhandle);
               var num:uint = uint(e.EventObj);
               if(num == 0)
               {
                  Alert.angryAlart("  小摩尔已经兑换过奖励了!");
               }
               else
               {
                  BC.addEvent(this,GV.onlineSocket,"read_" + CommandID.TreasureBowl,GetRandomGift);
                  superlamuPartySocket.treasurebowl(127);
               }
            };
            query = new QueryItemCntManager();
            query.addEventListener(QueryItemCntManager.ONEITEM_QUERY,oneItemhandle);
            query.oneItemQuery(191083);
         }
      }

      private function GetRandomGift(e:EventTaomee) : void
      {
         BC.removeEvent(this,GV.onlineSocket,"read_" + CommandID.TreasureBowl,this.GetRandomGift);
         if(e.EventObj.type == 127)
         {
            BC.removeEvent(this,GV.onlineSocket,"read_" + CommandID.TreasureBowl,this.GetRandomGift);
            Alert.smileAlart("    恭喜你获得" + GoodsInfo.getItemNameByID(e.EventObj.itemId));
         }
      }

      private function requestInvitCount() : void
      {
         OnlineManager.addCmdListener(CommandID.ITEMCOUNT,this.getInvitCount);
         GetItemCountReq.getItemCount(LocalUserInfo.getUserID(),12273,2);
      }

      private function getInvitCount(e:SocketEvent) : void
      {
         OnlineManager.removeCmdListener(CommandID.ITEMCOUNT,this.getInvitCount);
         var itemPro:GetItemCountRes = e.bodyInfo;
         var info:ItemInfo = itemPro.itemHash.getValue(12273);
         if(Boolean(info))
         {
            if(info.count > 0)
            {
               Alert.smileAlart("　　小摩尔已经拥有蛛丝隐身衣咯！");
            }
            else
            {
               ModuleManager.openPanel(ModuleType.CLOAKCLOTHESPANEL);
            }
         }
         else
         {
            ModuleManager.openPanel(ModuleType.CLOAKCLOTHESPANEL);
         }
      }

      private function onOpenPassBook(e:MouseEvent) : void
      {
         controlLevel.passBtn_1.gotoAndPlay(2);
         MovieClipUtil.playEndAndFunc(controlLevel.passBtn_1,function():void
         {
            controlLevel.passBtn_1.gotoAndStop(1);
            showPassBook();
         });
      }

      private function onOpenMagic1(e:MouseEvent) : void
      {
         ModuleManager.openPanel(ModuleType.MAGICAL_PASS_PANEL + "1");
      }

      private function onOpenMermaid(e:MouseEvent) : void
      {
         ModuleManager.openPanel(ModuleType.SUMMER_MAIN_PANEL);
      }

      private function initStarHandler() : void
      {
         if(GV.MAN_PEOPLE.Petlevel == 101)
         {
            controlLevel.starBtn.visible = true;
            petItemModule.setPetEffectHandler(null,2);
            BC.addEvent(this,controlLevel.starBtn,MouseEvent.CLICK,this.getStarEvent);
         }
      }

      private function getStarEvent(evt:MouseEvent) : void
      {
         controlLevel.starBtn.visible = false;
         petItemModule.setPetEffectHandler();
         GV.itemID = 3;
         var itemObj:Object = new Object();
         itemObj.id = 12619;
         itemObj.price = 0;
         itemObj.info = "";
         clothBuyModule.buyAction(itemObj);
      }

      private function showPassBook() : void
      {
         var url:String = null;
         url = "module/external/CoinBookUI/pwdBook.swf";
         new LoadGame(url,"正在打开神奇密码领取册",MainManager.getGameLevel());
      }

      private function ShowClorEditor(evt:MouseEvent) : void
      {
         if(!MainManager.getAppLevel().getChildByName("effectMC"))
         {
            if(this._kfcChrisStep == 2)
            {
               BufferManager.setBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,3);
            }
            this.effectMC = new MovieClip();
            this.effectMC.name = "effectMC";
            MainManager.getAppLevel().addChild(this.effectMC);
            this.effectClass = new MCLoader("module/colorEditor/colorEditor.swf",this.effectMC,Loading.TITLE_AND_PERCENT,"正在打开调色面板");
            this.effectClass.addEventListener(MCLoadEvent.ON_SUCCESS,this.loadEditorHandler);
            this.effectClass.doLoad();
         }
      }

      private function loadEditorHandler(evt:MCLoadEvent) : void
      {
         this.effectClass.removeEventListener(MCLoadEvent.ON_SUCCESS,this.loadEditorHandler);
         var mainMC:DisplayObjectContainer = evt.getParent();
         var childMC:Loader = evt.getLoader();
         mainMC.addChild(childMC);
         mainMC.x = (MainManager.getStageWidth() - mainMC.width) / 2;
         mainMC.y = (MainManager.getStageHeight() - mainMC.height) / 2;
         var tempEffect:colorEditorView = new colorEditorView(childMC);
         this.effectClass.clear();
      }

      private function getPassEvent(evt:EventTaomee) : void
      {
         this.passItem = evt.EventObj.id;
         AladdinPWDReq.usePWD32Req(pwd,LocalUserInfo.getUserID(),[this.passItem]);
      }

      private function getPassSUC(evt:EventTaomee) : void
      {
         GV.onlineSocket.removeEventListener(AladdinPWDRes.USE_AladdinPWD_SUCC_NEW,this.getPassSUC);
         var msg:String = ClothAccountLogic.getAddress(this.passItem);
         GF.showAlert(MainManager.getGameLevel(),msg,"",100,"iknow",true,false,"E");
      }

      private function overHandler(event:MouseEvent) : void
      {
         controlLevel.changeBtn.gotoAndPlay(2);
      }

      private function outHandler(event:MouseEvent) : void
      {
         controlLevel.changeBtn.gotoAndStop(1);
      }

      private function changeHandler(event:MouseEvent) : void
      {
         var changeMC:MovieClip = null;
         var tempMC:MCLoader = null;
         if(!MainManager.getAppLevel().getChildByName("changeMC"))
         {
            if(this._kfcChrisStep == 2)
            {
               BufferManager.setBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,3);
               BufferManager.getBuffer(BufferManager.KFC_MAGIC_CHRISTMAS_HAT);
            }
            changeMC = new MovieClip();
            changeMC.name = "changeMC";
            MainManager.getAppLevel().addChild(changeMC);
            tempMC = new MCLoader("module/external/ChangePetColor.swf",changeMC,1,"正在打开宠物颜色兑换系统......");
            tempMC.addEventListener(MCLoadEvent.ON_SUCCESS,this.ivrLoaderOver);
            tempMC.doLoad();
         }
      }

      private function ivrLoaderOver(evt:MCLoadEvent) : void
      {
         var mainMC:DisplayObjectContainer = evt.getParent();
         var childMC:Loader = evt.getLoader();
         mainMC.addChild(childMC);
         var mcloader:MCLoader = evt.target as MCLoader;
         mcloader.removeEventListener(MCLoadEvent.ON_SUCCESS,this.ivrLoaderOver);
         mcloader.clear();
      }

      private function showAladdin(evt:Event) : void
      {
         ModuleManager.openPanel(ModuleType.MAGICAL_PASS_PANEL);
      }

      private function UsePWDResultNew(evt:EventTaomee) : void
      {
         var itemValue:String = null;
         var item:Object = null;
         var url:String = null;
         var info:String = null;
         var obj:Object = evt.EventObj;
         var itemId:int = int(obj.arr[0].id);
         if(obj.flag == 0)
         {
            itemValue = "";
            for each(item in obj.arr)
            {
               itemValue += GoodsInfo.getItemNameByID(item.id) + ",";
            }
            itemValue = itemValue.substr(0,itemValue.length - 1);
            url = GoodsInfo.getItemPathByID(itemId) + itemId + ".swf";
            info = "恭喜你，你获得了" + itemValue + "！";
            if(GoodsInfo.getType(itemId) == 18)
            {
               url = "resource/farm/icon/" + itemId + ".swf";
               info = "        神奇密码箱开启了！\n    恭喜你获得了" + GoodsInfo.getItemNameByID(itemId) + "。";
            }
            if(info.length < 20)
            {
               info = "    " + info;
            }
            Alert.showAlert(MainManager.getAppLevel(),url,info,Alert.CHANG_ALERT,"iknow",true,false,"EMP_BUY");
         }
         else
         {
            Alert.showAlert(MainManager.getAppLevel(),"","不能太贪心哦，你已经拥有这个物品了！",Alert.IKNOW_ALERT);
         }
      }

      private function lightClickHandler(evt:MouseEvent) : void
      {
         if(Boolean(evt.target.parent.bool))
         {
            evt.target.parent.gotoAndPlay(2);
            evt.target.parent.bool = false;
         }
         else
         {
            evt.target.parent.gotoAndStop(1);
            evt.target.parent.bool = true;
         }
      }

      private function boxOverHandler(evt:MouseEvent) : void
      {
         evt.target.parent.gotoAndPlay(2);
      }

      private function boxOutHandler(evt:MouseEvent) : void
      {
         evt.target.parent.gotoAndStop(1);
      }

      private function doorOverHandler(evt:MouseEvent) : void
      {
         controlLevel.door_mc.gotoAndPlay(2);
      }

      private function doorOutHandler(evt:MouseEvent) : void
      {
         controlLevel.door_mc.gotoAndStop(1);
      }

      private function onPlayCrystal(e:SystemEvent) : void
      {
         var resID:int = int(DownLoadManager.add("module/external/CrystalBall.swf",ResType.DISPLAY_OBJECT));
         DownLoadManager.addEvent(resID,this.loadCrystalOver);
         LoadingPanel.addRes(resID);
      }

      private function loadCrystalOver(e:DownLoadEvent) : void
      {
         MainManager.getAppLevel().addChild(e.data);
      }

      private function onMagicCode(e:SystemEvent) : void
      {
         GV.onlineSocket.dispatchEvent(new Event("move_for_game"));
      }

      private function onChoseCorrect(e:SystemEvent) : void
      {
         this.requestInvitCount();
      }

      override public function destroy() : void
      {
         GV.onlineSocket.removeCmdListener(CommandID.CLI_PROTO_GET_FIFTYCARD_REWARD,this.rewardedHandle);
         GV.onlineSocket.removeCmdListener(CommandID.CLI_PROTO_QUERY_FIFTY_CHARGECARD,this.getTimeHandle);
         SystemEventManager.removeEventListener("getmmcardReward",this.getcardReward);
         SystemEventManager.removeEventListener("jiaoyou",this.jiaoYouHandle);
         controlLevel.bottle_mc.btn.removeEventListener(MouseEvent.MOUSE_OVER,this.boxOverHandler);
         controlLevel.bottle_mc.btn.removeEventListener(MouseEvent.MOUSE_OUT,this.boxOutHandler);
         controlLevel.bottle_mc.btn.removeEventListener(MouseEvent.CLICK,this.ShowClorEditor);
         GV.onlineSocket.removeEventListener(AladdinPWDRes.USE_AladdinPWD_SUCC_NEW,this.getPassSUC);
         GV.onlineSocket.removeEventListener(AladdinPWDRes.USE_AladdinPWD_SUCC_NEW,this.UsePWDResultNew);
         GV.onlineSocket.removeEventListener("move_for_game",this.showAladdin);
         controlLevel.passBtn_1.removeEventListener(MouseEvent.CLICK,this.onOpenPassBook);
         controlLevel.door_1.removeEventListener(MouseEvent.MOUSE_OVER,this.doorOverHandler);
         controlLevel.door_1.removeEventListener(MouseEvent.MOUSE_OUT,this.doorOutHandler);
         controlLevel.changeBtn.removeEventListener(MouseEvent.CLICK,this.changeHandler);
         controlLevel.changeBtn.removeEventListener(MouseEvent.MOUSE_OVER,this.overHandler);
         controlLevel.changeBtn.removeEventListener(MouseEvent.MOUSE_OUT,this.outHandler);
         for(var i:int = 1; i <= 4; i++)
         {
            controlLevel["bookMC_" + i].btn.removeEventListener(MouseEvent.MOUSE_OVER,this.boxOverHandler);
            controlLevel["bookMC_" + i].btn.removeEventListener(MouseEvent.MOUSE_OVER,this.boxOutHandler);
         }
         for(var j:int = 1; j <= 2; j++)
         {
            controlLevel["ligthMC_" + j].btn.removeEventListener(MouseEvent.CLICK,this.lightClickHandler);
         }
         SystemEventManager.removeEventListener("isOpenCloakClothesPanel",this.onChoseCorrect);
         BufferManager.removeBufferEvent(BufferManager.KFC_MAGIC_CHRISTMAS_HAT,this.bufferHanalde);
         super.destroy();
      }
   }
}
