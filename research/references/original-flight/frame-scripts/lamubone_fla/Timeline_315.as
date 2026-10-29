package lamubone_fla
{
   import flash.display.MovieClip;

   [Embed(source="/_assets/assets.swf", symbol="symbol1538")]
   public dynamic class Timeline_315 extends MovieClip
   {

      public function Timeline_315()
      {
         super();
         addFrameScript(0,frame1,8,frame9);
      }

      internal function frame1() : *
      {
         stop();
         loaderInfo.sharedEvents.dispatchEvent(new EventTaomee("petBone2",this));
      }

      internal function frame9() : *
      {
         gotoAndPlay(3);
      }
   }
}
