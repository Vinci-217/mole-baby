package com.molebaby.ramu;

import android.content.Context;
import android.content.res.AssetFileDescriptor;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.function.Consumer;
import java.util.zip.*;

/** The resource pack accepts data only. App JavaScript always comes from the signed APK. */
final class ResourcePack {
    private final Context context;
    private final File root;
    volatile File active;
    volatile JSONObject index;
    volatile String rendererHash;
    ResourcePack(Context context) { this.context=context;root=new File(context.getFilesDir(),"resources"); }
    void prepare(Consumer<Integer> progress) throws Exception {
        root.mkdirs();
        JSONObject bundled=new JSONObject(new String(SafeFiles.readLimited(context.getAssets().open("web/resource-index.json"),4*1024*1024),java.nio.charset.StandardCharsets.UTF_8));
        rendererHash=bundled.getString("rendererHash");
        File marker=new File(root,"active.json");
        if(marker.isFile()) try {
            JSONObject selected=new JSONObject(SafeFiles.readText(marker));
            // A new APK owns its assets; an older external pack must never mask them.
            if(selected.getInt("owner")==BuildConfig.VERSION_CODE){
                File dir=SafeFiles.child(root,selected.getString("revision"));
                JSONObject selectedIndex=new JSONObject(SafeFiles.readText(new File(dir,"index.json")));
                if(new File(dir,"complete").isFile()&&rendererHash.equals(selectedIndex.optString("rendererHash"))&&selectedIndex.getString("revision").equals(selected.getString("revision"))){active=dir;index=selectedIndex;prune();progress.accept(100);return;}
            }
        }catch(Exception ignored){/* Fall back to the APK, preserving the game save. */}
        File destination=SafeFiles.child(root,bundled.getString("revision"));
        if(!new File(destination,"complete").isFile())try(InputStream in=context.getAssets().open("web/resources.zip")){extract(in,bundled,destination,progress);}
        activate(destination,bundled);prune();progress.accept(100);
    }
    static void extract(InputStream input,JSONObject index,File destination,Consumer<Integer> progress)throws Exception{
        if(index.getInt("schema")!=1 || !index.getString("revision").matches("[a-f0-9]{24}"))throw new IOException("素材版本不支持");
        JSONArray entries=index.getJSONArray("files");if(entries.length()<1 || entries.length()>30000)throw new IOException("素材索引大小无效");
        Map<String,JSONObject> expected=new HashMap<>();long total=0;
        for(int i=0;i<entries.length();i++){
            JSONObject item=entries.getJSONObject(i);String name=item.getString("path");long size=item.getLong("size");
            SafeFiles.child(destination,name);
            if(!name.startsWith("assets/")||!name.matches("(?i).+\\.(webp|png|jpg|jpeg|gif|mp3|ogg|wav|json|svg|woff2?|ttf|xml|md)")||size<0||size>200*1024*1024||!SafeFiles.digest(item.getString("sha256"))||expected.put(name,item)!=null)throw new IOException("素材索引不合法");
            total+=size;if(total>2L*1024*1024*1024)throw new IOException("素材超过存储限制");
        }
        File staging=new File(destination.getPath()+".staging");SafeFiles.delete(staging);staging.mkdirs();
        long free=staging.getUsableSpace();if(free>0&&free<total+16*1024*1024){SafeFiles.delete(staging);throw new IOException("存储空间不足，请至少腾出 "+((total+16*1024*1024)/1024/1024)+" MB 后重试。存档仍然保留。");}
        try(ZipInputStream zip=new ZipInputStream(input)){
            Set<String> seen=new HashSet<>();ZipEntry entry;byte[] buffer=new byte[65536];long done=0;int last=-1;
            while((entry=zip.getNextEntry())!=null){
                String name=entry.getName();JSONObject item=expected.get(name);
                if(entry.isDirectory()||item==null||!seen.add(name))throw new IOException("素材包包含未声明内容");
                File out=SafeFiles.child(staging,name);out.getParentFile().mkdirs();long size=item.getLong("size"),written=0;
                try(FileOutputStream stream=new FileOutputStream(out)){
                    int n;while((n=zip.read(buffer))!=-1){written+=n;if(written>size)throw new IOException("素材解压大小超限");stream.write(buffer,0,n);}
                }
                if(written!=size||!SafeFiles.sha256(out).equals(item.getString("sha256")))throw new IOException("素材校验失败: "+name);
                done+=size;int percentage=(int)(done*100/Math.max(1,total));if(percentage!=last){progress.accept(percentage);last=percentage;}
            }
            if(seen.size()!=expected.size())throw new IOException("素材包不完整");
            SafeFiles.atomicJson(new File(staging,"index.json"),index);
            try(FileOutputStream ready=new FileOutputStream(new File(staging,"complete"))){ready.write(1);ready.getFD().sync();}
            if(destination.exists())SafeFiles.delete(destination);
            Files.move(staging.toPath(),destination.toPath(),StandardCopyOption.ATOMIC_MOVE);
        }finally{SafeFiles.delete(staging);}
    }
    void apply(File zip,JSONObject next,Consumer<Integer> progress)throws Exception{
        if(!rendererHash.equals(next.optString("rendererHash")))throw new IOException("素材需要不同的程序版本，请先安装对应的 APK。");
        File destination=SafeFiles.child(root,next.getString("revision"));
        try(InputStream in=new FileInputStream(zip)){extract(in,next,destination,progress);}
        activate(destination,next);
        // Keep the previous directory until the WebView has reloaded and released its files.
    }
    private void activate(File directory,JSONObject next)throws Exception{
        SafeFiles.atomicJson(new File(root,"active.json"),new JSONObject().put("owner",BuildConfig.VERSION_CODE).put("revision",next.getString("revision")));active=directory;index=next;
    }
    void prune() {File[] dirs=root.listFiles();if(dirs!=null)for(File dir:dirs)if(dir.isDirectory()&&!dir.equals(active))try{SafeFiles.delete(dir);}catch(IOException ignored){}}
    UpdateTransport.Base base()throws IOException{
        File external=new File(root,"base.zip");
        if(external.isFile() && new File(root,"base-revision").isFile() && SafeFiles.readText(new File(root,"base-revision")).equals(index.optString("revision")))return new UpdateTransport.Base(external,0,external.length());
        try(AssetFileDescriptor fd=context.getAssets().openFd("web/resources.zip")){return new UpdateTransport.Base(new File(context.getApplicationInfo().sourceDir),fd.getStartOffset(),fd.getLength());}
    }
    byte[] baseMap()throws IOException{
        File external=new File(root,"base.zip.blockmap");
        if(external.isFile()&&new File(root,"base-revision").isFile()&&SafeFiles.readText(new File(root,"base-revision")).equals(index.optString("revision")))return SafeFiles.readLimited(new FileInputStream(external),4*1024*1024);
        return SafeFiles.readLimited(context.getAssets().open("web/resources.zip.blockmap"),4*1024*1024);
    }
    void keepBase(File zip,byte[] map,String revision)throws IOException{
        Files.move(zip.toPath(),new File(root,"base.zip").toPath(),StandardCopyOption.REPLACE_EXISTING);Files.write(new File(root,"base.zip.blockmap").toPath(),map);SafeFiles.writeText(new File(root,"base-revision"),revision);
    }
}
