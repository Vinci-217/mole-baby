package com.molebaby.ramu;

import android.content.*;
import android.os.*;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.uiautomator.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import java.util.concurrent.*;
import java.util.function.BooleanSupplier;
import static org.junit.Assert.*;

/** Real WebView + Activity/overlay lifecycle, not a second simulation of the pet. */
@RunWith(AndroidJUnit4.class)
public final class AndroidSmokeTest {
    static final long TIMEOUT=240000;
    static final android.app.Instrumentation instrumentation=InstrumentationRegistry.getInstrumentation();
    static Context context(){return instrumentation.getTargetContext();}
    static RamuHost host(){return ((RamuApplication)context().getApplicationContext()).host();}
    static void ui(Runnable run){instrumentation.runOnMainSync(run);}
    static void waitFor(BooleanSupplier ready)throws Exception{waitFor(ready,30000,"Timed out waiting for Android state");}
    static void waitFor(BooleanSupplier ready,long timeout,String expected)throws Exception{long until=SystemClock.elapsedRealtime()+timeout;while(!ready.getAsBoolean()){if(SystemClock.elapsedRealtime()>until)throw new AssertionError(expected);SystemClock.sleep(100);}}
    static String js(String expression)throws Exception{CountDownLatch latch=new CountDownLatch(1);String[] value={null};ui(()->host().web.evaluateJavascript(expression,result->{value[0]=result;latch.countDown();}));assertTrue("JS callback",latch.await(20,TimeUnit.SECONDS));return value[0];}
    static boolean has(String selector){try{return "true".equals(js("Boolean(document.querySelector("+JSONObject.quote(selector)+"))"));}catch(Exception e){return false;}}
    static void tap(String expression)throws Exception{
        String script="(()=>{const e="+expression+";if(!e||e.disabled)return null;e.scrollIntoView({block:'nearest',inline:'nearest'});const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);if(!r.width||!r.height||!hit||!(e===hit||e.contains(hit)))return null;return {x,y,viewport:innerWidth};})()";
        String[] result={null};waitFor(()->{try{result[0]=js(script);return result[0]!=null&&!result[0].equals("null");}catch(Exception e){return false;}},30000,"Button must be usable by a real finger: "+expression);
        JSONObject point=new JSONObject(result[0]);int[] location=new int[2],width=new int[1];ui(()->{host().web.getLocationOnScreen(location);width[0]=host().web.getWidth();});double scale=width[0]/point.getDouble("viewport");
        js("window.__moleTestPointer=null;document.addEventListener('pointerdown',e=>window.__moleTestPointer={x:e.clientX,y:e.clientY,target:e.target.closest('button,input')?.outerHTML?.slice(0,300)},{once:true})");
        assertTrue(UiDevice.getInstance(instrumentation).click(location[0]+(int)Math.round(point.getDouble("x")*scale),location[1]+(int)Math.round(point.getDouble("y")*scale)));SystemClock.sleep(180);
    }
    static void click(String selector)throws Exception{tap("document.querySelector("+JSONObject.quote(selector)+")");}
    static void textButton(String text)throws Exception{tap("Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==="+JSONObject.quote(text)+")");}
    static void drawn()throws Exception{CountDownLatch latch=new CountDownLatch(1);ui(()->{host().web.postVisualStateCallback(SystemClock.uptimeMillis(),new WebView.VisualStateCallback(){@Override public void onComplete(long requestId){latch.countDown();}});host().web.postInvalidateOnAnimation();});assertTrue("The real WebView compositor must present its current page",latch.await(20,TimeUnit.SECONDS));SystemClock.sleep(600);}
    static void shell(String command)throws Exception{try(ParcelFileDescriptor fd=instrumentation.getUiAutomation().executeShellCommand(command);InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){while(in.read()!=-1){}}}
    static void rotateDisplay(UiDevice device,boolean landscape)throws Exception{
        context().startActivity(new Intent().setClassName(instrumentation.getContext().getPackageName(),RotationFixtureActivity.class.getName())
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("landscape",landscape));
        waitFor(()->(device.getDisplayWidth()>device.getDisplayHeight())==landscape,15000,"The foreground test app must actually rotate the physical display");
    }
    @Test public void adoptionCareOverlayAndRecoveryKeepOnePet()throws Exception{
        shell("appops set "+context().getPackageName()+" SYSTEM_ALERT_WINDOW allow");
        if(Build.VERSION.SDK_INT>=33)shell("pm grant "+context().getPackageName()+" android.permission.POST_NOTIFICATIONS");
        instrumentation.startActivitySync(new Intent(context(),RamuActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        try{
            waitFor(()->host().loaded&&has("[aria-label='选择蓝色拉姆']"),TIMEOUT,"First offline asset preparation and page load");assertFalse(host().controller.petMode);assertFalse(host().controller.attached);
            click("[aria-label='选择蓝色拉姆']");textButton("给它起名");waitFor(()->has("#pet-name"));
            js("(()=>{const input=document.querySelector('#pet-name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'安卓小蓝');input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();})()");ui(()->context().getSystemService(android.view.inputmethod.InputMethodManager.class).hideSoftInputFromWindow(host().web.getWindowToken(),0));SystemClock.sleep(300);textButton("带拉姆回家！");waitFor(()->has(".room-dock"));
            assertFalse("Adoption opens the house without starting an overlay",host().controller.petMode);
            waitFor(()->host().store.pet().optString("name").equals("安卓小蓝"));long petId=host().store.pet().getLong("createdAt");WebView runtime=host().web;
            waitFor(()->{try{return "true".equals(js("Array.from(document.images).filter(im=>im.getBoundingClientRect().width>0&&im.getBoundingClientRect().height>0).every(im=>im.complete&&im.naturalWidth>0)"));}catch(Exception e){return false;}},30000,"All visible original artwork must load from the active private resource pack");
            click(".room-dock [aria-label='打开背包']");waitFor(()->has(".pocket-items"));assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth"));
            click("[aria-label='关闭面板']");click(".room-dock [aria-label='陪伴设置']");waitFor(()->has("[aria-label='安卓陪伴设置']"));assertEquals("true",js("document.documentElement.scrollWidth<=innerWidth"));
            try{waitFor(()->host().musicPlaying,30000,"Built-in music should play in the house");}catch(AssertionError error){throw new AssertionError("Audio diagnostic: "+js("(()=>{const a=document.querySelector('audio[data-ramu-bgm]');return {audio:!!a,ready:a?.readyState,network:a?.networkState,paused:a?.paused,error:a?.error?.code,visible:document.visibilityState,prefs:localStorage.getItem('ramu-room-media-v1')}})()"));}SystemClock.sleep(1000);assertTrue("Native audio focus must not pause our own WebView",host().musicPlaying);
            click("[aria-label='允许后台播放音乐']");waitFor(()->host().backgroundMusic&&host().service!=null,10000,"Enabling background music should start its foreground service");UiDevice device=UiDevice.getInstance(instrumentation);device.pressHome();SystemClock.sleep(1200);assertTrue("Opted-in music should continue when the house is backgrounded",host().musicPlaying);
            device.openNotification();UiObject musicHome=device.findObject(new UiSelector().text("安卓小蓝在陪着你"));assertTrue(musicHome.waitForExists(10000));musicHome.click();waitFor(()->host().activityVisible&&has("[aria-label='允许后台播放音乐']"));click("[aria-label='允许后台播放音乐']");waitFor(()->!host().backgroundMusic);
            click("[aria-label='关闭面板']");textButton("悬浮陪伴");waitFor(()->host().controller.attached&&host().controller.petMode);assertSame(runtime,host().web);assertEquals(petId,host().store.pet().getLong("createdAt"));
            waitFor(()->has("[data-testid='desktop-character']"));
            int[] location=new int[2];ui(()->host().controller.position(60,120));SystemClock.sleep(250);ui(()->host().web.getLocationOnScreen(location));float beforeDrag=host().controller.x;
            device.swipe(location[0]+host().controller.px(80),location[1]+host().controller.px(125),location[0]+host().controller.px(150),location[1]+host().controller.px(140),18);
            waitFor(()->host().controller.x>beforeDrag+10,10000,"A real finger drag should move the seed pet window");
            SystemClock.sleep(1000);
            drawn();device.takeScreenshot(new File(context().getExternalFilesDir(null),"android-floating.png"));
            // The house Activity may be destroyed while its retained pet lives
            // in the service. Rotation must still keep the overlay on screen.
            waitFor(()->host().service!=null);ui(()->host().activity.finish());waitFor(()->host().activity==null);assertTrue(host().controller.attached);
            // Run another real app: AOSP Launcher's portrait lock prevents a
            // UiDevice rotation request from exercising the service at all.
            ui(()->host().controller.position(80,host().controller.area().y-180));rotateDisplay(device,true);
            waitFor(()->host().controller.area().x>host().controller.area().y&&host().controller.y<=host().controller.area().y-178,10000,"The floating service must reposition after rotation even without an Activity");
            assertNull("Rotation must not recreate the house Activity",host().activity);assertSame(runtime,host().web);assertTrue(host().controller.attached);
            drawn();device.takeScreenshot(new File(context().getExternalFilesDir(null),"android-floating-landscape.png"));
            rotateDisplay(device,false);waitFor(()->host().controller.area().y>host().controller.area().x);device.pressHome();
            // Seed pets can be dragged and docked, even though they cannot wander.
            ui(()->{host().controller.interacting=false;host().controller.position(-30,200);host().controller.dock();});waitFor(()->"hidden".equals(host().controller.edgePose));assertEquals("left",host().controller.edgeSide);
            ui(()->host().controller.peek(true));assertEquals("left",host().controller.edgeSide);assertEquals("peek",host().controller.edgePose);
            ui(()->{host().controller.downX=0;host().controller.downY=200;host().controller.startDrag(Json.of("x",-30,"y",0));host().controller.rawX=150;host().controller.rawY=230;host().controller.drag();host().controller.endDrag();});assertNull(host().controller.edgeSide);assertTrue(host().controller.x>0);
            ui(()->host().controller.through(true));assertTrue(host().controller.mouseThrough);
            device.openNotification();UiObject recover=device.findObject(new UiSelector().text("恢复触摸"));assertTrue("Notification must expose recovery",recover.waitForExists(10000));recover.click();waitFor(()->!host().controller.mouseThrough);
            device.openNotification();UiObject home=device.findObject(new UiSelector().text("安卓小蓝在陪着你"));assertTrue("Notification body opens the house",home.waitForExists(10000));home.click();waitFor(()->host().activityVisible&&!host().controller.petMode&&has(".room-dock"));assertSame(runtime,host().web);assertEquals(petId,host().store.pet().getLong("createdAt"));
            context().getSharedPreferences("upgrade-fixture",0).edit().putLong("petId",petId).putInt("code",context().getPackageManager().getPackageInfo(context().getPackageName(),0).versionCode).commit();host().store.flush();
            drawn();File picture=new File(context().getExternalFilesDir(null),"android-house.png");device.takeScreenshot(picture);
            RamuActivity previous=host().activity;ui(previous::recreate);waitFor(()->host().activity!=null&&host().activity!=previous&&host().activityVisible&&has(".room-dock"));assertEquals(petId,host().store.pet().getLong("createdAt"));assertSame(runtime,host().web);
            drawn();
        }finally{
            try{UiDevice.getInstance(instrumentation).takeScreenshot(new File(context().getExternalFilesDir(null),"android-last-screen.png"));if(host().web!=null){JSONObject diagnostic=Json.parse(js("({text:document.body.innerText.slice(0,5000),pointer:window.__moleTestPointer,visible:document.visibilityState,viewport:[innerWidth,innerHeight],audio:(()=>{const a=document.querySelector('audio[data-ramu-bgm]');return a?{ready:a.readyState,paused:a.paused,error:a.error?.code}:null})()})"));diagnostic.put("native",host().controller.state());diagnostic.put("display",Json.of("width",host().controller.area().x,"height",host().controller.area().y,"petX",host().controller.x,"petY",host().controller.y));SafeFiles.writeText(new File(context().getExternalFilesDir(null),"android-ui-state.txt"),diagnostic.toString());}}catch(Exception ignored){}
            try{rotateDisplay(UiDevice.getInstance(instrumentation),false);UiDevice.getInstance(instrumentation).pressHome();}catch(Exception ignored){}
            ui(()->{if(host().activity!=null)host().activity.finish();});
        }
    }
}
