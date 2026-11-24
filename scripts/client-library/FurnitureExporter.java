import java.awt.image.BufferedImage;
import java.io.File;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashSet;
import java.util.List;
import javax.imageio.ImageIO;

import com.jpexs.decompiler.flash.AbortRetryIgnoreHandler;
import com.jpexs.decompiler.flash.SWF;
import com.jpexs.decompiler.flash.exporters.FrameExporter;
import com.jpexs.decompiler.flash.exporters.modes.FrameExportMode;
import com.jpexs.decompiler.flash.exporters.settings.FrameExportSettings;
import com.jpexs.decompiler.flash.tags.DefineSpriteTag;
import com.jpexs.decompiler.flash.tags.Tag;
import com.jpexs.decompiler.flash.tags.base.PlaceObjectTypeTag;
import com.jpexs.decompiler.flash.types.RECT;

/** Export the default artwork shown by the original house and garden placement views. */
public final class FurnitureExporter {
    private static final AbortRetryIgnoreHandler HANDLER = new AbortRetryIgnoreHandler() {
        public int handle(Throwable error) { throw new IllegalStateException(error); }
        public AbortRetryIgnoreHandler getNewInstance() { return this; }
    };

    private record Render(String source, String mode, int sprite, int frame, double zoom, File image) {}

    public static void main(String[] args) throws Exception {
        Path raw = Path.of(args[0]), work = Path.of(args[2]);
        for (String line : Files.readAllLines(Path.of(args[1]))) {
            String[] job = line.split("\t", -1);
            String id = job[0], placement = job[1], icon = job[2];
            Path dest = work.resolve(id);
            try {
                Render render = attempt(raw, placement, dest, "mc2");
                if (render == null) render = attempt(raw, icon, dest, "icon");
                if (render == null) render = attempt(raw, placement, dest, "root");
                if (render == null) {
                    System.out.println("SKIP\t" + id);
                } else {
                    System.out.printf(java.util.Locale.ROOT, "OK\t%s\t%s\t%s\t%d\t%d\t%.8f\t%s%n",
                        id, render.source, render.mode, render.sprite, render.frame + 1, render.zoom, render.image);
                }
            } catch (Exception error) {
                System.err.println(id + ": " + error);
                System.out.println("SKIP\t" + id);
            }
        }
        System.exit(0);
    }

    private static Render attempt(Path raw, String source, Path dest, String mode) {
        if (source.isEmpty()) return null;
        try (InputStream input = Files.newInputStream(raw.resolve(source))) {
            SWF swf = new SWF(input, false);
            try {
                DefineSpriteTag facing = mode.equals("mc2") ? placedArt(swf) : null;
                if (mode.equals("mc2") && facing == null) return null;
                int sprite = facing == null ? 0 : facing.getCharacterId();
                int count = facing == null ? swf.getTimeline().getFrameCount() : facing.getFrameCount();
                RECT rect = facing == null ? swf.getRect() : facing.getRect();
                double edge = Math.max(rect.getWidth(), rect.getHeight()) / 20.0;
                if (edge < 1) return null;
                double zoom = Math.min(3.0, 448.0 / edge);
                Path output = dest.resolve(mode);
                Files.createDirectories(output);
                for (int frame : new LinkedHashSet<>(List.of(0, 1, Math.min(5, count - 1), count - 1))) {
                    if (frame < 0 || frame >= count) continue;
                    List<File> pngs = new FrameExporter().exportFrames(HANDLER, output.toString(), swf, sprite,
                        List.of(frame), 0, new FrameExportSettings(FrameExportMode.PNG, zoom, true, 1), null);
                    if (!pngs.isEmpty() && hasVisiblePixels(pngs.get(0))) {
                        return new Render(source, mode, sprite, frame, zoom, pngs.get(0));
                    }
                }
            } finally {
                swf.clearAllCache();
                SWF.clearAllStaticCache();
            }
        } catch (Exception error) {
            System.err.println(source + " (" + mode + "): " + error);
        }
        return null;
    }

    private static DefineSpriteTag placedArt(SWF swf) {
        for (Tag tag : swf.getTags()) {
            if (tag instanceof PlaceObjectTypeTag placement && "mc2".equals(placement.getInstanceName())
                && swf.getCharacter(placement.getCharacterId()) instanceof DefineSpriteTag sprite) {
                return sprite;
            }
        }
        return null;
    }

    private static boolean hasVisiblePixels(File file) throws Exception {
        BufferedImage image = ImageIO.read(file);
        if (image == null || Math.max(image.getWidth(), image.getHeight()) < 7) return false;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                if ((image.getRGB(x, y) >>> 24) > 8) return true;
            }
        }
        return false;
    }
}
