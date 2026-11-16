package com.molebaby.ramu;

import org.json.JSONObject;
import org.junit.Test;
import java.util.ArrayList;
import java.util.List;
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
    @Test public void coldSyncCancelsInheritedContinuousWorkAlarmAndDoesNotRepeat() throws Exception {
        var tracker=new ActivityReminder.Tracker();List<String> canceled=new ArrayList<>();List<ActivityReminder.Reminder> scheduled=new ArrayList<>();
        JSONObject work=activity("restaurant",true);tracker.sync(work,canceled::add,scheduled::add);
        assertEquals(List.of("activity:1700000000000:1700000100000"),canceled);assertTrue(scheduled.isEmpty());
        tracker.sync(work,canceled::add,scheduled::add);assertEquals(1,canceled.size());
    }
    @Test public void sameActivityIdWithChangedEndIsRescheduled() throws Exception {
        var tracker=new ActivityReminder.Tracker();List<String> canceled=new ArrayList<>();List<ActivityReminder.Reminder> scheduled=new ArrayList<>();
        JSONObject course=activity("course",null);tracker.sync(course,canceled::add,scheduled::add);
        course.put("endsAt",1700000400000L);tracker.sync(course,canceled::add,scheduled::add);
        assertEquals(2,scheduled.size());assertEquals(1700000400000L,scheduled.get(1).at());assertEquals(2,canceled.size());
    }
    @Test public void correctingFixedShiftToContinuousWithSameIdCancelsItsAlarm() throws Exception {
        var tracker=new ActivityReminder.Tracker();List<String> canceled=new ArrayList<>();List<ActivityReminder.Reminder> scheduled=new ArrayList<>();
        JSONObject work=activity("restaurant",false);tracker.sync(work,canceled::add,scheduled::add);
        work.put("continuous",true);tracker.sync(work,canceled::add,scheduled::add);
        assertEquals(1,scheduled.size());assertEquals(2,canceled.size());
    }
    @Test public void changingAndStoppingActivitiesCancelPreviousReminders() throws Exception {
        var tracker=new ActivityReminder.Tracker();List<String> canceled=new ArrayList<>();List<ActivityReminder.Reminder> scheduled=new ArrayList<>();
        tracker.sync(activity("course",null),canceled::add,scheduled::add);
        JSONObject next=activity("course",null).put("id","next");tracker.sync(next,canceled::add,scheduled::add);
        tracker.sync(null,canceled::add,scheduled::add);
        assertEquals(2,scheduled.size());assertEquals(List.of("activity:1700000000000:1700000100000","activity:1700000000000:1700000100000","activity:next","activity:next"),canceled);
    }
    @Test public void deliveryRejectsInheritedAndStaleAlarmsButAllowsCurrentCourse() throws Exception {
        JSONObject course=activity("course",null);String id="activity:1700000000000:1700000100000";
        assertTrue(ActivityReminder.isCurrent(course,id,1700000280000L));
        assertFalse(ActivityReminder.isCurrent(activity("restaurant",true),id,1700000280000L));
        assertFalse(ActivityReminder.isCurrent(null,id,1700000280000L));
        assertFalse(ActivityReminder.isCurrent(course,"activity:another",1700000280000L));
        assertFalse(ActivityReminder.isCurrent(course,id,1700000270000L));
    }
}
