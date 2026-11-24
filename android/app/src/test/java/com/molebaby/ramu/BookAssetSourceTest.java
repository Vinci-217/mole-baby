package com.molebaby.ramu;

import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import java.io.IOException;
import java.util.Map;
import static org.junit.Assert.*;

public class BookAssetSourceTest {
    private static final String TAG = "assets-" + "b".repeat(24);

    private JSONObject index(String id, long size) throws Exception {
        return new JSONObject().put("schema", 1).put("release", TAG).put("books",
                new JSONArray().put(new JSONObject().put("id", id).put("bytes", size)));
    }

    @Test public void onlyKnownSameOriginPathsCanResolveToGitHub() throws Exception {
        Map<String, BookAssetSource.Book> books = BookAssetSource.readIndex(index("home", 500));
        BookAssetSource.Book home = books.get("/optional-books/" + TAG + "/books-home-1.zip");
        assertNotNull(home);
        assertEquals(500, home.size());
        assertTrue(UpdateTransport.releaseUrl(home.url()));
        assertNull(books.get("/optional-books/" + TAG + "/books-other-1.zip"));
        assertNull(books.get("/releases/download/" + TAG + "/books-home-1.zip"));
    }

    @Test public void invalidAssetNamesAndSizesAreRejected() throws Exception {
        assertThrows(IOException.class, () -> BookAssetSource.readIndex(index("../main", 500)));
        assertThrows(IOException.class, () -> BookAssetSource.readIndex(index("home", 33L * 1024 * 1024)));
        assertThrows(IOException.class, () -> BookAssetSource.readIndex(index("home", 500).put("release", "https://example.org/")));
    }
}
