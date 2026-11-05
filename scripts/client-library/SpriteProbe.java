import java.io.*;
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.tags.base.BoundedTag;
import com.jpexs.decompiler.flash.types.RECT;
public class SpriteProbe {
 public static void main(String[] args)throws Exception{
  SWF swf=new SWF(new FileInputStream(args[0]),false);
  for(int i=1;i<args.length;i++){
   int id=Integer.parseInt(args[i]);RECT r=((BoundedTag)swf.getCharacter(id)).getRect();
   System.out.println(id+"\t"+r.Xmin+"\t"+r.Ymin+"\t"+r.Xmax+"\t"+r.Ymax);
  }
  System.exit(0);
 }
}
