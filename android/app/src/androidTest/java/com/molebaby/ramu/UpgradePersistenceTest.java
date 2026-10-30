package com.molebaby.ramu;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.*;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Invoked separately after adb installs the next APK signed by the same key. */
@RunWith(AndroidJUnit4.class)
public final class UpgradePersistenceTest {
    @Test public void installingHigherApkPreservesNativeAndWebStorage()throws Exception{
        var context=AndroidSmokeTest.context();var before=context.getSharedPreferences("upgrade-fixture",0);long petId=before.getLong("petId",-1);assertTrue("Run the initial smoke test before the APK upgrade",petId>0);
        int installed=context.getPackageManager().getPackageInfo(context.getPackageName(),0).versionCode;
        assertTrue("This must run after an actual higher-version APK installation",installed>before.getInt("code",Integer.MAX_VALUE));
        AndroidSmokeTest.instrumentation.startActivitySync(new android.content.Intent(context,RamuActivity.class).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
        try{
            AndroidSmokeTest.waitFor(()->AndroidSmokeTest.host().loaded&&AndroidSmokeTest.has(".room-dock"));assertEquals(petId,AndroidSmokeTest.host().store.pet().getLong("createdAt"));assertEquals("安卓小蓝",AndroidSmokeTest.host().store.pet().getString("name"));
            // WebView may serialize the same JS number in scientific notation.
            // Compare its value in JS, not the spelling of its JSON response.
            assertEquals("true",AndroidSmokeTest.js("JSON.parse(localStorage.getItem('ramu-house-save-v1')).createdAt === "+petId));
            assertFalse(AndroidSmokeTest.host().controller.petMode);
            AndroidSmokeTest.waitFor(()->{try{return "true".equals(AndroidSmokeTest.js("Array.from(document.images).filter(im=>im.getBoundingClientRect().width>0&&im.getBoundingClientRect().height>0).every(im=>im.complete&&im.naturalWidth>0)"));}catch(Exception e){return false;}},30000,"Original artwork must remain available after the APK upgrade");
        }finally{AndroidSmokeTest.ui(()->{if(AndroidSmokeTest.host().activity!=null)AndroidSmokeTest.host().activity.finish();});}
    }
}
