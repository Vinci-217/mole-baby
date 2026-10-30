package com.molebaby.ramu;

import org.junit.*;
import org.junit.rules.TemporaryFolder;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.GZIPOutputStream;
import static org.junit.Assert.*;

public final class DeltaDownloadTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    static final int CHUNK=128*1024;
    static byte[] payload(int seed){byte[] bytes=new byte[16*CHUNK];new Random(seed).nextBytes(bytes);return bytes;}
    static String sha(byte[] bytes)throws Exception{return SafeFiles.hex(MessageDigest.getInstance("SHA-256").digest(bytes));}
    static byte[] map(byte[] data)throws Exception{
        JSONArray sizes=new JSONArray(),checks=new JSONArray();for(int i=0;i<data.length;i+=CHUNK){int size=Math.min(CHUNK,data.length-i);sizes.put(size);checks.put(Base64.getEncoder().encodeToString(MessageDigest.getInstance("SHA-256").digest(Arrays.copyOfRange(data,i,i+size))));}
        JSONObject index=Json.of("version","2","files",new JSONArray().put(Json.of("name","file","offset",0,"sizes",sizes,"checksums",checks)));
        return gzip(index.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
    static byte[] gzip(byte[] value)throws IOException{ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(GZIPOutputStream gzip=new GZIPOutputStream(bytes)){gzip.write(value);}return bytes.toByteArray();}
    static final class Server implements UpdateTransport.Source {
        final byte[] bytes;boolean noRange,truncate,oversize;int rangeRequests,fullRequests;long transferred;
        Server(byte[] bytes){this.bytes=bytes;}
        @Override public InputStream open(long from,long length,boolean range)throws IOException{
            if(range){rangeRequests++;if(noRange)throw new IOException("Range unavailable");}else fullRequests++;
            int count=(int)length;if(truncate)count--;if(oversize)count++;
            byte[] result=Arrays.copyOfRange(bytes,(int)from,(int)from+count);transferred+=result.length;return new ByteArrayInputStream(result);
        }
    }
    static byte[] changed(byte[] old){byte[] next=old.clone();Arrays.fill(next,5*CHUNK,6*CHUNK,(byte)42);return next;}
    DeltaPlan.Plan plan(byte[] old,byte[] next)throws Exception{return DeltaPlan.build(DeltaPlan.parse(map(old),old.length),DeltaPlan.parse(map(next),next.length),false);}
    File base(byte[] old)throws Exception{File file=temporary.newFile();Files.write(file.toPath(),old);return file;}
    File target(){return new File(temporary.getRoot(),"updates/verified.apk");}
    @Test public void smallChangeDownloadsOnlyChangedRange()throws Exception{
        byte[] old=payload(1),next=changed(old);DeltaPlan.Plan plan=plan(old,next);assertTrue(plan.differential());assertEquals(CHUNK,plan.download());
        Server server=new Server(next);List<UpdateTransport.Progress> progress=new ArrayList<>();File output=UpdateTransport.download(server,new UpdateTransport.Base(base(old),0,old.length),plan,next.length,sha(next),target(),new AtomicBoolean(),progress::add);
        assertArrayEquals(next,Files.readAllBytes(output.toPath()));assertEquals(1,server.rangeRequests);assertEquals(0,server.fullRequests);assertTrue(server.transferred<next.length/4);assertEquals(next.length-CHUNK,progress.get(progress.size()-1).reused());
    }
    @Test public void apkEmbeddedPackOffsetCanBeCopied()throws Exception{
        byte[] old=payload(3),next=changed(old),apk=new byte[old.length+173];System.arraycopy(old,0,apk,173,old.length);Server server=new Server(next);
        File output=UpdateTransport.download(server,new UpdateTransport.Base(base(apk),173,old.length),plan(old,next),next.length,sha(next),target(),new AtomicBoolean(),p->{});assertEquals(sha(next),SafeFiles.sha256(output));assertEquals(1,server.rangeRequests);
    }
    @Test public void unsupportedRangeFallsBackToVerifiedFullDownload()throws Exception{
        byte[] old=payload(4),next=changed(old);Server server=new Server(next);server.noRange=true;
        File output=UpdateTransport.download(server,new UpdateTransport.Base(base(old),0,old.length),plan(old,next),next.length,sha(next),target(),new AtomicBoolean(),p->{});assertEquals(sha(next),SafeFiles.sha256(output));assertEquals(1,server.fullRequests);
    }
    @Test public void damagedBaseCannotProduceBadUpdate()throws Exception{
        byte[] old=payload(5),next=changed(old),bad=new byte[old.length];Server server=new Server(next);List<UpdateTransport.Progress> events=new ArrayList<>();
        File output=UpdateTransport.download(server,new UpdateTransport.Base(base(bad),0,bad.length),plan(old,next),next.length,sha(next),target(),new AtomicBoolean(),events::add);assertEquals(sha(next),SafeFiles.sha256(output));assertEquals(1,server.fullRequests);assertNotNull(events.get(events.size()-1).fallback());
    }
    @Test public void missingBaseFallsBackWithoutDeletingOldSave()throws Exception{
        byte[] old=payload(6),next=changed(old);File save=base("pet-save".getBytes());Server server=new Server(next);
        UpdateTransport.download(server,new UpdateTransport.Base(new File(temporary.getRoot(),"missing"),0,old.length),plan(old,next),next.length,sha(next),target(),new AtomicBoolean(),p->{});assertEquals("pet-save",SafeFiles.readText(save));assertEquals(1,server.fullRequests);
    }
    @Test public void largeChangeAndExplicitPolicySelectFull()throws Exception{
        byte[] old=payload(7),next=payload(8);assertFalse(plan(old,next).differential());assertFalse(DeltaPlan.build(DeltaPlan.parse(map(old),old.length),DeltaPlan.parse(map(changed(old)),old.length),true).differential());
    }
    @Test public void identicalFilesNeedNoNetwork()throws Exception{
        byte[] old=payload(9);Server server=new Server(old);DeltaPlan.Plan plan=plan(old,old);assertEquals(0,plan.download());UpdateTransport.download(server,new UpdateTransport.Base(base(old),0,old.length),plan,old.length,sha(old),target(),new AtomicBoolean(),p->{});assertEquals(0,server.transferred);
    }
    @Test public void failedFullHashLeavesNoInstallablePartial()throws Exception{
        byte[] bytes=payload(10);Server server=new Server(bytes);assertThrows(IOException.class,()->UpdateTransport.download(server,null,DeltaPlan.full(bytes.length),bytes.length,"0".repeat(64),target(),new AtomicBoolean(),p->{}));assertFalse(target().exists());assertFalse(new File(target()+".part").exists());
    }
    @Test public void shortAndOverlongResponsesAreRejected()throws Exception{
        byte[] bytes=payload(11);Server server=new Server(bytes);server.truncate=true;assertThrows(IOException.class,()->UpdateTransport.download(server,null,DeltaPlan.full(bytes.length),bytes.length,sha(bytes),target(),new AtomicBoolean(),p->{}));server.truncate=false;server.oversize=true;assertThrows(IOException.class,()->UpdateTransport.download(server,null,DeltaPlan.full(bytes.length),bytes.length,sha(bytes),target(),new AtomicBoolean(),p->{}));assertFalse(target().exists());
    }
    @Test public void cancelNeverInstallsPartial()throws Exception{
        byte[] bytes=payload(12);Server server=new Server(bytes);AtomicBoolean canceled=new AtomicBoolean(true);assertThrows(IOException.class,()->UpdateTransport.download(server,null,DeltaPlan.full(bytes.length),bytes.length,sha(bytes),target(),canceled,p->{}));assertFalse(target().exists());
    }
    @Test public void invalidIndexesAreBounded()throws Exception{
        assertThrows(IOException.class,()->DeltaPlan.parse(new byte[]{1,2,3},10));assertThrows(IOException.class,()->DeltaPlan.parse(map(payload(1)),1));
        assertThrows(IOException.class,()->DeltaPlan.parse(gzip(" ".repeat(8*1024*1024+1).getBytes()),1));
        assertThrows(IOException.class,()->DeltaPlan.parse(gzip(Json.of("version","3","files",new JSONArray()).toString().getBytes()),1));
    }
    @Test public void repositoryUrlsArePinnedAndPathsCannotEscape()throws Exception{
        assertTrue(UpdateTransport.releaseUrl("https://github.com/Vinci-217/mole-baby/releases/download/android-preview/ramu-320001.apk"));
        for(String url:List.of("http://github.com/Vinci-217/mole-baby/releases/download/a/b","https://github.com/attacker/mole-baby/releases/download/a/b","https://github.com/Vinci-217/mole-baby/releases/download/a/../b","https://github.com/Vinci-217/mole-baby/releases/download/a/b?token=1","https://github.com:443/Vinci-217/mole-baby/releases/download/a/b"))assertFalse(url,UpdateTransport.releaseUrl(url));
        for(String path:List.of("../save","assets/../../save","/tmp/save","assets\\evil","assets//evil","assets/./evil"))assertThrows(IOException.class,()->SafeFiles.child(temporary.getRoot(),path));
    }
}
