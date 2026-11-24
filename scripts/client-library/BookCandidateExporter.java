import java.io.*;
import java.nio.file.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.tags.base.TextTag;
import com.jpexs.decompiler.flash.exporters.FrameExporter;
import com.jpexs.decompiler.flash.exporters.settings.FrameExportSettings;
import com.jpexs.decompiler.flash.exporters.modes.FrameExportMode;

/** Export selected existing book frames and extract embedded text, without AS. */
public class BookCandidateExporter {
 static String quote(String value){return "\""+value.replace("\\","\\\\").replace("\"","\\\"").replace("\r","\\r").replace("\n","\\n").replace("\t","\\t").replace("\b","\\b").replace("\f","\\f")+"\"";}
 public static void main(String[] args)throws Exception{
  AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable error){error.printStackTrace();return ABORT;}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  for(String line:Files.readAllLines(Path.of(args[0]),StandardCharsets.UTF_8)){
   if(line.isBlank())continue;String[] columns=line.split("\t");
   try(FileInputStream input=new FileInputStream(columns[0])){
    SWF swf=new SWF(input,false);int sprite=Integer.parseInt(columns[1]);
    List<Integer> frames=new ArrayList<>();for(String frame:columns[3].split(","))frames.add(Integer.parseInt(frame));
    new FrameExporter().exportFrames(handler,columns[2],swf,sprite,frames,0,new FrameExportSettings(FrameExportMode.PNG,1,true,1),null);
    Set<String> texts=new LinkedHashSet<>();for(Tag tag:swf.getTags())if(tag instanceof TextTag)texts.addAll(((TextTag)tag).getTexts());
    List<String> encoded=new ArrayList<>();for(String value:texts)if(!value.isBlank())encoded.add(quote(value));
    System.out.println("{\"source\":"+quote(columns[0])+",\"sprite\":"+sprite+",\"texts\":["+String.join(",",encoded)+"]}");System.out.flush();
    swf.clearAllCache();
   }catch(Exception error){System.out.println("{\"source\":"+quote(columns[0])+",\"error\":"+quote(error.toString())+"}");System.out.flush();}
   System.gc();
  }
  System.exit(0);
 }
}
