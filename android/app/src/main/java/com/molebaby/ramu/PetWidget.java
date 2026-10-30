package com.molebaby.ramu;
import android.appwidget.*;
import android.content.*;
import android.widget.RemoteViews;
public final class PetWidget extends AppWidgetProvider {
    static void refresh(Context context){AppWidgetManager manager=AppWidgetManager.getInstance(context);int[] ids=manager.getAppWidgetIds(new ComponentName(context,PetWidget.class));render(context,manager,ids);}
    private static void render(Context context,AppWidgetManager manager,int[] ids){org.json.JSONObject status=new PetStore(context).status();for(int id:ids){RemoteViews v=new RemoteViews(context.getPackageName(),R.layout.pet_widget);v.setTextViewText(R.id.widget_name,status.optString("name","拉姆"));v.setTextViewText(R.id.widget_status,Notifications.label(status));v.setOnClickPendingIntent(R.id.widget_root,Notifications.home(context,"",10));v.setOnClickPendingIntent(R.id.widget_feed,Notifications.home(context,"food",11));manager.updateAppWidget(id,v);}}
    @Override public void onUpdate(Context c,AppWidgetManager manager,int[] ids){render(c,manager,ids);}
}
