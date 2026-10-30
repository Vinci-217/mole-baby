package com.molebaby.ramu;
import org.junit.Test;
import org.json.*;
import static org.junit.Assert.*;
public final class UpdateManifestTest {
    static final String URL="https://github.com/Vinci-217/mole-baby/releases/download/android-preview/ramu.apk";
    @Test public void channelPackageAndMinimumSystemAreEnforced()throws Exception{JSONObject manifest=Json.of("schema",1,"channel",BuildConfig.UPDATE_CHANNEL,"packageName","com.example.test","versionCode",2,"versionName","0.2","minSdk",26);AndroidUpdates.validateManifest(manifest,"com.example.test",26);
        assertThrows(Exception.class,()->AndroidUpdates.validateManifest(manifest,"com.other.app",35));assertThrows(Exception.class,()->AndroidUpdates.validateManifest(manifest,"com.example.test",25));manifest.put("channel","latest");assertThrows(Exception.class,()->AndroidUpdates.validateManifest(manifest,"com.example.test",35));}
    @Test public void downloadsRequireSizeDigestAndRepositoryUrls()throws Exception{JSONObject item=Json.of("url",URL,"size",100,"sha256","a".repeat(64),"blockmap",Json.of("url",URL+".blockmap","sha256","b".repeat(64)));AndroidUpdates.validateArtifact(item);item.put("size",SafeFiles.MAX_PACKAGE+1);assertThrows(Exception.class,()->AndroidUpdates.validateArtifact(item));item.put("size",100).put("sha256","bad");assertThrows(Exception.class,()->AndroidUpdates.validateArtifact(item));}
    @Test public void resourceRevisionsCannotBecomeFilesystemPaths()throws Exception{JSONObject item=Json.of("url",URL,"size",100,"sha256","a".repeat(64),"revision","../../save","minAppCode",1,"maxAppCode",2);assertThrows(Exception.class,()->AndroidUpdates.validateArtifact(item));item.put("revision","a".repeat(24));AndroidUpdates.validateArtifact(item);item.put("maxAppCode",0);assertThrows(Exception.class,()->AndroidUpdates.validateArtifact(item));}
}
