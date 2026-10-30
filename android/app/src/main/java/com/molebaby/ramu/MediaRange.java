package com.molebaby.ramu;

import java.io.*;

/** Local media needs real byte ranges for WebView seeking and looping. */
final class MediaRange {
    record Slice(int status,long start,long length,long total) {}
    static Slice parse(String header,long total){
        if(total<0)throw new IllegalArgumentException("Invalid media size");
        if(header==null)return new Slice(200,0,total,total);
        if(total==0||header.length()>128||!header.matches("bytes=[0-9]*-[0-9]*"))return new Slice(416,0,0,total);
        try{
            String[] parts=header.substring(6).split("-",-1);long start,end;
            if(parts[0].isEmpty()){long suffix=Long.parseLong(parts[1]);if(suffix<=0)return new Slice(416,0,0,total);start=Math.max(0,total-suffix);end=total-1;}
            else{start=Long.parseLong(parts[0]);end=parts[1].isEmpty()?total-1:Math.min(total-1,Long.parseLong(parts[1]));}
            if(start<0||start>=total||end<start)return new Slice(416,0,0,total);
            return new Slice(206,start,end-start+1,total);
        }catch(NumberFormatException e){return new Slice(416,0,0,total);}
    }
    static InputStream open(File file,Slice slice)throws IOException{
        FileInputStream input=new FileInputStream(file);try{input.getChannel().position(slice.start());}catch(IOException e){input.close();throw e;}
        return new FilterInputStream(input){long remaining=slice.length();
            @Override public int read()throws IOException{if(remaining==0)return -1;int result=super.read();if(result>=0)remaining--;return result;}
            @Override public int read(byte[] bytes,int offset,int size)throws IOException{if(size==0)return 0;if(remaining==0)return -1;int count=in.read(bytes,offset,(int)Math.min(size,remaining));if(count>0)remaining-=count;return count;}
            @Override public long skip(long n)throws IOException{if(n<=0)return 0;long count=in.skip(Math.min(n,remaining));remaining-=count;return count;}
            @Override public int available()throws IOException{return (int)Math.min(remaining,in.available());}
        };
    }
}
