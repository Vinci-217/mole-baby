package com.molebaby.ramu;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.media.*;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.view.*;
import android.webkit.*;
import androidx.core.content.ContextCompat;
import androidx.webkit.*;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

/** One game runtime, reparented between the house and the floating window. */
final class RamuHost {
    static final String ORIGIN="https://appassets.androidplatform.net/";
    final Context context;
    final PetStore store;
    final ResourcePack resources;
    final PetController controller;
    final AndroidUpdates updates;
    final Handler main=new Handler(Looper.getMainLooper());
    final ExecutorService io=Executors.newSingleThreadExecutor();
    RamuActivity activity;
    PetService service;
    WebView web;
    MutableContextWrapper webContext;
    boolean loaded,preparing,activityVisible,musicPlaying,musicEnabled,backgroundMusic;
    int prepareProgress;
    String prepareError;
    ValueCallback<Uri[]> chooser;
    private AudioFocusRequest audioFocus;
    private String alarmActivity="";
    private final ConcurrentHashMap<String,CompletableFuture<Boolean>> saveWaiters=new ConcurrentHashMap<>();
    RamuHost(Context context){this.context=context;store=new PetStore(context);resources=new ResourcePack(context);controller=new PetController(this);updates=new AndroidUpdates(this);}
    void ensure(){if(web!=null){if(activity!=null)activity.attachWeb();return;}if(preparing)return;preparing=true;prepareError=null;
        io.execute(()->{try{resources.prepare(progress->{prepareProgress=progress;main.post(()->{if(activity!=null)activity.showProgress(progress);});});main.post(()->{preparing=false;try{android.content.pm.PackageInfo provider=WebView.getCurrentWebViewPackage();if(provider!=null&&Integer.parseInt(provider.versionName.split("\\.")[0])<100)throw new IllegalStateException("WebView 版本过旧");createWeb();}catch(Exception error){web=null;if(activity!=null)activity.showFailure("系统 WebView 无法打开。请在应用管理中启用或升级 Android System WebView / Chrome，再回来重试。");}});}catch(Exception e){prepareError=e.getMessage();main.post(()->{preparing=false;if(activity!=null)activity.showFailure("素材准备失败："+prepareError);});}});
    }
    @android.annotation.SuppressLint({"SetJavaScriptEnabled","JavascriptInterface"})
    void createWeb(){
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        webContext=new MutableContextWrapper(activity==null?context:activity);
        web=new WebView(webContext){@Override public boolean onTouchEvent(MotionEvent event){controller.touch(event);return super.onTouchEvent(event);}};
        web.setBackgroundColor(Color.TRANSPARENT);web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setMediaPlaybackRequiresUserGesture(false);settings.setSupportMultipleWindows(false);settings.setSupportZoom(false);settings.setTextZoom(100);
        if(Build.VERSION.SDK_INT>=29)settings.setForceDark(WebSettings.FORCE_DARK_OFF);
        if(WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING))WebSettingsCompat.setAlgorithmicDarkeningAllowed(settings,false);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/",this::asset).build();
        web.addJavascriptInterface(new NativeBridge(this),"MoleAndroid");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){WebResourceResponse response=loader.shouldInterceptRequest(request.getUrl());return response!=null?response:blocked();}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){String value=request.getUrl().toString();if(value.startsWith(ORIGIN)&&!request.isForMainFrame())return false;if(request.hasGesture()&&request.isForMainFrame()&&value.startsWith("https://"))openUrl(value);return true;}
            @Override public void onPageFinished(WebView view,String url){if(!url.equals(ORIGIN+"index.html"))return;loaded=true;event("state",controller.state());event("permissions",permissions());if(controller.petMode)controller.attach();else if(activity!=null)activity.attachWeb();main.postDelayed(()->{io.execute(resources::prune);if(updates.enabled())updates.check();},8000);}
            @Override public boolean onRenderProcessGone(WebView view,RenderProcessGoneDetail detail){controller.detach();detachWeb();view.destroy();web=null;loaded=false;store.flush();if(activity!=null){activity.showFailure("系统回收了画面，存档仍然保留。点击重新打开。");}return true;}
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame()&&activity!=null)activity.showFailure("页面加载失败，请重新打开。存档不会删除。");}
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){if(activity==null||!activityVisible){callback.onReceiveValue(null);return false;}if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;try{Intent intent=params.createIntent();intent.addCategory(Intent.CATEGORY_OPENABLE);activity.startActivityForResult(intent,RamuActivity.FILE_PICK);return true;}catch(Exception e){chooser=null;callback.onReceiveValue(null);return false;}}
            @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
        });
        if(activity!=null)activity.attachWeb();web.loadUrl(ORIGIN+"index.html");
    }
    private WebResourceResponse asset(String path){
        if(path.isEmpty())path="index.html";
        try{
            // Only compiled APK code can be served as JavaScript, never downloaded packs.
            SafeFiles.child(new File("/safe"),path);InputStream input;
            try{input=context.getAssets().open("web/"+path);}catch(IOException bundled){
                if(!path.startsWith("assets/")||path.matches("(?i).*\\.(js|css|html|dex|so)$")||resources.active==null)return blocked();
                File local=SafeFiles.child(resources.active,path);if(!local.isFile())return blocked();input=new FileInputStream(local);
            }
            String ext=path.substring(path.lastIndexOf('.')+1).toLowerCase(Locale.ROOT);String mime=switch(ext){case"js"->"application/javascript";case"json"->"application/json";case"css"->"text/css";case"html"->"text/html";case"webp"->"image/webp";case"png"->"image/png";case"svg"->"image/svg+xml";case"mp3"->"audio/mpeg";case"ogg"->"audio/ogg";case"gif"->"image/gif";default->"application/octet-stream";};
            return new WebResourceResponse(mime,mime.startsWith("text/")||mime.contains("json")||mime.contains("javascript")?"UTF-8":null,200,"OK",Map.of("X-Content-Type-Options","nosniff","Cache-Control","no-cache"),input);
        }catch(Exception e){return blocked();}
    }
    private static WebResourceResponse blocked(){return new WebResourceResponse("text/plain","UTF-8",403,"Forbidden",Map.of("X-Content-Type-Options","nosniff"),new ByteArrayInputStream(new byte[0]));}
    void detachWeb(){if(web!=null&&web.getParent() instanceof ViewGroup group)group.removeView(web);}
    void event(String type,JSONObject value){main.post(()->{if(web!=null&&loaded)web.evaluateJavascript("window.__moleAndroidEvent?.("+JSONObject.quote(type)+","+value+")",null);});}
    void reply(String id,Object value,String error){main.post(()->{if(web!=null)web.evaluateJavascript("window.__moleAndroidReceive?.("+JSONObject.quote(id)+","+(value==null?"null":value instanceof String?JSONObject.quote((String)value):value.toString())+","+(error==null?"null":JSONObject.quote(error))+")",null);});}
    boolean visibleToUser(){return (activityVisible||controller.attached&&controller.edgeSide==null)&&!locked();}
    boolean locked(){return context.getSystemService(KeyguardManager.class).isKeyguardLocked()||!context.getSystemService(PowerManager.class).isInteractive();}
    void onResume(){if(web!=null)web.onResume();event("resume",new JSONObject());event("permissions",permissions());if(controller.petMode&&!controller.permission()){controller.petMode=false;controller.detach();controller.emit();}updates.onResume();}
    void startService(){ContextCompat.startForegroundService(context,new Intent(context,PetService.class));}
    void refreshService(){main.post(()->{boolean needed=controller.petMode||backgroundMusic&&musicEnabled&&musicPlaying;if(needed){if(service==null){if(activityVisible||controller.petMode)try{startService();}catch(RuntimeException ignored){}}else service.refresh();}else if(service!=null)service.finishService();});}
    void music(JSONObject state){musicPlaying=state.optBoolean("playing");musicEnabled=state.optBoolean("enabled");backgroundMusic=state.optBoolean("background");
        AudioManager manager=context.getSystemService(AudioManager.class);
        if(musicPlaying&&audioFocus==null){audioFocus=new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN).setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()).setOnAudioFocusChangeListener(change->{if(change==AudioManager.AUDIOFOCUS_LOSS||change==AudioManager.AUDIOFOCUS_LOSS_TRANSIENT)event("music",Json.of("enabled",false));},main).build();int result=manager.requestAudioFocus(audioFocus);if(result!=AudioManager.AUDIOFOCUS_REQUEST_GRANTED)event("music",Json.of("enabled",false));}
        if(!musicPlaying&&audioFocus!=null){manager.abandonAudioFocusRequest(audioFocus);audioFocus=null;}refreshService();
    }
    JSONObject permissions(){boolean notifications=Build.VERSION.SDK_INT<33||ContextCompat.checkSelfPermission(context,android.Manifest.permission.POST_NOTIFICATIONS)==android.content.pm.PackageManager.PERMISSION_GRANTED;
        return Json.of("overlay",controller.permission(),"notifications",notifications,"exactAlarms",Build.VERSION.SDK_INT<31||context.getSystemService(AlarmManager.class).canScheduleExactAlarms(),"installPackages",context.getPackageManager().canRequestPackageInstalls(),"batteryOptimized",!context.getSystemService(PowerManager.class).isIgnoringBatteryOptimizations(context.getPackageName()),"touchThrough",controller.mouseThrough,"autoDownloadWifi",store.prefs.getBoolean("updates-wifi",false),"api",Build.VERSION.SDK_INT,"version",BuildConfig.VERSION_NAME,"channel",BuildConfig.UPDATE_CHANNEL);
    }
    void openPermission(String kind){Intent intent;
        switch(kind){case"overlay":intent=new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+context.getPackageName()));break;
            case"notifications":if(Build.VERSION.SDK_INT>=33&&activity!=null){activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},41);return;}intent=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,context.getPackageName());break;
            case"alarms":intent=Build.VERSION.SDK_INT>=31?new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+context.getPackageName())):new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+context.getPackageName()));break;
            case"install":intent=new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+context.getPackageName()));break;
            case"battery":intent=new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);break;
            default:throw new IllegalArgumentException("未知权限");}
        try{intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);context.startActivity(intent);}catch(android.content.ActivityNotFoundException e){context.startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+context.getPackageName())).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}
    }
    void openUrl(String url){if(!url.startsWith("https://"))return;try{context.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));}catch(ActivityNotFoundException ignored){}}
    void syncActivity(){JSONObject pet=store.pet(),active=pet.optJSONObject("activity");String id=active==null?"":active.optString("id");if(id.equals(alarmActivity))return;if(!alarmActivity.isEmpty())ReminderReceiver.cancel(context,"activity:"+alarmActivity);alarmActivity=id;
        if(active!=null){boolean course=active.optString("kind").equals("course");ReminderReceiver.schedule(context,"activity:"+id,active.optLong("endsAt"),course?"拉姆下课啦":"餐厅打工完成啦",course?"回来看看新学会的本领吧！":"辛苦啦，回小屋领取打工收获吧！");}
    }
    CompletableFuture<Boolean> prepareSave(){String token=UUID.randomUUID().toString();CompletableFuture<Boolean> future=new CompletableFuture<>();saveWaiters.put(token,future);event("prepare",Json.of("token",token));main.postDelayed(()->{CompletableFuture<Boolean> wait=saveWaiters.remove(token);if(wait!=null)wait.complete(false);},8000);return future;}
    void saved(String token,boolean ok){CompletableFuture<Boolean> future=saveWaiters.remove(token);if(future!=null)io.execute(()->future.complete(ok&&store.flush()));}
    void background(){store.flush();if(activity!=null)activity.moveTaskToBack(true);if(!controller.petMode&&!backgroundMusic&&web!=null)web.onPause();}
}
