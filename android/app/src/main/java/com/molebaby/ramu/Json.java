package com.molebaby.ramu;
import org.json.*;
final class Json {
    static JSONObject of(Object... pairs) {JSONObject result=new JSONObject();try{for(int i=0;i<pairs.length;i+=2)result.put((String)pairs[i],pairs[i+1]==null?JSONObject.NULL:pairs[i+1]);return result;}catch(JSONException e){throw new IllegalArgumentException(e);}}
    static JSONObject parse(String raw){try{return new JSONObject(raw);}catch(Exception e){return new JSONObject();}}
}
