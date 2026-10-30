package com.molebaby.ramu;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import java.io.*;
import java.nio.file.Files;
import static org.junit.Assert.*;
public final class MediaRangeTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    @Test public void fullAndOpenEndedMediaResponsesHaveKnownLengths(){assertEquals(new MediaRange.Slice(200,0,100,100),MediaRange.parse(null,100));assertEquals(new MediaRange.Slice(206,20,80,100),MediaRange.parse("bytes=20-",100));}
    @Test public void explicitAndSuffixRangesStayInsideFile(){assertEquals(new MediaRange.Slice(206,10,10,100),MediaRange.parse("bytes=10-19",100));assertEquals(new MediaRange.Slice(206,90,10,100),MediaRange.parse("bytes=-10",100));assertEquals(new MediaRange.Slice(206,0,100,100),MediaRange.parse("bytes=-1000",100));assertEquals(new MediaRange.Slice(206,90,10,100),MediaRange.parse("bytes=90-1000",100));}
    @Test public void malformedAndUnsatisfiableRangesReturn416(){for(String range:new String[]{"bytes=100-","bytes=20-10","bytes=-0","bytes=-","bytes=0-10,20-30","bytes=99999999999999999999999999-","items=0-10"})assertEquals(range,416,MediaRange.parse(range,100).status());assertEquals(416,MediaRange.parse("bytes=0-",0).status());}
    @Test public void theMediaStreamCannotReadPastItsDeclaredRange()throws Exception{File file=temporary.newFile();byte[] bytes=new byte[100];for(int i=0;i<100;i++)bytes[i]=(byte)i;Files.write(file.toPath(),bytes);try(InputStream in=MediaRange.open(file,MediaRange.parse("bytes=10-19",100))){assertEquals(10,in.available());assertEquals(10,in.read());assertEquals(3,in.skip(3));byte[] result=new byte[100];assertEquals(6,in.read(result));assertEquals(14,result[0]);assertEquals(19,result[5]);assertEquals(-1,in.read());assertEquals(-1,in.read(result));}}
}
