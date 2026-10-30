package com.molebaby.ramu;
import android.content.*;
public final class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){if(Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()))ReminderReceiver.restore(context);}
}
