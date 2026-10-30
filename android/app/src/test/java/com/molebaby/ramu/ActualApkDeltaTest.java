package com.molebaby.ramu;

import org.junit.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.junit.Assert.*;

/** Optional large fixture: the actual before/after signed APKs built by CI. */
public final class ActualApkDeltaTest {
    @Test public void nativeDownloaderRebuildsTheRealNextApkOverHttpRanges()throws Exception{
        String before=System.getProperty("mole.delta.old",""),after=System.getProperty("mole.delta.next","");Assume.assumeFalse("Actual APK fixture is exercised by emulator-smoke.sh",before.isEmpty()||after.isEmpty());
        File old=new File(before),next=new File(after),output=new File(System.getProperty("mole.delta.output"));
        DeltaPlan.MapFile oldMap=DeltaPlan.parse(SafeFiles.readLimited(new FileInputStream(before+".blockmap"),4*1024*1024),old.length()),nextMap=DeltaPlan.parse(SafeFiles.readLimited(new FileInputStream(after+".blockmap"),4*1024*1024),next.length());
        DeltaPlan.Plan plan=DeltaPlan.build(oldMap,nextMap,false);assertTrue("A version-only change should reuse the bundled original assets",plan.differential());assertTrue(plan.download()<next.length()/3);
        try(ServerSocket server=new ServerSocket(0,16,InetAddress.getByName("127.0.0.1"))){
            ExecutorService worker=Executors.newSingleThreadExecutor();java.util.concurrent.atomic.AtomicLong transferred=new java.util.concurrent.atomic.AtomicLong();
            Future<?> serving=worker.submit(()->{while(!server.isClosed())try(Socket socket=server.accept()){
                BufferedReader input=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.US_ASCII));String line,range=null;while((line=input.readLine())!=null&&!line.isEmpty())if(line.toLowerCase(java.util.Locale.ROOT).startsWith("range: "))range=line.substring(7);
                if(range==null)throw new IOException("A small real APK update must use Range");String[] parts=range.substring(6).split("-");long from=Long.parseLong(parts[0]),to=Long.parseLong(parts[1]);
                OutputStream out=socket.getOutputStream();out.write(("HTTP/1.1 206 Partial Content\r\nConnection: close\r\nContent-Length: "+(to-from+1)+"\r\nContent-Range: bytes "+from+"-"+to+"/"+next.length()+"\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
                try(RandomAccessFile file=new RandomAccessFile(next,"r")){file.seek(from);byte[] bytes=new byte[65536];long left=to-from+1;while(left>0){int n=file.read(bytes,0,(int)Math.min(left,bytes.length));if(n<0)throw new EOFException();out.write(bytes,0,n);left-=n;transferred.addAndGet(n);}}out.flush();
            }catch(IOException e){if(!server.isClosed())throw new UncheckedIOException(e);}});
            try{
                UpdateTransport.Source source=UpdateTransport.source((url,range)->{HttpURLConnection c=(HttpURLConnection)new URL("http://127.0.0.1:"+server.getLocalPort()+"/next.apk").openConnection();c.setConnectTimeout(5000);c.setReadTimeout(30000);if(range!=null)c.setRequestProperty("Range",range);return c;},"https://github.com/Vinci-217/mole-baby/releases/download/android-preview/next.apk",next.length());
                String digest=SafeFiles.sha256(next);UpdateTransport.download(source,new UpdateTransport.Base(old,0,old.length()),plan,next.length(),digest,output,new AtomicBoolean(),p->{});assertEquals(digest,SafeFiles.sha256(output));assertEquals(plan.download(),transferred.get());
                SafeFiles.atomicJson(new File(output.getParentFile(),"actual-apk-delta.json"),Json.of("mode","differential","fullSize",next.length(),"downloadBytes",plan.download(),"reusedBytes",plan.reuse(),"httpRequests",plan.requests(),"sha256",digest,"verified",true));
            }finally{server.close();worker.shutdownNow();}
        }
    }
}
