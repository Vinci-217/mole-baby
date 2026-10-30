package com.molebaby.ramu;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import androidx.core.app.*;
import org.json.JSONObject;

/** A user-authorized download keeps running when the house is backgrounded. */
public final class UpdateService extends Service {
    RamuHost host;
    @Override public void onCreate(){super.onCreate();host=((RamuApplication)getApplication()).host();host.updates.service=this;refresh();}
    void refresh(){JSONObject state=host.updates.state();PendingIntent cancel=PendingIntent.getService(this,991,new Intent(this,UpdateService.class).setAction("cancel"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
        Notification notification=new NotificationCompat.Builder(this,Notifications.UPDATES).setSmallIcon(R.drawable.ramu_notification).setContentTitle("正在更新拉姆").setContentText(state.optString("message","准备下载…")).setOngoing(true).setSilent(true).setProgress(100,state.optInt("percent"),false).setContentIntent(Notifications.home(this,"settings",98)).addAction(0,"取消下载",cancel).build();
        ServiceCompat.startForeground(this,99,notification,Build.VERSION.SDK_INT>=29?ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC:0);
    }
    @Override public int onStartCommand(Intent intent,int flags,int id){if(intent!=null&&"cancel".equals(intent.getAction())){host.updates.cancel();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}else if(!host.updates.working){stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}else refresh();return START_NOT_STICKY;}
    @Override public void onTimeout(int startId,int fgsType){host.updates.cancel();stopForeground(STOP_FOREGROUND_REMOVE);stopSelf();}
    @Override public void onDestroy(){if(host!=null)host.updates.service=null;super.onDestroy();}
    @Override public IBinder onBind(Intent intent){return null;}
}
