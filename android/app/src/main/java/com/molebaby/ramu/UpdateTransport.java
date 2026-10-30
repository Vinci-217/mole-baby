package com.molebaby.ramu;

import java.io.*;
import java.net.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

/** HTTPS only, repository-scoped redirects, bounded bodies, explicit Range semantics. */
final class UpdateTransport {
    interface Source { InputStream open(long from, long length, boolean range) throws IOException; }
    interface Connector {HttpURLConnection open(String url,String range)throws IOException;}
    interface Opener {HttpURLConnection open(URL address)throws IOException;}
    record Base(File file, long offset, long length) {}
    record Progress(String mode, long bytes, long total, long reused, String fallback) {}
    static boolean releaseUrl(String value) {
        try { URI u = URI.create(value); return "https".equals(u.getScheme()) && "github.com".equals(u.getHost()) && u.getRawUserInfo()==null && u.getPort()==-1 && u.getRawQuery()==null && u.getRawFragment()==null && u.getPath().matches("/Vinci-217/mole-baby/releases/download/[A-Za-z0-9._-]+/[A-Za-z0-9._-]+"); }
        catch (IllegalArgumentException e) { return false; }
    }
    static HttpURLConnection connect(String url, String range) throws IOException {
        return connect(url,range,address->(HttpURLConnection)address.openConnection());
    }
    static HttpURLConnection connect(String url,String range,Opener opener)throws IOException{
        if (!releaseUrl(url)) throw new IOException("更新地址不在本项目发布渠道中");
        for (int redirects=0; redirects<6; redirects++) {
            URL address = new URL(url); String host = address.getHost();
            if (!"https".equals(address.getProtocol()) || address.getUserInfo()!=null || !(host.equals("github.com") || host.equals("githubusercontent.com") || host.endsWith(".githubusercontent.com"))) throw new IOException("更新重定向地址无效");
            HttpURLConnection c = opener.open(address); c.setConnectTimeout(20000); c.setReadTimeout(45000); c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Accept-Encoding", "identity"); c.setRequestProperty("User-Agent", "mole-baby-android/"+BuildConfig.VERSION_NAME);
            if (range != null) c.setRequestProperty("Range", range);
            int status = c.getResponseCode();
            if (status==301 || status==302 || status==303 || status==307 || status==308) { String location=c.getHeaderField("Location"); c.disconnect(); if(location==null)throw new IOException("重定向缺少地址");url=new URL(address,location).toString(); continue; }
            return c;
        }
        throw new IOException("更新重定向过多");
    }
    static byte[] small(String url, int max) throws IOException {
        return small(UpdateTransport::connect,url,max);
    }
    static byte[] small(Connector connector,String url,int max)throws IOException{
        HttpURLConnection c = connector.open(url,null); try { int status=c.getResponseCode(); if(status!=200)throw new IOException(status==404?"安卓预览更新渠道尚未发布，当前安装可以继续使用":"更新服务返回 "+status); return SafeFiles.readLimited(c.getInputStream(),max); } finally { c.disconnect(); }
    }
    static Source source(String url, long expected) {
        return source(UpdateTransport::connect,url,expected);
    }
    static Source source(Connector connector,String url,long expected) {
        if(!releaseUrl(url))throw new IllegalArgumentException("非法更新地址");
        return (from,length,range)->{
            HttpURLConnection c=connector.open(url,range?"bytes="+from+"-"+(from+length-1):null);
            int status=c.getResponseCode();
            if ((range && (status!=206 || !("bytes "+from+"-"+(from+length-1)+"/"+expected).equals(c.getHeaderField("Content-Range")))) || (!range && status!=200)) {c.disconnect();throw new IOException("服务器未正确支持分段下载");}
            long size=c.getContentLengthLong(); if(size>=0 && size!=length){c.disconnect();throw new IOException("下载长度不符");}
            return new FilterInputStream(c.getInputStream()) { @Override public void close() throws IOException {try {super.close();} finally {c.disconnect();}} };
        };
    }
    static File download(Source source, Base base, DeltaPlan.Plan plan, long size, String sha, File target, AtomicBoolean cancel, Consumer<Progress> progress) throws IOException {
        if(size<1 || size>SafeFiles.MAX_PACKAGE || !SafeFiles.digest(sha)) throw new IOException("更新校验信息无效");
        target.getParentFile().mkdirs(); File part=new File(target.getPath()+".part"); String fallback=null;
        try {
            try { transfer(source,base,plan,size,part,cancel,progress,null); if(!sha.equals(SafeFiles.sha256(part)))throw new IOException("差量重建校验未通过"); }
            catch(IOException e) { if(cancel.get() || !plan.differential()) throw e; fallback=e.getMessage(); transfer(source,null,DeltaPlan.full(size),size,part,cancel,progress,fallback); }
            if(cancel.get())throw new IOException("下载已取消");
            if(part.length()!=size || !sha.equals(SafeFiles.sha256(part)))throw new IOException("更新校验失败，已保留原版本");
            java.nio.file.Files.move(part.toPath(),target.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING,java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            return target;
        } finally { if(part.exists())part.delete(); }
    }
    private static void transfer(Source source, Base base, DeltaPlan.Plan plan, long size, File out, AtomicBoolean cancel, Consumer<Progress> report, String fallback) throws IOException {
        long downloaded=0,last=0;
        try(RandomAccessFile dest=new RandomAccessFile(out,"rw"); RandomAccessFile old=base==null||!plan.differential()?null:new RandomAccessFile(base.file,"r")){
            dest.setLength(size);byte[] buffer=new byte[65536];
            for(DeltaPlan.Part p:plan.parts()){
                if(cancel.get())throw new IOException("下载已取消");dest.seek(p.target());
                if(p.copy()){
                    if(old==null || p.source()+p.size()>base.length || base.offset+base.length>old.length())throw new IOException("旧文件不完整");
                    old.seek(base.offset+p.source());long left=p.size();
                    while(left>0){if(cancel.get())throw new IOException("下载已取消");int n=old.read(buffer,0,(int)Math.min(buffer.length,left));if(n<0)throw new EOFException("旧文件已截断");dest.write(buffer,0,n);left-=n;}
                }else try(InputStream in=source.open(p.source(),p.size(),plan.differential())){
                    long left=p.size();while(left>0){if(cancel.get())throw new IOException("下载已取消");int n=in.read(buffer,0,(int)Math.min(buffer.length,left));if(n<0)throw new EOFException("下载提前结束");dest.write(buffer,0,n);left-=n;downloaded+=n;
                        long now=System.currentTimeMillis();if(now-last>200){report.accept(new Progress(plan.differential()?"differential":"full",downloaded,plan.download(),plan.reuse(),fallback));last=now;}
                    }if(in.read()!=-1)throw new IOException("下载内容超出声明范围");
                }
            }dest.getFD().sync();
        }
        report.accept(new Progress(plan.differential()?"differential":"full",downloaded,plan.download(),plan.reuse(),fallback));
    }
}
