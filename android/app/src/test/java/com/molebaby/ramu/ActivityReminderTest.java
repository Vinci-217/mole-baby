package com.molebaby.ramu;

import org.json.JSONObject;
import org.junit.Test;
import static org.junit.Assert.*;

public final class ActivityReminderTest {
    private static JSONObject activity(String kind, Boolean continuous) throws Exception {
        JSONObject value = new JSONObject().put("id", "1700000000000:1700000100000").put("kind", kind)
            .put("startedAt", 1700000100000L).put("endsAt", 1700000280000L);
        if (continuous != null) value.put("continuous", continuous);
        return value;
    }
    @Test public void lessonsRemindAtTheirEnd() throws Exception {
        ActivityReminder.Reminder reminder = ActivityReminder.of(activity("course", null));
        assertNotNull(reminder);
        assertEquals("activity:1700000000000:1700000100000", reminder.id());
        assertEquals(1700000280000L, reminder.at());
        assertEquals("拉姆下课啦", reminder.title());
    }
    @Test public void continuousRestaurantWorkNeverClaimsToHaveFinished() throws Exception {
        assertNull(ActivityReminder.of(activity("restaurant", true)));
    }
    @Test public void fixedLengthRestaurantShiftsStillRemind() throws Exception {
        ActivityReminder.Reminder reminder = ActivityReminder.of(activity("restaurant", false));
        assertNotNull(reminder);
        assertEquals("餐厅打工完成啦", reminder.title());
    }
    @Test public void missingOrIncompleteActivitiesHaveNoReminder() throws Exception {
        assertNull(ActivityReminder.of(null));
        assertNull(ActivityReminder.of(new JSONObject().put("kind", "course").put("endsAt", 1L)));
        assertNull(ActivityReminder.of(new JSONObject().put("id", "x").put("kind", "course")));
        assertNull(ActivityReminder.of(activity("outing", null)));
    }
}
