package com.molebaby.ramu;

import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;

/** All downloaded data stays in app-private storage until verified. */
final class SafeFiles {
    static final long MAX_PACKAGE = 1024L * 1024 * 1024;
    private SafeFiles() {}
    static File child(File root, String relative) throws IOException {
        if (relative.isEmpty() || relative.startsWith("/") || relative.contains("\\") || relative.indexOf('\0') >= 0)
            throw new IOException("非法资源路径");
        for (String part : relative.split("/", -1))
            if (part.isEmpty() || part.equals(".") || part.equals("..")) throw new IOException("非法资源路径");
        File result = new File(root, relative).getCanonicalFile();
        if (!result.toPath().startsWith(root.getCanonicalFile().toPath())) throw new IOException("资源越界");
        return result;
    }
    static byte[] readLimited(InputStream input, int maximum) throws IOException {
        try (input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[32768]; int n;
            while ((n = input.read(buffer)) != -1) { if (out.size() + n > maximum) throw new IOException("数据超出限制"); out.write(buffer, 0, n); }
            return out.toByteArray();
        }
    }
    static String sha256(File file) throws IOException {
        try (InputStream in = new FileInputStream(file)) { return sha256(in, Long.MAX_VALUE); }
    }
    static String sha256(InputStream input, long maximum) throws IOException {
        try { MessageDigest digest = MessageDigest.getInstance("SHA-256"); byte[] buffer = new byte[65536]; long total = 0; int n;
            while ((n = input.read(buffer)) != -1) { total += n; if (total > maximum) throw new IOException("数据超出限制"); digest.update(buffer, 0, n); }
            return hex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException e) { throw new IOException(e); }
    }
    static String hex(byte[] bytes) { StringBuilder s = new StringBuilder(bytes.length * 2); for (byte b : bytes) s.append(String.format(java.util.Locale.ROOT, "%02x", b & 255)); return s.toString(); }
    static boolean digest(String value) { return value != null && value.matches("[a-f0-9]{64}"); }
    static String readText(File file) throws IOException {return new String(readLimited(new FileInputStream(file),4*1024*1024),java.nio.charset.StandardCharsets.UTF_8);}
    static void writeText(File file,String value) throws IOException {try(FileOutputStream out=new FileOutputStream(file)){out.write(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));out.getFD().sync();}}
    static void atomicJson(File file, JSONObject value) throws IOException {
        File parent = file.getParentFile(); if (parent != null) parent.mkdirs();
        File temp = new File(file.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) { out.write(value.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8)); out.getFD().sync(); }
        Files.move(temp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
    static void delete(File file) throws IOException {
        if (file.isDirectory()&&!Files.isSymbolicLink(file.toPath())) { File[] files = file.listFiles(); if (files != null) for (File child : files) delete(child); }
        if (file.exists() && !file.delete()) throw new IOException("无法清理临时文件");
    }
}
