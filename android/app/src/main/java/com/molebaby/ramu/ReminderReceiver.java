package com.molebaby.ramu;

import android.app.*;
import android.content.*;
import android.os.Build;
import org.json.*;
import java.util.*;

public final class ReminderReceiver extends BroadcastReceiver {
    static PendingIntent intent(Context context,String id){return PendingIntent.getBroadcast(context,100+id.hashCode(),new Intent(context,ReminderReceiver.class).setAction("com.molebaby.ramu.REMIND").putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
    static void schedule(Context context,String id,long at,String title,String body){
        if(!id.matches("[a-zA-Z0-9:._-]{1,160}")||at<System.currentTimeMillis()-1000||at>System.currentTimeMillis()+8*24*60*60*1000L)return;
        var p=context.getSharedPreferences("reminders",Context.MODE_PRIVATE);p.edit().putString(id,Json.of("at",at,"title",title,"body",body).toString()).apply();
        AlarmManager manager=context.getSystemService(AlarmManager.class);PendingIntent alarm=intent(context,id);
        try{if(Build.VERSION.SDK_INT<31||manager.canScheduleExactAlarms())manager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm);else manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm);}catch(SecurityException ignored){manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,at,alarm);}
    }
    static void cancel(Context context,String id){context.getSystemService(AlarmManager.class).cancel(intent(context,id));context.getSharedPreferences("reminders",Context.MODE_PRIVATE).edit().remove(id).apply();}
    static void restore(Context context){var p=context.getSharedPreferences("reminders",Context.MODE_PRIVATE);for(var entry:p.getAll().entrySet()){JSONObject value=Json.parse(String.valueOf(entry.getValue()));long at=value.optLong("at");if(at>System.currentTimeMillis())schedule(context,entry.getKey(),at,value.optString("title"),value.optString("body"));else if(at>System.currentTimeMillis()-24*60*60*1000L)fire(context,entry.getKey(),value);else cancel(context,entry.getKey());}}
    private static void fire(Context context,String id,JSONObject value){cancel(context,id);RamuHost host=((RamuApplication)context.getApplicationContext()).host();if(!host.visibleToUser()){context.getSharedPreferences("fired",Context.MODE_PRIVATE).edit().putLong(id,System.currentTimeMillis()).apply();Notifications.reminder(context,1000+id.hashCode(),value.optString("title","拉姆"),value.optString("body","回来看看拉姆吧"));}host.event("resume",Json.of("reminder",id));}
    @Override public void onReceive(Context context,Intent intent){String id=intent.getStringExtra("id");if(id==null)return;JSONObject value=Json.parse(context.getSharedPreferences("reminders",Context.MODE_PRIVATE).getString(id,"{}"));if(value.has("at"))fire(context,id,value);}
}
