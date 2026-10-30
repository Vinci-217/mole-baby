package com.molebaby.ramu;

import android.animation.ValueAnimator;
import android.content.*;
import android.graphics.Point;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.view.animation.DecelerateInterpolator;
import org.json.*;
import java.util.Random;

/** Coordinates are DIPs, matching the renderer's original animation geometry. */
final class PetController {
    final RamuHost host;
    final WindowManager windows;
    final Handler main=new Handler(Looper.getMainLooper());
    final Random random=new Random();
    WindowManager.LayoutParams params;
    boolean petMode,attached,mouseThrough,wandering,canMove,interacting,dragging,panel,edgeHiding=true;
    boolean fullscreen;
    String edgeSide,edgePose="visible",motion="idle",form="seed";
    float x=120,y=240,rawX,rawY,downX,downY,startX,startY,lastX,lastY,velocityX,velocityY;
    long sampleAt,peekAt;
    int width=160,height=240;
    int effectX,effectY;
    boolean effectExpanded;
    boolean widePanel;
    int panelPetX,panelPetY,panelTop;
    ValueAnimator animation;
    PetController(RamuHost host){this.host=host;windows=host.context.getSystemService(WindowManager.class);var prefs=host.store.prefs;x=prefs.getFloat("overlay-x",120);y=prefs.getFloat("overlay-y",240);wandering=prefs.getBoolean("native-wander",true);edgeHiding=prefs.getBoolean("native-edge",true);main.postDelayed(ambient,60000);}
    int px(float dp){return Math.round(dp*host.context.getResources().getDisplayMetrics().density);}
    float dp(float px){return px/host.context.getResources().getDisplayMetrics().density;}
    Point area(){Point size=new Point();if(Build.VERSION.SDK_INT>=30){var bounds=windows.getMaximumWindowMetrics().getBounds();size.set(Math.round(dp(bounds.width())),Math.round(dp(bounds.height())));}else{windows.getDefaultDisplay().getRealSize(size);size.set(Math.round(dp(size.x)),Math.round(dp(size.y)));}return size;}
    boolean permission(){return Settings.canDrawOverlays(host.context);}
    JSONObject state(){
        JSONObject geometry=panel?Json.of("petX",panelPetX,"petY",panelPetY,"panelX",widePanel?168:8,"panelY",panelTop,"panelWidth",widePanel?width-176:width-16,"panelHeight",height-panelTop-8,"scale",1):null;
        JSONObject result=Json.of("petMode",petMode,"alwaysOnTop",true,"wandering",wandering,"companionPanel",panel,"panelSide","right","panelLayout","compact","panelGeometry",geometry,"petOffset",Json.of("x",effectX,"y",effectY),"edgeHiding",edgeHiding,"edgeSide",edgeSide,"edgePose",edgePose,"motion",motion,"mouseThrough",mouseThrough,"mousePassthrough",false,"roomFullscreen",fullscreen,"windowVisible",attached||host.activityVisible,"effectExpanded",effectExpanded);
        if(dragging)try{result.put("dragPoint",Json.of("x",rawX,"y",rawY,"at",System.currentTimeMillis()));}catch(JSONException ignored){}
        return result;
    }
    void emit(){host.event("state",state());}
    void attach(){
        if(attached||!petMode||!permission()||host.web==null)return;
        host.detachWeb();onConfigurationChanged();
        if(host.webContext!=null)host.webContext.setBaseContext(host.context);
        params=new WindowManager.LayoutParams(px(width),px(height),WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL|WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS|WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,android.graphics.PixelFormat.TRANSLUCENT);
        params.gravity=Gravity.TOP|Gravity.LEFT;params.x=px(x);params.y=px(y);params.setTitle("mole-baby pet");
        host.web.setBackgroundColor(android.graphics.Color.TRANSPARENT);windows.addView(host.web,params);attached=true;applyTouch();host.web.onResume();emit();
    }
    void detach(){cancelMotion();if(attached&&host.web!=null){try{windows.removeViewImmediate(host.web);}catch(IllegalArgumentException ignored){}}attached=false;params=null;}
    boolean mode(boolean value)throws Exception{
        if(value&&!permission()){host.openPermission("overlay");throw new IllegalStateException("请先允许拉姆显示在其他应用上层，再点击悬浮陪伴。");}
        if(value){petMode=true;host.startService();if(host.loaded)attach();if(host.activity!=null)host.activity.moveTaskToBack(true);}
        else{leaveOverlay();if(host.activity!=null&&host.activityVisible)host.activity.attachWeb();else host.context.startActivity(new Intent(host.context,RamuActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP));host.refreshService();}
        emit();return petMode;
    }
    /** Both the in-game home button and the notification resume the same pet.
     * Restore its anchor before discarding a panel or expanded effect frame. */
    void leaveOverlay(){
        cancelMotion();
        dragging=false;
        clearEffect();
        if(panel){x+=panelPetX;y+=panelPetY;}
        petMode=false;
        panel=false;
        widePanel=false;
        panelPetX=panelPetY=panelTop=0;
        width=160;height=240;
        edgeSide=null;edgePose="visible";peekAt=0;
        detach();
    }
    void applyTouch(){if(params!=null){params.flags=mouseThrough?params.flags|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE:params.flags&~WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE;params.alpha=mouseThrough?.75f:1f;update();}host.refreshService();emit();}
    void through(boolean enabled){if(enabled&&!host.permissions().optBoolean("notifications"))throw new IllegalStateException("请先允许通知，穿透后需要从通知栏恢复触摸。");mouseThrough=enabled;applyTouch();}
    void position(float nx,float ny){Point a=area();x=Math.max(-30,Math.min(a.x-130,nx));y=Math.max(-70,Math.min(a.y-178,ny));update();}
    private void update(){if(attached&&params!=null){params.x=px(x);params.y=px(y);params.width=px(width);params.height=px(height);try{windows.updateViewLayout(host.web,params);}catch(IllegalArgumentException ignored){}}}
    void touch(android.view.MotionEvent event){
        long now=event.getEventTime();float nx=dp(event.getRawX()),ny=dp(event.getRawY());
        if(event.getActionMasked()==MotionEvent.ACTION_DOWN){cancelMotion();downX=nx;downY=ny;startX=x;startY=y;velocityX=velocityY=0;lastX=nx;lastY=ny;sampleAt=now;}
        if(event.getActionMasked()==MotionEvent.ACTION_MOVE){long dt=now-sampleAt;if(dt>0&&dt<120){velocityX=.6f*velocityX+.4f*(nx-lastX)/dt;velocityY=.6f*velocityY+.4f*(ny-lastY)/dt;}lastX=nx;lastY=ny;sampleAt=now;}
        rawX=nx;rawY=ny;
    }
    void startDrag(JSONObject painted){
        cancelMotion();dragging=true;
        if(edgeSide!=null){float dx=(float)painted.optDouble("x"),dy=(float)painted.optDouble("y");startX=x+Math.max(-82,Math.min(82,dx));startY=y+Math.max(-92,Math.min(92,dy));position(startX,startY);}
        edgeSide=null;edgePose="visible";panel=false;emit();
    }
    void drag(){if(!dragging)return;position(startX+rawX-downX,startY+rawY-downY);}
    void endDrag(){if(!dragging)return;dragging=false;motion="idle";host.store.prefs.edit().putFloat("overlay-x",x).putFloat("overlay-y",y).apply();
        float speed=(float)Math.hypot(velocityX,velocityY);
        if(speed>.12f){float duration=Math.min(750,180+speed*200);float dx=Math.max(-180,Math.min(180,velocityX*duration*.38f)),dy=Math.max(-140,Math.min(140,velocityY*duration*.38f));animate(x+dx,y+dy,(int)duration,()->dock());}
        else dock();emit();
    }
    void animate(float nx,float ny,int duration,Runnable after){cancelMotion();float sx=x,sy=y;motion=nx<sx?"left":"right";emit();animation=ValueAnimator.ofFloat(0,1);animation.setDuration(duration);animation.setInterpolator(new DecelerateInterpolator());animation.addUpdateListener(a->{float f=(float)a.getAnimatedValue();position(sx+(nx-sx)*f,sy+(ny-sy)*f);});animation.addListener(new android.animation.AnimatorListenerAdapter(){boolean canceled;@Override public void onAnimationCancel(android.animation.Animator a){canceled=true;}@Override public void onAnimationEnd(android.animation.Animator a){animation=null;motion="idle";emit();if(!canceled&&after!=null)after.run();}});animation.start();}
    void cancelMotion(){if(animation!=null){animation.cancel();animation=null;}motion="idle";}
    void dock(){if(!edgeHiding||!petMode||panel||interacting||dragging)return;Point a=area();String side=x<=-22?"left":x>=a.x-138?"right":y<=-62?"top":y>=a.y-186?"bottom":null;if(side==null)return;
        edgeSide=side;edgePose="tucking";emit();String token=side;main.postDelayed(()->{if(token.equals(edgeSide)&&!dragging){edgePose="hidden";peekAt=System.currentTimeMillis()+(120+random.nextInt(181))*1000L;emit();}},1800);
    }
    void reveal(){edgeSide=null;edgePose="visible";Point a=area();position(Math.max(0,Math.min(a.x-160,x)),Math.max(0,Math.min(a.y-240,y)));emit();}
    void peek(boolean hovered){if(edgeSide==null)return;if(hovered){edgePose="peek";emit();main.postDelayed(()->{if(edgeSide!=null&&!dragging){edgePose="hidden";emit();}},4500);}else if("peek".equals(edgePose)){edgePose="hidden";emit();}}
    void panel(boolean open){
        cancelMotion();clearEffect();if(edgeSide!=null)reveal();float anchorX=x+(panel?panelPetX:0),anchorY=y+(panel?panelPetY:0);panel=open;Point a=area();
        if(open){widePanel=a.x>=540;width=widePanel?Math.min(504,a.x):Math.min(340,a.x);height=widePanel?Math.min(364,a.y-32):Math.min(600,a.y-40);panelPetX=widePanel?0:(width-160)/2;panelPetY=widePanel?(height-240)/2:0;panelTop=widePanel?8:Math.min(230,Math.max(180,height-338));position(Math.max(0,Math.min(a.x-width,anchorX-panelPetX)),Math.max(0,Math.min(a.y-height,anchorY-panelPetY)));}
        else{widePanel=false;width=160;height=240;position(anchorX,anchorY);panelPetX=panelPetY=panelTop=0;}
        update();emit();
    }
    private void clearEffect(){if(!effectExpanded)return;x+=effectX;y+=effectY;effectX=effectY=0;effectExpanded=false;width=160;height=240;}
    void effect(JSONObject bounds){
        clearEffect();if(bounds!=null&&petMode&&!panel&&edgeSide==null){
            double bx=bounds.optDouble("x"),by=bounds.optDouble("y"),bw=bounds.optDouble("width"),bh=bounds.optDouble("height");
            if(Double.isFinite(bx)&&Double.isFinite(by)&&Double.isFinite(bw)&&Double.isFinite(bh)&&bw>0&&bh>0&&bw<=1000&&bh<=1000){effectX=(int)Math.ceil(Math.max(0,-bx));effectY=(int)Math.ceil(Math.max(0,-by));width=(int)Math.ceil(Math.max(160,bx+bw))+effectX;height=(int)Math.ceil(Math.max(240,by+bh))+effectY;x-=effectX;y-=effectY;effectExpanded=true;}
        }update();emit();
    }
    void onConfigurationChanged(){
        cancelMotion();
        if(panel)panel(true);
        else{
            Point a=area();
            // Dragging may intentionally expose only part of the pet at an
            // edge. Rotation must keep a visible pet's entire base viewport
            // inside the new display, without shrinking large spell frames.
            float anchorX=Math.max(0,Math.min(Math.max(0,a.x-160),x+effectX));
            float anchorY=Math.max(0,Math.min(Math.max(0,a.y-240),y+effectY));
            if("left".equals(edgeSide))anchorX=-30;
            else if("right".equals(edgeSide))anchorX=a.x-130;
            else if("top".equals(edgeSide))anchorY=-70;
            else if("bottom".equals(edgeSide))anchorY=a.y-178;
            x=anchorX-effectX;y=anchorY-effectY;update();
        }
        emit();
    }
    private final Runnable ambient=new Runnable(){public void run(){
        if(petMode&&attached&&!dragging&&!panel&&!interacting&&!host.locked()){
            if(edgeSide!=null&&peekAt>0&&System.currentTimeMillis()>=peekAt){peek(true);peekAt=System.currentTimeMillis()+(120+random.nextInt(181))*1000L;}
            else if(wandering&&canMove&&edgeSide==null){float dx=random.nextInt(71)-35,dy=random.nextInt(41)-20;animate(x+dx,y+dy,1800+random.nextInt(1200),()->dock());}
        }main.postDelayed(this,30000+random.nextInt(30000));
    }};
}
