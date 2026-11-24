import java.io.*;
import java.util.*;
import java.awt.geom.Rectangle2D;
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.base.BoundedTag;
import com.jpexs.decompiler.flash.timeline.*;
import com.jpexs.decompiler.flash.types.RECT;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;

/** Read original button placements without running the client's scripts. */
public class BookLayoutProbe {
 static String quote(String value){
  StringBuilder escaped=new StringBuilder("\"");
  for(int index=0;index<value.length();index++){
   char character=value.charAt(index);
   if(character=='\\'||character=='\"')escaped.append('\\').append(character);
   else if(character<32)escaped.append(String.format(Locale.ROOT,"\\u%04x",(int)character));
   else escaped.append(character);
  }
  return escaped.append('"').toString();
 }
 static String rect(Rectangle2D r){return String.format(Locale.ROOT,"[%.4f,%.4f,%.4f,%.4f]",r.getX()/20,r.getY()/20,r.getWidth()/20,r.getHeight()/20);}
 static Rectangle2D bounds(RECT r){return new Rectangle2D.Double(r.Xmin,r.Ymin,r.Xmax-r.Xmin,r.Ymax-r.Ymin);}
 static void controls(Timeline timeline,int frame,Matrix parent,String path,int level,List<String> result){
  if(level>5)return;
  Frame f=timeline.getFrame(Math.min(frame,timeline.getFrameCount()-1));if(f==null)return;
  for(DepthState state:f.layers.values()){
   if(!state.isVisible||!(state.getCharacter() instanceof BoundedTag))continue;
   Matrix transform=parent.concatenate(state.matrix==null?new Matrix():new Matrix(state.matrix));
   String name=state.instanceName==null?"":state.instanceName,full=path+(name.isEmpty()?"#"+state.characterId:name);
   if(!name.isEmpty()&&name.toLowerCase(Locale.ROOT).matches(".*(next|pre|close|fan|btn|button).*"))
    result.add("{\"name\":"+quote(name)+",\"path\":"+quote(full)+",\"rect\":"+rect(transform.transform(bounds(((BoundedTag)state.getCharacter()).getRect())))+"}");
   if(state.getCharacter() instanceof DefineSpriteTag){
    Timeline child=((DefineSpriteTag)state.getCharacter()).getTimeline();
    if(child.getFrameCount()>0)controls(child,0,transform,full+"/",level+1,result);
   }
  }
 }
 public static void main(String[] args)throws Exception{
  SWF swf=new SWF(new FileInputStream(args[0]),false);int sprite=Integer.parseInt(args[1]);
  Timeline timeline=sprite==0?swf.getTimeline():((DefineSpriteTag)swf.getCharacter(sprite)).getTimeline();
  // FrameExporter renders with this rectangle, including filter extents. A
  // sprite's ordinary bounds can differ, shifting every hotspot on the PNG.
  RECT rectangle=timeline.getDisplayRectWithFilters();
  StringBuilder out=new StringBuilder("{\"bounds\":").append(rect(bounds(rectangle))).append(",\"frames\":[");
  for(int frame=0;frame<timeline.getFrameCount();frame++){
   if(frame>0)out.append(',');List<String> found=new ArrayList<>();controls(timeline,frame,new Matrix(),"",0,found);
   out.append("{\"controls\":[").append(String.join(",",found)).append("]}");
  }
  out.append("]}");System.out.println(out);System.exit(0);
 }
}
