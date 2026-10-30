package com.molebaby.ramu;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.TextView;

/** Test APK only: models another app that requests landscape or portrait.
 * UiDevice rotation alone cannot override AOSP Launcher's portrait lock. */
public final class RotationFixtureActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        TextView label=new TextView(this);
        label.setText("Display rotation test");
        label.setGravity(Gravity.CENTER);
        setContentView(label);
        orient(getIntent());
    }
    @Override public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        orient(intent);
    }
    private void orient(Intent intent) {
        setRequestedOrientation(intent.getBooleanExtra("landscape",false)
            ?ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE:ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
    }
}
