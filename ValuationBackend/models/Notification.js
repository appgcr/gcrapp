const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  targetUser: { type: String, required: true }, // 'ADMIN' or the employee ID/username
  branchId: { type: String, default: null }, // for 'ADMIN' alerts: which branch's admins see it
  title: { type: String, required: true },
  message: { type: String, required: true },
  caseId: { type: String, default: '' },          // opens this case when tapped
  type: { type: String, default: 'general' },     // e.g. case_assigned, report_submitted
  // Smart timing: urgent = push now; normal = push now, or held during quiet hours;
  // digest = morning summary (sent at the person's usual start time)
  priority: { type: String, enum: ['urgent', 'normal', 'digest'], default: 'normal' },
  pushStatus: { type: String, enum: ['pending', 'sent', 'held', 'bundled', 'none', 'muted'], default: 'pending' },
  deliverAfter: { type: Date, default: null },   // when a held push may be released
  pushedAt: { type: Date, default: null },
  // Engagement tracking
  readAt: { type: Date, default: null },        // seen / tapped inside the app (bell)
  openedAt: { type: Date, default: null },      // opened by tapping the phone notification
  mutedFor: { type: [String], default: [] },    // user ids who switched this alert type off
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ pushStatus: 1, deliverAfter: 1 });
notificationSchema.index({ createdAt: -1, type: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
