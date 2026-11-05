import java.io.*;
import java.nio.file.*;
import java.util.*;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.tags.base.*;
import com.jpexs.decompiler.flash.exporters.*;
import com.jpexs.decompiler.flash.exporters.settings.*;
import com.jpexs.decompiler.flash.exporters.modes.*;
import com.jpexs.decompiler.flash.exporters.swf.SwfXmlExporter;
public class RestaurantExporter {
 public static void main(String[] args)throws Exception {
  AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable e){throw new RuntimeException(e);}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  for(String line:Files.readAllLines(Path.of(args[0]))){
   String[] j=line.split("\t");String type=j[0];Path source=Path.of(j[1]),out=Path.of(j[2]);Files.createDirectories(out);
   SWF s=new SWF(Files.newInputStream(source),false);int sprite=0,frame=0;
   if(type.equals("model"))for(Tag tag:s.getTags())if(tag instanceof PlaceObjectTypeTag){PlaceObjectTypeTag p=(PlaceObjectTypeTag)tag;if("mc".equals(p.getInstanceName())){sprite=p.getCharacterId();frame=5;break;}}
   if(type.equals("room")){
    new SwfXmlExporter().exportXml(s,out.resolve("source.xml").toFile());
    List<Tag> removed=new ArrayList<>();for(Tag t:s.getTags())if(t instanceof PlaceObjectTypeTag){String name=((PlaceObjectTypeTag)t).getInstanceName();if(!Arrays.asList("bg_mc","depth_mc","top_mc").contains(name))removed.add(t);}
    for(Tag t:removed)s.removeTag(t);s.resetTimeline();
   }
   new FrameExporter().exportFrames(handler,out.toString(),s,sprite,Arrays.asList(frame),0,new FrameExportSettings(FrameExportMode.PNG,type.equals("room")?1:2,true,1),null);
   System.out.println(type+"\t"+source.getFileName()+"\t"+sprite);System.out.flush();s.clearAllCache();SWF.clearAllStaticCache();
  }
  System.exit(0);
 }
}
