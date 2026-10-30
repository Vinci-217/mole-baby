package com.molebaby.ramu;

import android.app.*;
import android.content.*;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.view.*;
import android.webkit.WebChromeClient;
import android.widget.*;
import java.io.*;

public final class RamuActivity extends Activity {
    static final int FILE_PICK=40,EXPORT=42;
    RamuHost host;
    FrameLayout root;
    TextView progress;
    String exportText,exportRequest,pendingPanel;
    @Override public void onCreate(Bundle state){super.onCreate(state);androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(),false);host=((RamuApplication)getApplication()).host();host.activity=this;root=new FrameLayout(this);root.setBackgroundColor(Color.rgb(255,248,232));setContentView(root);
        root.setOnApplyWindowInsetsListener((view,insets)->{if(Build.VERSION.SDK_INT>=30){var bars=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout()|WindowInsets.Type.ime());view.setPadding(bars.left,bars.top,bars.right,bars.bottom);}else view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        progress=new TextView(this);progress.setGravity(Gravity.CENTER);progress.setTextSize(18);progress.setTextColor(Color.rgb(120,87,55));showProgress(host.prepareProgress);pendingPanel=getIntent().getStringExtra("panel");host.ensure();
    }
    void attachWeb(){if(host.web==null)return;if(host.web.getParent()!=root){host.controller.detach();host.detachWeb();if(host.webContext!=null)host.webContext.setBaseContext(this);root.removeAllViews();root.addView(host.web,new FrameLayout.LayoutParams(-1,-1));}host.web.setBackgroundColor(Color.TRANSPARENT);host.web.onResume();
        if(pendingPanel!=null&&host.loaded){host.event("openPanel",Json.of("panel",pendingPanel));pendingPanel=null;}}
    void showProgress(int value){if(host.web!=null)return;if(progress.getParent()==null){root.removeAllViews();root.addView(progress,new FrameLayout.LayoutParams(-1,-1));}progress.setText(value==0?"拉姆正在准备小屋…\n首次解压原版动画需要一点时间":"正在准备原版动画  "+value+"%\n存档保存在本机");}
    void showFailure(String message){root.removeAllViews();TextView error=new TextView(this);error.setGravity(Gravity.CENTER);error.setTextSize(17);error.setPadding(32,40,32,40);error.setText(message+"\n\n点这里重试");error.setOnClickListener(v->{host.ensure();showProgress(0);});root.addView(error,new FrameLayout.LayoutParams(-1,-1));}
    @Override protected void onResume(){super.onResume();host.activity=this;host.activityVisible=true;if(host.controller.petMode){host.controller.petMode=false;host.controller.edgeSide=null;host.controller.edgePose="visible";host.controller.panel=false;host.controller.width=160;host.controller.height=240;}if(host.web!=null)attachWeb();host.controller.emit();host.onResume();host.refreshService();}
    @Override protected void onPause(){host.activityVisible=false;host.controller.emit();host.store.flush();if(!host.controller.petMode&&!host.backgroundMusic&&host.web!=null)host.web.onPause();super.onPause();}
    @Override protected void onStop(){host.store.flush();super.onStop();}
    @Override protected void onDestroy(){if(host.activity==this){host.activity=null;if(host.webContext!=null)host.webContext.setBaseContext(host.context);}if(host.chooser!=null){host.chooser.onReceiveValue(null);host.chooser=null;}if(exportRequest!=null){host.reply(exportRequest,false,"导出已取消");exportRequest=null;}super.onDestroy();}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);pendingPanel=intent.getStringExtra("panel");if(host.web!=null&&host.activityVisible)attachWeb();}
    @Override public void onConfigurationChanged(Configuration config){super.onConfigurationChanged(config);host.controller.onConfigurationChanged();root.requestApplyInsets();}
    @Override public void onBackPressed(){if(host.loaded)host.event("back",new org.json.JSONObject());else moveTaskToBack(true);}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grants){super.onRequestPermissionsResult(requestCode,permissions,grants);host.event("permissions",host.permissions());}
    void fullscreen(boolean enabled){if(Build.VERSION.SDK_INT>=30){WindowInsetsController controller=getWindow().getInsetsController();if(controller!=null){if(enabled){controller.hide(WindowInsets.Type.systemBars());controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);}else controller.show(WindowInsets.Type.systemBars());}}else getWindow().getDecorView().setSystemUiVisibility(enabled?View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:View.SYSTEM_UI_FLAG_VISIBLE);}
    void export(String text,String name,String request){if(text.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>1000000)throw new IllegalArgumentException("存档超过大小限制");if(exportRequest!=null)throw new IllegalStateException("已有导出正在进行");exportText=text;exportRequest=request;
        try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,name.replaceAll("[^A-Za-z0-9._-]","_")),EXPORT);}catch(Exception e){exportText=null;exportRequest=null;throw e;}}
    @Override protected void onActivityResult(int code,int result,Intent data){super.onActivityResult(code,result,data);if(code==FILE_PICK&&host.chooser!=null){var callback=host.chooser;host.chooser=null;callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,data));}if(code==EXPORT&&exportRequest!=null){String request=exportRequest,text=exportText;exportText=null;exportRequest=null;Uri uri=data==null?null:data.getData();if(result!=RESULT_OK||uri==null){host.reply(request,false,"已取消导出");return;}host.io.execute(()->{try(OutputStream out=getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("无法写入所选位置");out.write(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));host.reply(request,true,null);}catch(Exception e){host.reply(request,false,"存档写入失败，请换一个位置重试");}});}}
}
