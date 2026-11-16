package com.molebaby.ramu;

import org.json.JSONObject;
import java.util.Objects;
import java.util.function.Consumer;

/** Which end-of-activity notification, if any, the saved activity deserves.
 * Lessons end at endsAt. Continuous restaurant work keeps paying until the
 * player stops it, so its endsAt is not a finish time and gets no reminder. */
final class ActivityReminder {
    record Reminder(String id, long at, String title, String body) {}
    private ActivityReminder() {}
    static Reminder of(JSONObject active) {
        if (active == null) return null;
        String id = active.optString("id"), kind = active.optString("kind");
        long at = active.optLong("endsAt");
        if (id.isEmpty() || at <= 0) return null;
        if (kind.equals("course")) return new Reminder("activity:" + id, at, "拉姆下课啦", "回来看看新学会的本领吧！");
        if (kind.equals("restaurant") && !active.optBoolean("continuous")) return new Reminder("activity:" + id, at, "餐厅打工完成啦", "辛苦啦，回小屋领取打工收获吧！");
        return null;
    }
    static boolean isCurrent(JSONObject active,String id,long at) {
        Reminder reminder=of(active);
        return reminder!=null&&reminder.id().equals(id)&&reminder.at()==at;
    }
    /** Reconcile persisted alarms on first sync, then only when activity data changes. */
    static final class Tracker {
        private String activityId="";
        private Reminder reminder;
        void sync(JSONObject active,Consumer<String> cancel,Consumer<Reminder> schedule) {
            String nextId=active==null?"":active.optString("id");
            Reminder next=of(active);
            if(nextId.equals(activityId)&&Objects.equals(next,reminder))return;
            if(!activityId.isEmpty())cancel.accept("activity:"+activityId);
            if(!nextId.isEmpty()&&!nextId.equals(activityId))cancel.accept("activity:"+nextId);
            activityId=nextId;reminder=next;
            if(next!=null)schedule.accept(next);
        }
    }
}
