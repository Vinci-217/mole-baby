package com.molebaby.ramu;
import android.app.Application;
public final class RamuApplication extends Application {
    private RamuHost host;
    synchronized RamuHost host(){if(host==null)host=new RamuHost(this);return host;}
    @Override public void onCreate(){super.onCreate();Notifications.channels(this);}
}
