/**
 * Alert categories people can switch on/off for themselves (Settings → Notifications).
 * Each notification `type` belongs to one category. "Required" categories are always on,
 * because missing them would stop work (e.g. a new case assigned, a report sent back).
 */

const CATEGORIES = [
  // ---- Engineers ----
  { key: 'case_assigned', role: 'ENGINEER', required: true, label: 'New case assigned', description: 'When a case is given to you', types: ['case_assigned'] },
  { key: 'report_feedback', role: 'ENGINEER', required: true, label: 'Report returned or rejected', description: 'When the admin sends a report back for corrections', types: ['report_returned', 'report_rejected'] },
  { key: 'report_approved', role: 'ENGINEER', required: false, label: 'Report approved', description: 'When your report is approved', types: ['report_approved'] },
  { key: 'inspection_reminder', role: 'ENGINEER', required: false, label: 'Site visit reminders', description: 'When a new case still needs a visit planned', types: ['inspection_reminder', 'visit_nudge'] },
  { key: 'attendance_reminders', role: 'ENGINEER', required: false, label: 'Check-in / check-out reminders', description: "If you haven't checked in, or are still checked in at day end", types: ['checkin_reminder', 'checkout_reminder'] },

  // ---- Admins ----
  { key: 'report_submitted', role: 'SUPER_ADMIN', required: false, label: 'Reports ready for review', description: 'When an engineer submits or resubmits a report', types: ['report_submitted'] },
  { key: 'case_created', role: 'SUPER_ADMIN', required: false, label: 'New case requests', description: 'When a new case is created', types: ['case_created'] },
  { key: 'report_delivery', role: 'SUPER_ADMIN', required: false, label: 'Report sent to bank', description: 'When an approved report still has to be sent, or the email failed', types: ['report_delivery'] },
  { key: 'evening_summary', role: 'SUPER_ADMIN', required: false, label: 'Evening summary', description: "Today's work and stuck cases at 7:30 PM", types: ['evening_summary'] },
  { key: 'invoice_overdue', role: 'SUPER_ADMIN', required: false, label: 'Unpaid invoices', description: 'A daily list of overdue fees to send reminders', types: ['invoice_overdue'] },
  { key: 'overdue', role: 'SUPER_ADMIN', required: false, label: 'Overdue cases', description: 'Cases waiting too long for a valuer or a review', types: ['overdue_unassigned', 'overdue_review'] },

  // ---- Everyone ----
  { key: 'report_ready', role: 'BANK', required: true, label: 'Report ready', description: 'When your valuation report is approved', types: ['report_ready'] },
  { key: 'invoice_due', role: 'BANK', required: true, label: 'Payment reminders', description: 'When a valuation fee is due or overdue', types: ['invoice_due'] },
  { key: 'morning_digest', role: 'ALL', required: false, label: 'Morning summary', description: 'One summary at the start of your day', types: ['morning_digest'] },
  { key: 'announcement', role: 'ALL', required: true, label: 'Announcements', description: 'Messages from the admin to all staff', types: ['announcement'] },
];

const TYPE_TO_CATEGORY = new Map();
CATEGORIES.forEach((c) => c.types.forEach((t) => TYPE_TO_CATEGORY.set(t, c)));

const categoriesForRole = (role) => CATEGORIES.filter((c) => c.role === 'ALL' || c.role === role);

// Prefs are stored as a Map/object { categoryKey: false } — anything missing means ON.
function prefValue(prefs, key) {
  if (!prefs) return true;
  const v = typeof prefs.get === 'function' ? prefs.get(key) : prefs[key];
  return v !== false;
}

/** Should this person's phone be notified for this alert type? (in-app bell always keeps it) */
function allowsPush(user, type) {
  const cat = TYPE_TO_CATEGORY.get(type);
  if (!cat || cat.required) return true;
  return prefValue(user?.notificationPrefs, cat.key);
}

module.exports = { CATEGORIES, TYPE_TO_CATEGORY, categoriesForRole, prefValue, allowsPush };
