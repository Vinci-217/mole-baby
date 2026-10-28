import java.io.*;
import java.util.*;
import com.jpexs.decompiler.flash.*;
import com.jpexs.decompiler.flash.abc.ScriptPack;
import com.jpexs.decompiler.flash.tags.*;
import com.jpexs.decompiler.flash.tags.base.*;
import com.jpexs.decompiler.flash.exporters.FrameExporter;
import com.jpexs.decompiler.flash.exporters.SoundExporter;
import com.jpexs.decompiler.flash.exporters.ShapeExporter;
import com.jpexs.decompiler.flash.importers.SwfXmlImporter;
import com.jpexs.decompiler.flash.exporters.swf.SwfXmlExporter;
import com.jpexs.decompiler.flash.exporters.settings.*;
import com.jpexs.decompiler.flash.exporters.modes.*;
public class SourceExporter {
 public static void main(String[] args) throws Exception {
  if(args[0].equals("xml2swf")){
   SWF swf=new SWF();new SwfXmlImporter().importSwf(swf,new FileInputStream(args[1]),new File(args[1]).getParentFile());
   try(FileOutputStream output=new FileOutputStream(args[2])){swf.saveTo(output);}System.exit(0);
  }
  SWF swf=new SWF(new FileInputStream(args[1]),false);
  AbortRetryIgnoreHandler handler=new AbortRetryIgnoreHandler(){public int handle(Throwable ex){ex.printStackTrace();return ABORT;}public AbortRetryIgnoreHandler getNewInstance(){return this;}};
  if(args[0].equals("sounds")){new SoundExporter().exportSounds(handler,args[2],swf.getTags(),new SoundExportSettings(SoundExportMode.MP3_WAV),null);System.exit(0);}
  if(args[0].equals("shapes")){new ShapeExporter().exportShapes(handler,args[2],swf,swf.getTags(),new ShapeExportSettings(ShapeExportMode.PNG,3),null,1,1);System.exit(0);}
  if(args[0].equals("xml")){new SwfXmlExporter().exportXml(swf,new File(args[2]));System.out.println("XML "+args[2]);System.exit(0);}
  if(args[0].equals("classes")){for(ScriptPack pack:swf.getAS3Packs())System.out.println(pack.getClassPath().toRawString());System.exit(0);}
  if(args[0].equals("scripts")){
   List<ScriptPack> packs=null;
   if(args.length>3){packs=new ArrayList<>();for(ScriptPack p:swf.getAS3Packs())if(p.getClassPath().toRawString().toLowerCase().matches(args[3]))packs.add(p);System.out.println("Selected classes: "+packs.size());}
   swf.exportActionScript(handler,args[2],packs,new ScriptExportSettings(ScriptExportMode.AS,false,false,false,false),false,null,true,true);
   System.out.println("Scripts exported");System.exit(0);
  }
  int sprite=args.length>3?Integer.parseInt(args[3]):0;
  if(args[0].equals("object")){
   for(Tag tag:swf.getTags())if(tag instanceof PlaceObjectTypeTag){int id=((PlaceObjectTypeTag)tag).getCharacterId();if(swf.getCharacter(id) instanceof DefineSpriteTag && "mc2".equals(((PlaceObjectTypeTag)tag).getInstanceName())){sprite=id;break;}}
  }
  List<Integer> frames=args.length>4&&!args[4].equals("-1")?Arrays.asList(Integer.parseInt(args[4])):null;
  int sub=args[0].equals("nested")?Integer.parseInt(args[5]):0;
  double zoom=args[0].equals("nested")?(args.length>6?Double.parseDouble(args[6]):1):(args.length>5?Double.parseDouble(args[5]):1);
  if(args[0].equals("nested") && args.length>7 && !args[7].isEmpty()){
   for(String value:args[7].split(",")){
    DefineSpriteTag placeholder=(DefineSpriteTag)swf.getCharacter(Integer.parseInt(value));
    List<Tag> removed=new ArrayList<>();for(Tag tag:placeholder.getTags())if(!(tag instanceof ShowFrameTag))removed.add(tag);
    for(Tag tag:removed)placeholder.removeTag(tag);placeholder.resetTimeline();
   }
  }
  List<File> files=new FrameExporter().exportFrames(handler,args[2],swf,sprite,frames,sub,new FrameExportSettings(FrameExportMode.PNG,zoom,true,1),null);
  System.out.println("Exported "+files.size()+" files, sprite "+sprite);System.exit(0);
 }
}
