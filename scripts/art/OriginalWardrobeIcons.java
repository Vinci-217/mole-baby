import java.io.*;
import java.nio.file.*;
import java.util.*;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.exporters.FrameExporter;
import com.jpexs.decompiler.flash.exporters.settings.*;
import com.jpexs.decompiler.flash.exporters.modes.*;
public class OriginalWardrobeIcons {
 public static void main(String[] args)throws Exception{
  AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable e){throw new RuntimeException(e);}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  int count=0;
  for(String line:Files.readAllLines(Path.of(args[0]))){
   String[] row=line.split("\t");
   SWF source=new SWF(new FileInputStream(row[1]),false);
   new FrameExporter().exportFrames(handler,row[2],source,0,List.of(0),0,new FrameExportSettings(FrameExportMode.PNG,2,true,1),null);
   source.clearAllCache();SWF.clearAllStaticCache();count++;
  }
  System.out.println("Original icons exported: "+count);System.exit(0);
 }
}
