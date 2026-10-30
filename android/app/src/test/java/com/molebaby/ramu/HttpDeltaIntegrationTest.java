package com.molebaby.ramu;

import org.junit.*;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

public final class HttpDeltaIntegrationTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    static final String TRUSTED="https://github.com/Vinci-217/mole-baby/releases/download/android-preview/test.apk";
    static final class RangeServer implements AutoCloseable {
        final ServerSocket server=new ServerSocket(0,16,InetAddress.getByName("127.0.0.1"));final ExecutorService worker=Executors.newSingleThreadExecutor();final byte[] bytes;final List<String> ranges=Collections.synchronizedList(new ArrayList<>());volatile boolean brokenRange;
        RangeServer(byte[] bytes)throws Exception{this.bytes=bytes;worker.submit(()->{while(!server.isClosed())try(Socket socket=server.accept()){
            BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String line;String range=null;while((line=input.readLine())!=null&&!line.isEmpty())if(line.toLowerCase(Locale.ROOT).startsWith("range: "))range=line.substring(7);
            ranges.add(range==null?"full":range);int from=0,to=bytes.length-1;boolean partial=range!=null&&!brokenRange;
            if(partial){String[] bounds=range.substring(6).split("-");from=Integer.parseInt(bounds[0]);to=Integer.parseInt(bounds[1]);}
            OutputStream out=socket.getOutputStream();String headers="HTTP/1.1 "+(partial?"206 Partial Content":"200 OK")+"\r\nConnection: close\r\nContent-Length: "+(to-from+1)+"\r\n"+(partial?"Content-Range: bytes "+from+"-"+to+"/"+bytes.length+"\r\n":"")+"\r\n";out.write(headers.getBytes(StandardCharsets.US_ASCII));out.write(bytes,from,to-from+1);out.flush();
        }catch(Exception ignored){}});}
        UpdateTransport.Source source(){return UpdateTransport.source((url,range)->{HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+server.getLocalPort()+"/fixture.apk").openConnection();c.setConnectTimeout(5000);c.setReadTimeout(5000);if(range!=null)c.setRequestProperty("Range",range);return c;},TRUSTED,bytes.length);}
        @Override public void close()throws Exception{server.close();worker.shutdownNow();}
    }
    @Test public void realHttp206RebuildsApkFromOnlyChangedBytes()throws Exception{byte[] old=DeltaDownloadTest.payload(42),next=DeltaDownloadTest.changed(old);File baseline=temporary.newFile("old.apk"),target=new File(temporary.getRoot(),"pending/new.apk");Files.write(baseline.toPath(),old);DeltaPlan.Plan plan=DeltaPlan.build(DeltaPlan.parse(DeltaDownloadTest.map(old),old.length),DeltaPlan.parse(DeltaDownloadTest.map(next),next.length),false);
        try(RangeServer server=new RangeServer(next)){UpdateTransport.download(server.source(),new UpdateTransport.Base(baseline,0,old.length),plan,next.length,DeltaDownloadTest.sha(next),target,new AtomicBoolean(),p->{});assertArrayEquals(next,Files.readAllBytes(target.toPath()));assertEquals(List.of("bytes="+(5*DeltaDownloadTest.CHUNK)+"-"+(6*DeltaDownloadTest.CHUNK-1)),server.ranges);}
    }
    @Test public void serverIgnoringRangeGetsExactlyOneFullFallback()throws Exception{byte[] old=DeltaDownloadTest.payload(43),next=DeltaDownloadTest.changed(old);File baseline=temporary.newFile("old.apk"),target=new File(temporary.getRoot(),"pending/new.apk");Files.write(baseline.toPath(),old);DeltaPlan.Plan plan=DeltaPlan.build(DeltaPlan.parse(DeltaDownloadTest.map(old),old.length),DeltaPlan.parse(DeltaDownloadTest.map(next),next.length),false);
        try(RangeServer server=new RangeServer(next)){server.brokenRange=true;UpdateTransport.download(server.source(),new UpdateTransport.Base(baseline,0,old.length),plan,next.length,DeltaDownloadTest.sha(next),target,new AtomicBoolean(),p->{});assertEquals(2,server.ranges.size());assertEquals("full",server.ranges.get(1));assertEquals(DeltaDownloadTest.sha(next),SafeFiles.sha256(target));}
    }
}
