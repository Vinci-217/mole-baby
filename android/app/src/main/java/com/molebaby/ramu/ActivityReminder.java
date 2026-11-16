package com.molebaby.ramu;

import org.json.JSONObject;

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
}
