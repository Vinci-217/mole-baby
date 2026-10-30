package com.molebaby.ramu;

import android.webkit.JavascriptInterface;
import org.json.*;

/** Tiny allowlisted RPC; all window operations run on the Android main thread. */
public final class NativeBridge {
    final RamuHost host;
    NativeBridge(RamuHost host){this.host=host;}
    @JavascriptInterface public String bootstrap(){return Json.of("storage",host.store.snapshot(),"permissions",host.permissions(),"state",host.controller.state()).toString();}
    @JavascriptInterface public boolean persist(String key,String value){boolean ok=host.store.put(key,value);if(ok)host.main.post(host::syncActivity);return ok;}
    @JavascriptInterface public void invoke(String id,String method,String raw){if(id==null||id.length()>64||method==null||raw==null||raw.length()>1200000)return;JSONObject args=Json.parse(raw);host.main.post(()->{try{Object result=call(method,args,id);if(result!=Deferred.INSTANCE)host.reply(id,result,null);}catch(Exception e){host.reply(id,null,e.getMessage()==null?"安卓操作暂时失败，请重试":e.getMessage());}});}
    private enum Deferred{INSTANCE}
    Object call(String method,JSONObject a,String id)throws Exception{
        PetController c=host.controller;
        switch(method){
            case"getState":return c.state();
            case"setPetMode":return c.mode(a.optBoolean("enabled"));
            case"readyToShow":return true;
            case"setPetStatus":host.store.status(a.optJSONObject("status")==null?new JSONObject():a.getJSONObject("status"));host.refreshService();return true;
            case"setPetCanMove":c.canMove=a.optBoolean("enabled");return c.canMove;
            case"setPetAppearance":c.form=a.optString("form","seed");return c.state();
            case"setCompanionPanel":c.panel(a.optBoolean("open"));return c.state();
            case"setPetEffectBounds":c.effect(a.optJSONObject("bounds"));return c.state();
            case"preparePetDrag":c.cancelMotion();return true;
            case"startPetDrag":c.startDrag(a);return true;
            case"dragPetToCursor":c.drag();return true;
            case"endPetDrag":c.endDrag();return true;
            case"movePet":c.position(c.x+(float)a.optDouble("dx"),c.y+(float)a.optDouble("dy"));return true;
            case"wander":c.wandering=a.optBoolean("enabled");host.store.prefs.edit().putBoolean("native-wander",c.wandering).apply();c.emit();return c.wandering;
            case"setEdgeHiding":c.edgeHiding=a.optBoolean("enabled");host.store.prefs.edit().putBoolean("native-edge",c.edgeHiding).apply();if(!c.edgeHiding)c.reveal();c.emit();return c.edgeHiding;
            case"revealPet":c.reveal();return c.state();
            case"setEdgeHovered":c.peek(a.optBoolean("hovered"));return c.state();
            case"setInteracting":c.interacting=a.optBoolean("enabled");return c.interacting;
            case"setMouseThrough":c.through(a.optBoolean("enabled"));return c.mouseThrough;
            case"toggleAlwaysOnTop":return true;
            case"setMousePassthrough":return true;
            case"setRoomFullscreen":c.fullscreen=a.optBoolean("enabled");if(host.activity!=null)host.activity.fullscreen(c.fullscreen);c.emit();return c.fullscreen;
            case"startRoomResize":case"adjustRoomSize":return false;
            case"endRoomResize":return true;
            case"minimize":case"close":case"hideToTray":host.background();return true;
            case"openManorSite":host.openUrl("https://www.61.com/");return true;
            case"setMusicState":host.music(a);return true;
            case"notify":if(!host.activityVisible)Notifications.reminder(host.context,876,a.optString("title","拉姆"),a.optString("body"));return true;
            case"permissions":return host.permissions();
            case"permission":host.openPermission(a.optString("kind"));return true;
            case"exportSave":if(host.activity==null)throw new IllegalStateException("请先回到小屋导出存档");host.activity.export(a.getString("text"),a.optString("name","ramu.json"),id);return Deferred.INSTANCE;
            case"scheduleReminder":ReminderReceiver.schedule(host.context,a.getString("id"),a.getLong("at"),a.getString("title"),a.getString("body"));return true;
            case"cancelReminder":ReminderReceiver.cancel(host.context,a.getString("id"));return true;
            case"wasNotified":return host.context.getSharedPreferences("fired",0).contains(a.getString("id"));
            case"prepared":host.saved(a.optString("token"),a.optBoolean("ok"));return true;
            case"updatesState":return host.updates.state();
            case"updatesCheck":host.updates.check();return true;
            case"updatesDownload":host.updates.download();return true;
            case"updatesInstall":host.updates.install();return true;
            case"updatesEnabled":host.updates.enabled(a.optBoolean("enabled"));return host.updates.state();
            case"updatesPolicy":host.updates.policy(a.optString("policy"));return host.updates.state();
            case"updatesBusy":host.updates.busy=a.optBoolean("busy");return true;
            case"updatesCancel":host.updates.cancel();return true;
            case"updatesWifi":host.store.prefs.edit().putBoolean("updates-wifi",a.optBoolean("enabled")).apply();host.event("permissions",host.permissions());return host.permissions();
            case"updatesOpenRelease":host.openUrl("https://github.com/Vinci-217/mole-baby/releases/tag/android-preview");return true;
            default:throw new IllegalArgumentException("不支持的安卓接口");
        }
    }
}
