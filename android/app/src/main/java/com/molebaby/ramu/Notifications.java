package com.molebaby.ramu;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

final class Notifications {
    static final String PET="pet",REMINDERS="reminders",UPDATES="updates";
    static void channels(Context context){NotificationManager manager=context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel(PET,"拉姆悬浮陪伴",NotificationManager.IMPORTANCE_LOW));
        manager.createNotificationChannel(new NotificationChannel(REMINDERS,"课程、打工与专注提醒",NotificationManager.IMPORTANCE_DEFAULT));
        manager.createNotificationChannel(new NotificationChannel(UPDATES,"拉姆更新",NotificationManager.IMPORTANCE_LOW));
    }
    static PendingIntent home(Context c,String panel,int code){return PendingIntent.getActivity(c,code,new Intent(c,RamuActivity.class).putExtra("panel",panel).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static PendingIntent action(Context c,String action,int code){return PendingIntent.getService(c,code,new Intent(c,PetService.class).setAction(action),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static Notification foreground(RamuHost host){JSONObjectStatus data=new JSONObjectStatus(host.store.status());return new NotificationCompat.Builder(host.context,PET).setSmallIcon(R.drawable.ramu_notification).setContentTitle(data.name+"在陪着你").setContentText(host.controller.mouseThrough?"穿透中 · 点这里回到小屋":data.status).setOngoing(true).setSilent(true).setContentIntent(home(host.context,"",0))
        .addAction(0,"回小屋",home(host.context,"",0)).addAction(0,host.controller.mouseThrough?"恢复触摸":"显示拉姆",action(host.context,"show",1)).addAction(0,host.musicPlaying?"暂停音乐":"播放音乐",action(host.context,"music",2)).addAction(0,"结束陪伴",action(host.context,"stop",3)).build();}
    static void reminder(Context context,int id,String title,String body){if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(context,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return;
        try{context.getSystemService(NotificationManager.class).notify(id,new NotificationCompat.Builder(context,REMINDERS).setSmallIcon(R.drawable.ramu_notification).setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(home(context,"",id)).build());}catch(SecurityException ignored){}
    }
    static final class JSONObjectStatus {final String name,status;JSONObjectStatus(org.json.JSONObject value){name=value.optString("name","拉姆");status=label(value);} }
    static String label(org.json.JSONObject value){if(!value.has("name"))return "点我领养拉姆";if(value.optBoolean("sleeping"))return "睡梦中";String activity=value.optString("activity");if(activity.equals("course"))return "认真上课中";if(activity.equals("restaurant"))return "餐厅打工中";if(activity.equals("outing"))return "出去走走啦";org.json.JSONObject s=value.optJSONObject("stats");if(s!=null){String[] keys={"health","energy","hunger","thirst","cleanliness","happiness"};String[] labels={"需要照料身体","精神不足","肚子饿啦","想喝水","想洗个澡","想和你玩"};for(int i=0;i<keys.length;i++)if(s.optDouble(keys[i],100)<35)return labels[i];}return "元气满满";}
}
