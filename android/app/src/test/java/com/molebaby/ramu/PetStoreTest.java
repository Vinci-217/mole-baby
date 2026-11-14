package com.molebaby.ramu;

import android.app.Application;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(manifest=Config.NONE,application=Application.class,sdk=35)
public final class PetStoreTest {
    @Test public void explicitDeletionSurvivesAHostRestartAndNewSaveClearsTheMarker() throws Exception {
        PetStore store=new PetStore(RuntimeEnvironment.getApplication());
        assertTrue(store.put(PetStore.SAVE,"original pet"));
        assertEquals("original pet",store.snapshot().getString(PetStore.SAVE));
        assertEquals(0,store.deletedKeys().length());
        assertTrue(store.put(PetStore.SAVE,null));
        PetStore reopened=new PetStore(RuntimeEnvironment.getApplication());
        assertFalse(reopened.snapshot().has(PetStore.SAVE));
        assertEquals(PetStore.SAVE,reopened.deletedKeys().getString(0));
        assertTrue(reopened.put(PetStore.SAVE,"explicit new adoption"));
        assertEquals(0,reopened.deletedKeys().length());
        assertEquals("explicit new adoption",reopened.snapshot().getString(PetStore.SAVE));
    }
    @Test public void readingAndFlushingNeverRemoveThePetOrItsMemories() throws Exception {
        PetStore store=new PetStore(RuntimeEnvironment.getApplication());
        assertTrue(store.put(PetStore.SAVE,"growth and original colour"));
        assertTrue(store.put("ramu-companion-memory-v1:1","old memories"));
        assertTrue(store.flush());
        PetStore reopened=new PetStore(RuntimeEnvironment.getApplication());
        assertEquals("growth and original colour",reopened.snapshot().getString(PetStore.SAVE));
        assertEquals("old memories",reopened.snapshot().getString("ramu-companion-memory-v1:1"));
        assertEquals(0,reopened.deletedKeys().length());
    }
}
