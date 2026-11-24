import java.awt.image.BufferedImage;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import javax.imageio.ImageIO;

import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.commonshape.Matrix;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.timeline.DepthState;
import com.jpexs.decompiler.flash.timeline.Timeline;
import com.jpexs.decompiler.flash.types.RECT;

/** Bake the first original furniture facing and its two states without running ActionScript. */
public final class RoomFurnitureFrames {
    public static void main(String[] args) throws Exception {
        Path out = Path.of(args[2]);
        Files.createDirectories(out);
        int stateSprite = Integer.parseInt(args[3]), cycles = Integer.parseInt(args[4]);
        double zoom = Double.parseDouble(args[5]);
        int start = Integer.parseInt(args[6]);
        try (InputStream original = Files.newInputStream(Path.of(args[0]));
             InputStream probe = Files.newInputStream(Path.of(args[1]))) {
            SWF source = new SWF(original, false), probeSource = new SWF(probe, false);
            Timeline pose = ((DefineSpriteTag) source.getCharacter(stateSprite)).getTimeline();
            Timeline mask = ((DefineSpriteTag) probeSource.getCharacter(stateSprite)).getTimeline();
            RECT rect = pose.getDisplayRectWithFilters();
            save(pose, 0, 0, rect, zoom, out.resolve("reference.png"));

            // The original frame-1 script hides this named actor until activated.
            Map<Integer, DepthState> idleLayers = pose.getFrame(0).layers;
            DepthState pet = idleLayers.values().stream()
                .filter(layer -> "pet".equals(layer.instanceName)).findFirst().orElse(null);
            if (pet != null) idleLayers.remove(pet.depth);
            save(pose, 0, 0, rect, zoom, out.resolve("idle.png"));
            if (pet != null) idleLayers.put(pet.depth, pet);

            // The host holds the state on frame 2 while its children play.
            for (int i = 0; i < cycles; i++) {
                save(pose, 1, i + start, rect, zoom, out.resolve(i + "-n.png"));
                save(mask, 1, i + start, rect, zoom, out.resolve(i + "-p.png"));
            }
            Files.writeString(out.resolve("source-camera.txt"),
                rect.Xmin + " " + rect.Ymin + " " + rect.Xmax + " " + rect.Ymax);
        }
        System.exit(0);
    }

    private static void save(Timeline timeline, int frame, int time, RECT rect, double zoom, Path path) throws Exception {
        BufferedImage image = SWF.frameToImageGet(timeline, frame, time, null, 0, rect, new Matrix(),
            null, null, zoom, true, 1).getBufferedImage();
        ImageIO.write(image, "png", path.toFile());
    }
}
