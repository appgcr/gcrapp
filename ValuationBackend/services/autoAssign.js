// Who should take a new case: the nearest engineer on duty with the fewest open cases.

const User = require('../models/User');
const ValuationCase = require('../models/ValuationCase');
const LiveLocation = require('../models/LiveLocation');
const Attendance = require('../models/Attendance');
const { caseSpot, km } = require('./rateGuide');

const FRESH_MS = 3 * 3600 * 1000; // a phone position older than 3 hours is not used

async function suggestEngineers(c) {
  const q = { role: 'ENGINEER', status: { $ne: 'Inactive' } };
  if (c.branchId) q.branchId = c.branchId;
  const engineers = await User.find(q).select('id username name branchId').lean();
  if (!engineers.length) return { spot: null, list: [] };
  const ids = engineers.map((e) => e.id);
  const [spot, live, open, dayStart] = await Promise.all([
    caseSpot(c, null).catch(() => null),
    LiveLocation.find({ userId: { $in: ids } }).lean(),
    ValuationCase.find({ status: { $in: ['Pending', 'Returned'] }, assignedEngineerId: { $in: [...ids, ...engineers.map((e) => e.username)] } }).select('assignedEngineerId').lean(),
    Promise.resolve((() => { const d = new Date(Date.now() + 330 * 60000); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 330 * 60000); })()),
  ]);
  const lastPunch = await Attendance.aggregate([
    { $match: { userId: { $in: ids }, timestamp: { $gte: dayStart }, attendanceType: { $in: ['Clock-In', 'Clock-Out'] } } },
    { $sort: { timestamp: -1 } },
    { $group: { _id: '$userId', type: { $first: '$attendanceType' } } },
  ]);
  const duty = new Map(lastPunch.map((p) => [p._id, p.type === 'Clock-In']));
  const liveBy = new Map(live.map((l) => [l.userId, l]));
  const list = engineers.map((e) => {
    const openCount = open.filter((o) => o.assignedEngineerId === e.id || o.assignedEngineerId === e.username).length;
    const l = liveBy.get(e.id);
    const fresh = l && Number.isFinite(l.lat) && l.at && Date.now() - new Date(l.at).getTime() < FRESH_MS && !l.off;
    const distanceKm = spot && fresh ? Math.round(km(spot, l) * 10) / 10 : null;
    const onDuty = !!duty.get(e.id);
    // Lower is better: each open case counts like 3 km; off duty / unknown location are pushed down
    const score = (distanceKm ?? 25) + openCount * 3 + (onDuty ? 0 : 15);
    const why = [
      distanceKm != null ? `${distanceKm} km away` : 'location not known',
      `${openCount} open case${openCount === 1 ? '' : 's'}`,
      onDuty ? 'on duty' : 'not checked in',
    ].join(' · ');
    return { id: e.id, name: e.name || e.username, distanceKm, openCases: openCount, onDuty, score: Math.round(score * 10) / 10, why };
  }).sort((a, b) => a.score - b.score);
  return { spot, list };
}

module.exports = { suggestEngineers };
