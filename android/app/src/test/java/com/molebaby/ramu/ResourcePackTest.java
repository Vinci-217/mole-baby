package com.molebaby.ramu;
import org.junit.*;
import org.junit.rules.TemporaryFolder;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.util.zip.*;
import static org.junit.Assert.*;

public final class ResourcePackTest {
    @Rule public TemporaryFolder temporary=new TemporaryFolder();
    static byte[] zip(String name,byte[] data)throws Exception{ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(ZipOutputStream zip=new ZipOutputStream(bytes)){zip.putNextEntry(new ZipEntry(name));zip.write(data);zip.closeEntry();}return bytes.toByteArray();}
    static JSONObject index(String path,byte[] bytes)throws Exception{return Json.of("schema",1,"revision","a".repeat(24),"files",new JSONArray().put(Json.of("path",path,"size",bytes.length,"sha256",DeltaDownloadTest.sha(bytes))));}
    File out(){return new File(temporary.getRoot(),"pack");}
    @Test public void verifiedDataIsAtomicallyActivated()throws Exception{byte[] bytes="frame-index".getBytes();ResourcePack.extract(new ByteArrayInputStream(zip("assets/frame.json",bytes)),index("assets/frame.json",bytes),out(),p->{});assertEquals("frame-index",SafeFiles.readText(new File(out(),"assets/frame.json")));assertTrue(new File(out(),"complete").exists());}
    @Test public void corruptPackCannotReplacePreviousVersion()throws Exception{byte[] bytes="correct".getBytes();out().mkdirs();SafeFiles.writeText(new File(out(),"old"),"previous");assertThrows(IOException.class,()->ResourcePack.extract(new ByteArrayInputStream(zip("assets/frame.json","damaged".getBytes())),index("assets/frame.json",bytes),out(),p->{}));assertEquals("previous",SafeFiles.readText(new File(out(),"old")));assertFalse(new File(out()+".staging").exists());}
    @Test public void scriptsAndTraversalAreRejected()throws Exception{for(String name:new String[]{"assets/evil.js","assets/page.html","../save","assets/native.dex","assets/lib.so"}){byte[] bytes="data".getBytes();assertThrows(IOException.class,()->ResourcePack.extract(new ByteArrayInputStream(zip(name,bytes)),index(name,bytes),out(),p->{}));}assertFalse(new File(out(),"complete").exists());}
    @Test public void unknownAndMissingEntriesAreRejected()throws Exception{byte[] bytes="data".getBytes();assertThrows(IOException.class,()->ResourcePack.extract(new ByteArrayInputStream(zip("assets/other.json",bytes)),index("assets/frame.json",bytes),out(),p->{}));}
    @Test public void decompressionBombIsBoundedByIndex()throws Exception{byte[] bytes=new byte[100000];JSONObject index=index("assets/frame.json",bytes);index.getJSONArray("files").getJSONObject(0).put("size",1);assertThrows(IOException.class,()->ResourcePack.extract(new ByteArrayInputStream(zip("assets/frame.json",bytes)),index,out(),p->{}));}
}
