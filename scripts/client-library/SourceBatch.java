import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.exporters.*;
import com.jpexs.decompiler.flash.exporters.settings.*;
import com.jpexs.decompiler.flash.exporters.modes.*;
import com.jpexs.decompiler.flash.tags.*;

/** A fresh process handles each bounded batch; exports are resumable per file. */
public class SourceBatch {
 public static void main(String[] args) throws Exception {
  Path vault=Path.of(args[0]),jobs=Path.of(args[1]);
  AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable error){throw new RuntimeException(error);}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  for(String line:Files.readAllLines(jobs,StandardCharsets.UTF_8)){
   if(line.isBlank())continue;
   String[] job=line.split("\t");String relative=job[0],flags=job[1];
   Path target=vault.resolve("extracted").resolve(relative),marker=target.resolve("complete.txt");
   if(Files.exists(marker)&&(!flags.contains("p")||Files.exists(target.resolve("pcode/complete.txt")))){System.out.println("CACHED\t"+relative);continue;}
   Files.createDirectories(target);
   long started=System.currentTimeMillis();
   Path normalized=vault.resolve("normalized").resolve(relative);
   try(InputStream input=Files.newInputStream(Files.exists(normalized)?normalized:vault.resolve("raw").resolve(relative))){
    SWF swf=new SWF(input,false);
    if(flags.contains("i"))new ImageExporter().exportImages(handler,target.resolve("images").toString(),swf.getTags(),new ImageExportSettings(ImageExportMode.PNG_GIF_JPEG),null);
    if(flags.contains("a"))new SoundExporter().exportSounds(handler,target.resolve("sounds").toString(),swf.getTags(),new SoundExportSettings(SoundExportMode.MP3_WAV),null);
    if(flags.contains("b")){
     Path binary=target.resolve("binaryData");Files.createDirectories(binary);
     // Some original linkage names exceed the filesystem filename limit.
     // Character IDs remain lossless keys; full linkage names are indexed.
     for(Tag tag:swf.getTags())if(tag instanceof DefineBinaryDataTag){
      DefineBinaryDataTag data=(DefineBinaryDataTag)tag;
      Files.write(binary.resolve(data.getCharacterId()+".bin"),data.getDataBytes().getRangeData());
     }
    }
    if(flags.contains("s"))swf.exportActionScript(handler,target.resolve(flags.contains("p")?"pcode":"scripts").toString(),null,new ScriptExportSettings(flags.contains("p")?ScriptExportMode.PCODE:ScriptExportMode.AS,false,false,false,false),false,null,true,true);
    swf.clearAllCache();SWF.clearAllStaticCache();
    if(flags.contains("p"))Files.writeString(target.resolve("pcode/complete.txt"),"Original ActionScript P-code exported\n",StandardCharsets.UTF_8);
    if(!Files.exists(marker))Files.writeString(marker,flags.contains("p")?"Original media and ActionScript P-code exported; high-level source required fallback\n":"Original source exported successfully\n",StandardCharsets.UTF_8);
    Files.deleteIfExists(target.resolve("error.txt"));
    System.out.println("OK\t"+relative+"\t"+(System.currentTimeMillis()-started));
   }catch(Throwable error){
    Files.writeString(target.resolve("error.txt"),error.toString(),StandardCharsets.UTF_8);
    System.out.println("ERROR\t"+relative+"\t"+error);
   }
   System.out.flush();
  }
  System.exit(0);
 }
}
