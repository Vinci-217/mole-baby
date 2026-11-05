import java.io.*;import java.nio.file.*;import java.util.*;
import com.jpexs.decompiler.flash.*;import com.jpexs.decompiler.flash.tags.*;import com.jpexs.decompiler.flash.tags.base.*;
import com.jpexs.decompiler.flash.exporters.*;import com.jpexs.decompiler.flash.exporters.settings.*;import com.jpexs.decompiler.flash.exporters.modes.*;import com.jpexs.decompiler.flash.types.RECT;
public class ClassicExporter{
 public static void main(String[]args)throws Exception{
  AbortRetryIgnoreHandler h=new AbortRetryIgnoreHandler(){public int handle(Throwable e){throw new RuntimeException(e);}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  for(String line:Files.readAllLines(Path.of(args[0]))){String[] j=line.split("\t");SWF swf=new SWF(Files.newInputStream(Path.of(j[1])),false);int id=Integer.parseInt(j[3]);
   if(id==-1)for(Tag t:swf.getTags())if(t instanceof PlaceObjectTypeTag&&"mc".equals(((PlaceObjectTypeTag)t).getInstanceName())){id=((PlaceObjectTypeTag)t).getCharacterId();break;}
   List<Integer> frames=null;if(!j[4].equals("all")){frames=new ArrayList<>();for(String f:j[4].split(","))frames.add(Integer.parseInt(f));}
   if(!j[2].equals("-"))new FrameExporter().exportFrames(h,j[2],swf,id,frames,0,new FrameExportSettings(FrameExportMode.PNG,Double.parseDouble(j[5]),true,1),null);
   RECT r=id==0?swf.displayRect:((BoundedTag)swf.getCharacter(id)).getRect();
   System.out.println(j[0]+"\t"+id+"\t"+r.Xmin+"\t"+r.Ymin+"\t"+r.Xmax+"\t"+r.Ymax);System.out.flush();swf.clearAllCache();SWF.clearAllStaticCache();
  }System.exit(0);
 }
}
