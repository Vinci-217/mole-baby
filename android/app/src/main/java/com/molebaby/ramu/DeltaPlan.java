package com.molebaby.ramu;

import org.json.*;
import java.io.*;
import java.util.*;
import java.util.zip.GZIPInputStream;

/** Electron-compatible blockmap v2. The finished payload is always SHA-256 checked. */
final class DeltaPlan {
    record Block(long offset, int size, String checksum) {}
    record Part(boolean copy, long source, long target, long size) {}
    record MapFile(long size, List<Block> blocks) {}
    record Plan(List<Part> parts, long download, long reuse, int requests, boolean differential) {}
    static MapFile parse(byte[] compressed, long expected) throws IOException {
        if (compressed.length > 4 * 1024 * 1024 || expected < 1 || expected > SafeFiles.MAX_PACKAGE) throw new IOException("无效分块索引");
        try {
            byte[] raw = SafeFiles.readLimited(new GZIPInputStream(new ByteArrayInputStream(compressed)), 8 * 1024 * 1024);
            JSONObject map = new JSONObject(new String(raw, java.nio.charset.StandardCharsets.UTF_8));
            JSONArray files = map.getJSONArray("files");
            if (!"2".equals(map.getString("version")) || files.length() != 1) throw new IOException("不支持的分块索引");
            JSONObject file = files.getJSONObject(0); JSONArray sizes = file.getJSONArray("sizes"), checks = file.getJSONArray("checksums");
            if (file.optLong("offset", -1) != 0 || sizes.length() == 0 || sizes.length() > 150000 || sizes.length() != checks.length()) throw new IOException("分块索引损坏");
            List<Block> blocks = new ArrayList<>(); long offset = 0;
            for (int i = 0; i < sizes.length(); i++) { int size = sizes.getInt(i); String checksum = checks.getString(i);
                if (size <= 0 || size > 16 * 1024 * 1024 || !checksum.matches("[A-Za-z0-9+/]{20,128}={0,2}") || offset + size > expected) throw new IOException("分块范围无效");
                blocks.add(new Block(offset, size, checksum)); offset += size;
            }
            if (offset != expected) throw new IOException("分块大小不符");
            return new MapFile(offset, List.copyOf(blocks));
        } catch (JSONException | IllegalArgumentException e) { throw new IOException("无法读取分块索引", e); }
    }
    static Plan build(MapFile old, MapFile next, boolean forceFull) {
        if (forceFull || old == null) return full(next.size);
        HashMap<String, Block> byHash = new HashMap<>();
        for (Block b : old.blocks) byHash.putIfAbsent(b.checksum + ":" + b.size, b);
        List<Part> parts = new ArrayList<>();
        for (Block b : next.blocks) {
            Block match = byHash.get(b.checksum + ":" + b.size);
            Part p = new Part(match != null, match == null ? b.offset : match.offset, b.offset, b.size);
            if (!parts.isEmpty()) { Part previous = parts.get(parts.size()-1);
                if (previous.copy == p.copy && previous.source + previous.size == p.source && previous.target + previous.size == p.target) {
                    parts.set(parts.size()-1, new Part(p.copy, previous.source, previous.target, previous.size+p.size)); continue;
                }
            }
            parts.add(p);
        }
        // Coalesce tiny copied gaps between ranges to avoid hundreds of HTTP requests.
        for (int i = 1; i + 1 < parts.size();) {
            Part a = parts.get(i-1), b = parts.get(i), c = parts.get(i+1);
            if (!a.copy && b.copy && b.size <= 65536 && !c.copy) {
                parts.set(i-1, new Part(false,a.target,a.target,a.size+b.size+c.size)); parts.remove(i+1); parts.remove(i);
            } else i++;
        }
        long download = 0; int requests = 0;
        for (Part p : parts) if (!p.copy) { download += p.size; requests++; }
        if (download >= next.size * .9 || requests > 512 || download + requests * 65536L >= next.size * .9) return full(next.size);
        return new Plan(List.copyOf(parts), download, next.size-download, requests, true);
    }
    static Plan full(long size) { return new Plan(List.of(new Part(false,0,0,size)),size,0,1,false); }
}
