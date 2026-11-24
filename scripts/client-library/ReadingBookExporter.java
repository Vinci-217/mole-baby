import java.io.*;
import java.util.*;
import java.awt.geom.Rectangle2D;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.tags.base.*;
import com.jpexs.decompiler.flash.timeline.*;
import com.jpexs.decompiler.flash.types.RECT;
import com.jpexs.decompiler.flash.exporters.FrameExporter;
import com.jpexs.decompiler.flash.exporters.settings.FrameExportSettings;
import com.jpexs.decompiler.flash.exporters.modes.FrameExportMode;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;

/** Derive reading pages; changes are in memory only, never saved to the SWF. */
public class ReadingBookExporter {
 public static void main(String[] args)throws Exception{
  SWF swf=new SWF(new FileInputStream(args[0]),false);int sprite=Integer.parseInt(args[1]);
  Timeline timeline=sprite==0?swf.getTimeline():((DefineSpriteTag)swf.getCharacter(sprite)).getTimeline();
  if(args.length>5){
   // The Flash client hides these confirmation dialogs until a purchase is
   // requested. Restore that display state for the offline reading export.
   Set<String> hidden=new HashSet<>(Arrays.asList(args[5].split(",")));
   for(int index=0;index<timeline.getFrameCount();index++){
    for(DepthState state:timeline.getFrame(index).layers.values()){
     if(hidden.contains(state.instanceName))state.isVisible=false;
    }
   }
  }
  List<String> textInfo=new ArrayList<>();List<Integer> wrapped=new ArrayList<>();
  for(Tag tag:swf.getTags())if(tag instanceof DefineEditTextTag){
   DefineEditTextTag text=(DefineEditTextTag)tag;String content=text.initialText==null?"":text.initialText;
   if(content.length()>50){
    textInfo.add("{\"id\":"+text.characterID+",\"wrap\":"+text.wordWrap+",\"multiline\":"+text.multiline+",\"text\":"+BookLayoutProbe.quote(content)+",\"rect\":"+BookLayoutProbe.rect(BookLayoutProbe.bounds(text.bounds))+"}");
    if(args.length>2&&(args[2].equals("wrap")||args[2].equals("fit"))&&content.toLowerCase(Locale.ROOT).contains("<sbr")){text.initialText=content.replaceAll("(?i)<sbr\\s*/>","<br/>");text.wordWrap=true;text.multiline=true;if(args[2].equals("fit")){java.util.regex.Matcher sizes=java.util.regex.Pattern.compile("size=\"(\\d+)\"").matcher(text.initialText);StringBuffer fitted=new StringBuffer();while(sizes.find())sizes.appendReplacement(fitted,"size=\""+Math.max(11,(int)Math.floor(Integer.parseInt(sizes.group(1))*.86))+"\"");sizes.appendTail(fitted);text.initialText=fitted.toString();text.fontHeight=(int)Math.round(text.fontHeight*.86);text.bounds.Xmax=text.bounds.Xmin+(int)Math.round((text.bounds.Xmax-text.bounds.Xmin)*.85);}text.setModified(true);wrapped.add(text.characterID);}
   }
  }
  if(args.length>3){
   List<Integer> frames=new ArrayList<>();for(String frame:args[3].split(","))frames.add(Integer.parseInt(frame));
   AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable error){error.printStackTrace();return ABORT;}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
   new FrameExporter().exportFrames(handler,args[4],swf,sprite,frames,0,new FrameExportSettings(FrameExportMode.PNG,1,true,1),null);
  }
  RECT bounds=timeline.getDisplayRectWithFilters();
  StringBuilder output=new StringBuilder("{\"bounds\":").append(BookLayoutProbe.rect(BookLayoutProbe.bounds(bounds))).append(",\"wrappedTextIds\":").append(wrapped).append(",\"texts\":[").append(String.join(",",textInfo)).append("],\"frames\":[");
  for(int frame=0;frame<timeline.getFrameCount();frame++){
   if(frame>0)output.append(',');List<String> controls=new ArrayList<>();BookLayoutProbe.controls(timeline,frame,new Matrix(),"",0,controls);output.append("{\"controls\":[").append(String.join(",",controls)).append("]}");
  }
  output.append("]}");System.out.println(output);System.exit(0);
 }
}
