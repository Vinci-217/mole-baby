package com.molebaby.ramu;

import android.content.*;
import org.json.*;
import java.util.*;

/** Synchronous bootstrap + private native mirror, shared by house and overlay. */
final class PetStore {
    static final String SAVE="ramu-house-save-v1";
    final android.content.SharedPreferences prefs;
    private final Context context;
    PetStore(Context context){this.context=context;prefs=context.getSharedPreferences("mole-pet",Context.MODE_PRIVATE);}
    static boolean allowed(String key){return key!=null&&key.startsWith("ramu-")&&key.length()<160;}
    synchronized JSONObject snapshot(){JSONObject result=new JSONObject();for(Map.Entry<String,?> entry:prefs.getAll().entrySet())if(allowed(entry.getKey())&&entry.getValue() instanceof String)try{result.put(entry.getKey(),entry.getValue());}catch(JSONException ignored){}return result;}
    synchronized boolean put(String key,String value){
        if(!allowed(key)||value!=null&&value.length()>1024*1024)return false;
        SharedPreferences.Editor edit=prefs.edit();if(value==null)edit.remove(key);else edit.putString(key,value);edit.apply();return true;
    }
    boolean flush(){return prefs.edit().putLong("flushedAt",System.currentTimeMillis()).commit();}
    JSONObject pet(){return Json.parse(prefs.getString(SAVE,"{}"));}
    JSONObject status(){return Json.parse(prefs.getString("native-status","{}"));}
    void status(JSONObject value){prefs.edit().putString("native-status",value.toString()).apply();PetWidget.refresh(context);}
}
