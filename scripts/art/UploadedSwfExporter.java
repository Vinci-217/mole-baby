import java.io.*;
import java.nio.file.*;
import java.awt.image.BufferedImage;
import java.util.*;
import javax.imageio.ImageIO;
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.timeline.Timeline;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.exporters.swf.SwfXmlExporter;
import com.jpexs.decompiler.flash.types.RECT;

/** Offline rasterization only. Never evaluates uploaded ActionScript. */
public class UploadedSwfExporter {
  static SWF open(String file) throws Exception { return new SWF(new FileInputStream(file),false); }
  public static void main(String[] args) throws Exception {
    if(args[0].equals("xml")) {
      Path input=Path.of(args[1]), output=Path.of(args[2]);
      try(var files=Files.walk(input)) {
        for(Path file:files.filter(p->p.toString().endsWith(".swf")).sorted().toList()) {
          Path target=output.resolve(input.relativize(file).toString().replace(".swf",".xml"));
          if(Files.exists(target))continue;
          Files.createDirectories(target.getParent());
          new SwfXmlExporter().exportXml(open(file.toString()),target.toFile());
          System.out.println(input.relativize(file));
        }
      }
      return;
    }
    SWF neutral=open(args[1]), probe=open(args[2]);
    Path out=Path.of(args[3]);Files.createDirectories(out);
    int sprite=Integer.parseInt(args[4]), count=Integer.parseInt(args[5]);
    double zoom=Double.parseDouble(args[6]);
    Timeline normal=((DefineSpriteTag)neutral.getCharacter(sprite)).getTimeline();
    Timeline tinted=((DefineSpriteTag)probe.getCharacter(sprite)).getTimeline();
    RECT rect=normal.getDisplayRectWithFilters();
    ArrayList<String> entries=new ArrayList<>();
    for(int frame=0;frame<count;frame++) {
      BufferedImage n=SWF.frameToImageGet(normal,0,frame,null,0,rect,new Matrix(),null,null,zoom,true,1).getBufferedImage();
      int left=n.getWidth(),top=n.getHeight(),right=0,bottom=0;
      for(int y=0;y<n.getHeight();y++)for(int x=0;x<n.getWidth();x++)if((n.getRGB(x,y)>>>24)>0){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
      if(right==0){left=top=0;right=bottom=1;}
      BufferedImage p=SWF.frameToImageGet(tinted,0,frame,null,0,rect,new Matrix(),null,null,zoom,true,1).getBufferedImage();
      ImageIO.write(n.getSubimage(left,top,right-left,bottom-top),"png",out.resolve(frame+"-n.png").toFile());
      ImageIO.write(p.getSubimage(left,top,right-left,bottom-top),"png",out.resolve(frame+"-p.png").toFile());
      entries.add("["+left+","+top+","+(right-left)+","+(bottom-top)+"]");
    }
    Files.writeString(out.resolve("frames.json"),"{\"zoom\":"+zoom+",\"rect\":["+rect.Xmin+","+rect.Ymin+","+rect.Xmax+","+rect.Ymax+"],\"frames\":["+String.join(",",entries)+"]}");
    System.out.println("Exported "+count+" source frames: "+out);
  }
}
