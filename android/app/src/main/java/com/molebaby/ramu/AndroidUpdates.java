package com.molebaby.ramu;

import android.content.*;
import android.content.pm.*;
import android.os.Build;
import androidx.core.content.FileProvider;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Android preview has an independent channel. It never consumes desktop latest.yml. */
final class AndroidUpdates {
    final RamuHost host;
    final ExecutorService worker=Executors.newSingleThreadExecutor();
    final AtomicBoolean canceled=new AtomicBoolean();
    final File directory;
    volatile boolean busy,working;
    UpdateService service;
    private JSONObject value,manifest,artifact;
    private String kind="apk";
    private File verified;
    AndroidUpdates(RamuHost host){this.host=host;directory=new File(host.context.getFilesDir(),"updates");value=Json.of("status","idle","currentVersion",BuildConfig.VERSION_NAME,"version",null,"percent",0,"enabled",enabled(),"automaticInstall",false,"checkedAt",null,"message","自动选择差量或完整包；APK 安装需要系统确认。","downloadPolicy",policy());worker.execute(()->{File[] old=new File(directory,"verified").listFiles();if(old!=null)for(File file:old)if(file.getName().matches("ramu-[0-9]{1,9}\\.apk"))try{int code=Integer.parseInt(file.getName().substring(5,file.getName().length()-4));if(code<=BuildConfig.VERSION_CODE)file.delete();}catch(NumberFormatException ignored){}});}
    boolean enabled(){return host.store.prefs.getBoolean("updates-enabled",true);}
    String policy(){return host.store.prefs.getString("updates-policy","auto");}
    synchronized JSONObject state(){return Json.parse(value.toString());}
    synchronized void patch(Object... pairs){try{for(int i=0;i<pairs.length;i+=2)value.put((String)pairs[i],pairs[i+1]==null?JSONObject.NULL:pairs[i+1]);}catch(JSONException e){throw new IllegalArgumentException(e);}host.event("updates",state());host.main.post(()->{if(service!=null)service.refresh();});}
    void enabled(boolean enabled){host.store.prefs.edit().putBoolean("updates-enabled",enabled).apply();patch("enabled",enabled);}
    void policy(String policy){if(!policy.equals("auto")&&!policy.equals("full"))throw new IllegalArgumentException("无效的下载方式");if(working)throw new IllegalStateException("下载完成后再切换方式");host.store.prefs.edit().putString("updates-policy",policy).apply();patch("downloadPolicy",policy);}
    private void fail(Exception error){patch("status","error","message",error.getMessage()==null?"更新失败，当前版本与存档不受影响":error.getMessage());}
    synchronized void check(){if(working)return;working=true;patch("status","checking","message","正在检查安卓预览更新…");
        worker.execute(()->{try{
            JSONObject next=new JSONObject(new String(UpdateTransport.small(BuildConfig.UPDATE_FEED,256*1024),java.nio.charset.StandardCharsets.UTF_8));
            validateManifest(next,BuildConfig.APPLICATION_ID,Build.VERSION.SDK_INT);
            int code=next.getInt("versionCode");JSONObject resources=next.optJSONObject("resources");
            if(code>BuildConfig.VERSION_CODE){kind="apk";artifact=validateArtifact(next.getJSONObject("apk"));}
            else if(resources!=null&&code==BuildConfig.VERSION_CODE&&resources.getInt("minAppCode")<=BuildConfig.VERSION_CODE&&resources.getInt("maxAppCode")>=BuildConfig.VERSION_CODE&&host.resources.index!=null&&!resources.getString("revision").equals(host.resources.index.optString("revision"))){kind="resources";artifact=validateArtifact(resources);}
            else {patch("status","current","version",null,"checkedAt",System.currentTimeMillis(),"message","当前已是此安卓渠道的最新版本。");return;}
            manifest=next;verified=null;patch("status","available","version",next.getString("versionName"),"checkedAt",System.currentTimeMillis(),"percent",0,"downloadMode",null,"transferredBytes",0,"reusedBytes",0,"fullSize",artifact.getLong("size"),"message",kind.equals("apk")?"有新版本，可以确认下载；将自动选择差量或完整下载。":"原版素材有更新，可以下载并在保存存档后切换。");
        }catch(Exception e){fail(e);}finally{working=false;if(state().optString("status").equals("available"))host.main.post(()->{if(enabled()&&wifiAuto()&&(host.activityVisible||host.service!=null))download(true);else announce(false);});}});
    }
    static void validateManifest(JSONObject next,String packageName,int api)throws Exception{
        if(next.getInt("schema")!=1||!BuildConfig.UPDATE_CHANNEL.equals(next.getString("channel"))||!packageName.equals(next.getString("packageName"))||next.getInt("versionCode")<1||next.getInt("minSdk")>api||next.getString("versionName").length()>64)throw new IOException("更新渠道、包名或系统版本不兼容");
    }
    static JSONObject validateArtifact(JSONObject entry)throws Exception{
        if(entry.getLong("size")<1||entry.getLong("size")>SafeFiles.MAX_PACKAGE||!SafeFiles.digest(entry.getString("sha256"))||!UpdateTransport.releaseUrl(entry.getString("url")))throw new IOException("更新包声明无效");
        JSONObject map=entry.optJSONObject("blockmap");if(map!=null&&(!UpdateTransport.releaseUrl(map.getString("url"))||!SafeFiles.digest(map.getString("sha256"))))throw new IOException("分块索引声明无效");
        if(entry.has("revision")&&(!entry.getString("revision").matches("[a-f0-9]{24}")||entry.optInt("minAppCode",-1)<1||entry.optInt("maxAppCode",-1)<entry.optInt("minAppCode")))throw new IOException("素材兼容范围无效");
        return entry;
    }
    private byte[] blockmap(JSONObject descriptor,UpdateTransport.Connector connector)throws Exception{
        byte[] bytes=UpdateTransport.small(connector,descriptor.getString("url"),4*1024*1024);MessageDigest sha=MessageDigest.getInstance("SHA-256");if(!SafeFiles.hex(sha.digest(bytes)).equals(descriptor.getString("sha256")))throw new IOException("分块索引校验失败");return bytes;
    }
    void download(){download(false);}
    synchronized void download(boolean wifiOnly){if(working||artifact==null)return;
        if(wifiOnly&&!wifiAuto())return;
        android.net.Network network=wifiOnly?eligibleWifi():null;
        if(wifiOnly&&network==null)return;
        UpdateTransport.Connector connector=network==null?UpdateTransport::connect:(url,range)->UpdateTransport.connect(url,range,address->(java.net.HttpURLConnection)network.openConnection(address));
        working=true;canceled.set(false);JSONObject selected=Json.parse(artifact.toString());JSONObject release=Json.parse(manifest.toString());String selectedKind=kind;
        patch("status","downloading","percent",0,"message","正在准备差量下载…","fallbackReason",null);
        try{androidx.core.content.ContextCompat.startForegroundService(host.context,new Intent(host.context,UpdateService.class));}catch(RuntimeException e){working=false;fail(new IOException("请先回到小屋，再开始下载。"));return;}
        worker.execute(()->{try{
            long size=selected.getLong("size");String sha=selected.getString("sha256");File output=new File(directory,"verified/"+(selectedKind.equals("apk")?"ramu-"+release.getInt("versionCode")+".apk":"resources-"+selected.getString("revision")+".zip"));
            output.getParentFile().mkdirs();long free=output.getParentFile().getUsableSpace();if(free>0&&free<size+16*1024*1024)throw new IOException("存储空间不足，请先腾出 "+((size+16*1024*1024)/1024/1024)+" MB 后重试。");
            byte[] nextBytes=null;DeltaPlan.MapFile next=null,old=null;UpdateTransport.Base base=null;
            if(!policy().equals("full"))try{
                JSONObject desc=selected.optJSONObject("blockmap");if(desc!=null){nextBytes=blockmap(desc,connector);next=DeltaPlan.parse(nextBytes,size);
                    if(selectedKind.equals("resources")){base=host.resources.base();old=DeltaPlan.parse(host.resources.baseMap(),base.length());}
                    else{base=new UpdateTransport.Base(new File(host.context.getApplicationInfo().sourceDir),0,new File(host.context.getApplicationInfo().sourceDir).length());
                        File cached=new File(directory,"base-"+BuildConfig.VERSION_CODE+".blockmap");
                        if(cached.isFile())old=DeltaPlan.parse(SafeFiles.readLimited(new FileInputStream(cached),4*1024*1024),base.length());
                        else{JSONArray bases=release.optJSONArray("bases");if(bases!=null)for(int i=0;i<bases.length();i++){JSONObject candidate=bases.getJSONObject(i);if(candidate.optInt("versionCode")==BuildConfig.VERSION_CODE&&candidate.optLong("size")==base.length()){old=DeltaPlan.parse(blockmap(candidate.getJSONObject("blockmap"),connector),base.length());break;}}}
                    }
                }
            }catch(Exception ignored){/* Missing/bad indexes select a complete download, never block updating. */}
            DeltaPlan.Plan plan=next==null?DeltaPlan.full(size):DeltaPlan.build(old,next,policy().equals("full"));
            boolean cached=output.isFile()&&output.length()==size&&sha.equals(SafeFiles.sha256(output));
            if(!cached)UpdateTransport.download(UpdateTransport.source(connector,selected.getString("url"),size),base,plan,size,sha,output,canceled,p->patch("downloadMode",p.mode(),"transferredBytes",p.bytes(),"totalBytes",p.total(),"reusedBytes",p.reused(),"percent",p.total()==0?100:Math.min(100,p.bytes()*100d/p.total()),"fallbackReason",p.fallback(),"message",p.mode().equals("differential")?"正在下载发生变化的部分…":"正在下载完整包…"));
            if(canceled.get())throw new IOException("下载已取消");
            if(selectedKind.equals("apk"))verifyApk(output,selected,release.getInt("versionCode"));
            else validateResourceIndex(selected,connector);
            verified=output;
            if(nextBytes!=null)Files.write(new File(directory,"base-"+(selectedKind.equals("apk")?release.getInt("versionCode"):"resources")+".blockmap").toPath(),nextBytes);
            SafeFiles.atomicJson(new File(directory,"ready.json"),Json.of("manifest",release,"kind",selectedKind,"file",output.getName(),"owner",BuildConfig.VERSION_CODE));
            patch("status","ready","percent",100,"downloadMode",cached?"cached":state().optString("downloadMode","full"),"message",selectedKind.equals("apk")?"下载与签名校验完成，确认后交给 Android 安装。":"素材校验完成，确认后保存存档并切换。","automaticInstall",selectedKind.equals("resources"));
            host.main.post(()->announce(true));
            cleanup(output);
        }catch(Exception e){if(verified!=null)verified=null;if(canceled.get())patch("status","available","message","下载已取消，可以稍后重试。");else fail(e);}finally{working=false;host.main.post(()->{if(service!=null){service.stopForeground(android.app.Service.STOP_FOREGROUND_REMOVE);service.stopSelf();}});}});
    }
    private JSONObject validateResourceIndex(JSONObject resource)throws Exception{
        return validateResourceIndex(resource,UpdateTransport::connect);
    }
    private JSONObject validateResourceIndex(JSONObject resource,UpdateTransport.Connector connector)throws Exception{
        JSONObject desc=resource.getJSONObject("index");if(!UpdateTransport.releaseUrl(desc.getString("url"))||!SafeFiles.digest(desc.getString("sha256")))throw new IOException("素材索引地址无效");byte[] data=UpdateTransport.small(connector,desc.getString("url"),4*1024*1024);
        if(!SafeFiles.hex(MessageDigest.getInstance("SHA-256").digest(data)).equals(desc.getString("sha256")))throw new IOException("素材索引校验失败");
        JSONObject index=new JSONObject(new String(data,java.nio.charset.StandardCharsets.UTF_8));if(!resource.getString("revision").equals(index.getString("revision"))||!resource.getString("sha256").equals(index.getJSONObject("pack").getString("sha256"))||resource.getLong("size")!=index.getJSONObject("pack").getLong("size"))throw new IOException("素材索引与包不匹配");if(!Objects.equals(host.resources.rendererHash,index.optString("rendererHash")))throw new IOException("素材需要不同的程序版本，请先更新 APK。");return index;
    }
    static Set<String> signers(PackageInfo info)throws Exception{android.content.pm.Signature[] signatures;if(Build.VERSION.SDK_INT>=28){if(info.signingInfo==null)throw new IOException("APK 缺少签名");signatures=info.signingInfo.getApkContentsSigners();}else signatures=info.signatures;if(signatures==null||signatures.length==0)throw new IOException("APK 缺少签名");Set<String> result=new HashSet<>();for(android.content.pm.Signature signature:signatures)result.add(SafeFiles.hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));return result;}
    private void verifyApk(File file,JSONObject selected,int expectedCode)throws Exception{
        PackageManager pm=host.context.getPackageManager();int flags=Build.VERSION.SDK_INT>=28?PackageManager.GET_SIGNING_CERTIFICATES:PackageManager.GET_SIGNATURES;
        PackageInfo target=pm.getPackageArchiveInfo(file.getPath(),flags),current=pm.getPackageInfo(host.context.getPackageName(),flags);
        if(target==null||!host.context.getPackageName().equals(target.packageName)||(Build.VERSION.SDK_INT>=28?target.getLongVersionCode():target.versionCode)!=expectedCode||expectedCode<=BuildConfig.VERSION_CODE||!signers(current).equals(signers(target))||!signers(target).contains(selected.getString("signerSha256")))throw new IOException("APK 包名、版本或签名不匹配；已阻止安装");
    }
    synchronized void install(){if(working||verified==null||manifest==null||artifact==null)return;if(busy)throw new IllegalStateException("请先结束当前小游戏或互动，再更新。");
        if(kind.equals("apk")&&!host.context.getPackageManager().canRequestPackageInstalls()){host.openPermission("install");patch("message","允许安装此来源后，回来再次点击确认安装。");return;}
        working=true;patch("status","installing","message","正在保存拉姆的存档…");File selected=verified;JSONObject entry=Json.parse(artifact.toString());int expected=manifest.optInt("versionCode");String selectedKind=kind;
        host.prepareSave().thenAccept(ok->worker.execute(()->{try{
            if(!ok)throw new IOException("存档尚未保存，更新已暂停，请重试。");
            if(!selected.isFile()||!entry.getString("sha256").equals(SafeFiles.sha256(selected)))throw new IOException("安装前复核失败，请重新下载。");
            if(selectedKind.equals("apk")){verifyApk(selected,entry,expected);host.main.post(()->{try{Intent intent=new Intent(Intent.ACTION_VIEW).setDataAndType(FileProvider.getUriForFile(host.context,BuildConfig.APPLICATION_ID+".files",selected),"application/vnd.android.package-archive").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_GRANT_READ_URI_PERMISSION);host.context.startActivity(intent);patch("status","ready","message","请在系统安装界面确认；取消安装可继续使用当前版本。");}catch(Exception e){fail(e);}});}
            else{JSONObject index=validateResourceIndex(entry);host.resources.apply(selected,index,p->patch("percent",p,"message","正在校验并切换素材…"));File map=new File(directory,"base-resources.blockmap");if(map.isFile())host.resources.keepBase(selected,SafeFiles.readLimited(new FileInputStream(map),4*1024*1024),index.getString("revision"));host.main.post(()->{host.loaded=false;if(host.web!=null)host.web.reload();});patch("status","current","message","素材已更新，拉姆与存档已经保留。");}
        }catch(Exception e){fail(e);}finally{working=false;}}));
    }
    void cancel(){canceled.set(true);}
    private android.net.Network eligibleWifi(){android.net.ConnectivityManager manager=host.context.getSystemService(android.net.ConnectivityManager.class);android.net.Network current=manager.getActiveNetwork();android.net.NetworkCapabilities network=manager.getNetworkCapabilities(current);return network!=null&&network.hasTransport(android.net.NetworkCapabilities.TRANSPORT_WIFI)&&network.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_NOT_METERED)?current:null;}
    private boolean wifiAuto(){return host.store.prefs.getBoolean("updates-wifi",false)&&eligibleWifi()!=null;}
    private void announce(boolean ready){
        if(host.activityVisible&&host.activity!=null&&!host.activity.isFinishing()&&!busy){new android.app.AlertDialog.Builder(host.activity).setTitle(ready?"拉姆更新准备好了":"发现拉姆新版本").setMessage(ready?"更新包已经校验。现在保存存档并开始更新吗？APK 安装仍需系统确认。":"可以自动选择差量或完整下载；你的拉姆和存档会保留。").setNegativeButton("稍后",null).setPositiveButton(ready?"确认更新":"下载更新",(d,w)->{try{if(ready)install();else download();}catch(Exception e){fail(e);}}).show();}
        else if(host.permissions().optBoolean("notifications")){host.context.getSystemService(android.app.NotificationManager.class).notify(98,new androidx.core.app.NotificationCompat.Builder(host.context,Notifications.UPDATES).setSmallIcon(R.drawable.ramu_notification).setContentTitle(ready?"拉姆更新已下载":"发现拉姆新版本").setContentText("点这里回到小屋设置，查看更新。").setAutoCancel(true).setContentIntent(Notifications.home(host.context,"settings",98)).build());}
    }
    void onResume(){if(!working&&verified==null){File ready=new File(directory,"ready.json");if(ready.isFile())worker.execute(()->{try{JSONObject cached=new JSONObject(SafeFiles.readText(ready));if(cached.getInt("owner")!=BuildConfig.VERSION_CODE)return;JSONObject next=cached.getJSONObject("manifest");validateManifest(next,BuildConfig.APPLICATION_ID,Build.VERSION.SDK_INT);String type=cached.getString("kind");JSONObject item=validateArtifact(next.getJSONObject(type.equals("apk")?"apk":"resources"));File file=SafeFiles.child(new File(directory,"verified"),cached.getString("file"));if(file.isFile()&&file.length()==item.getLong("size")&&item.getString("sha256").equals(SafeFiles.sha256(file))){manifest=next;kind=type;artifact=item;verified=file;patch("status","ready","version",next.getString("versionName"),"percent",100,"downloadMode","cached","message","已恢复上次校验完成的更新包。","automaticInstall",!type.equals("apk"));}}catch(Exception ignored){}});}}
    private void cleanup(File keep){File[] files=new File(directory,"verified").listFiles();if(files!=null)for(File file:files)if(!file.equals(keep))file.delete();}
}
