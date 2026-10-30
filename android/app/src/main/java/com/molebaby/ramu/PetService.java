package com.molebaby.ramu;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.ServiceCompat;

/** Started only by an explicit foreground user action; a notification always recovers touch. */
public final class PetService extends Service {
    RamuHost host;
    @Override public void onCreate(){super.onCreate();host=((RamuApplication)getApplication()).host();host.service=this;refresh();}
    void refresh(){int type=0;if(Build.VERSION.SDK_INT>=34){type=ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;if(host.musicPlaying&&host.backgroundMusic)type|=ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK;}
        ServiceCompat.startForeground(this,7,Notifications.foreground(host),type);
    }
    @Override public int onStartCommand(Intent intent,int flags,int startId){String action=intent==null?null:intent.getAction();if("stop".equals(action)){host.controller.petMode=false;host.controller.detach();host.controller.emit();host.event("music",Json.of("enabled",false));host.musicPlaying=false;host.store.flush();finishService();return START_NOT_STICKY;}
        if("music".equals(action))host.event("music",Json.of("enabled",!host.musicPlaying));
        if("show".equals(action)){host.controller.through(false);host.controller.reveal();}
        if(host.controller.petMode&&host.loaded)host.controller.attach();refresh();return START_NOT_STICKY;
    }
    void finishService(){stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onDestroy(){if(host!=null){host.service=null;host.controller.detach();host.store.flush();}super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
