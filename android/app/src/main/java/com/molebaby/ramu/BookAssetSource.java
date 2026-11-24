package com.molebaby.ramu;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

/** WebView requests the same local URL used by the web build. Only the
 * published ZIPs listed in the signed APK's manifest can use this transport. */
final class BookAssetSource {
    static final String PREFIX = "/optional-books/";
    private static final String GITHUB = "https://github.com/Vinci-217/mole-baby/releases/download/";
    private static final long MAX_BOOK_BYTES = 32L * 1024 * 1024;
    record Book(String url, long size) {}

    static Map<String, Book> readIndex(JSONObject index) throws JSONException, IOException {
        String tag = index.getString("release");
        if (index.optInt("schema") != 1 || !tag.matches("assets-[a-f0-9]{24}"))
            throw new IOException("Invalid book resource release");
        Map<String, Book> books = new HashMap<>();
        JSONArray entries = index.getJSONArray("books");
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            String id = entry.getString("id");
            long bytes = entry.getLong("bytes");
            if (!id.matches("[a-z0-9-]+") || bytes < 1 || bytes > MAX_BOOK_BYTES)
                throw new IOException("Invalid book package");
            String name = "books-" + id + "-1.zip";
            if (books.put(PREFIX + tag + "/" + name, new Book(GITHUB + tag + "/" + name, bytes)) != null)
                throw new IOException("Duplicate book package");
        }
        return books;
    }

    static InputStream open(Book book) throws IOException {
        return UpdateTransport.source(book.url(), book.size()).open(0, book.size(), false);
    }
}
