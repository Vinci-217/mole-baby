package lamubone_fla
{
   import flash.display.MovieClip;

   [Embed(source="/_assets/assets.swf", symbol="symbol1534")]
   public dynamic class Timeline_314 extends MovieClip
   {

      public function Timeline_314()
      {
         super();
         addFrameScript(0,frame1,8,frame9);
      }

      internal function frame1() : *
      {
         stop();
         loaderInfo.sharedEvents.dispatchEvent(new EventTaomee("petBone1",this));
      }

      internal function frame9() : *
      {
         gotoAndPlay(3);
      }
   }
}
