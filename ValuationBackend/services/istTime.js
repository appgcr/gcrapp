/**
 * India Standard Time helpers (Asia/Kolkata, UTC+5:30, no daylight saving).
 * Independent of the server's own timezone, so behaviour is the same on any host.
 */

const TZ = 'Asia/Kolkata';
const IST_OFFSET_MIN = 330;

function istParts(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return { ymd: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute), weekday: p.weekday };
}

const toMinutes = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const fmt12 = (mins) => {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};

// A real Date for an IST calendar day + minutes after midnight
function istDate(ymd, minutes = 0) {
  const [y, mo, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0) + (minutes - IST_OFFSET_MIN) * 60000);
}

const addDaysYMD = (ymd, n) => istParts(new Date(istDate(ymd, 12 * 60).getTime() + n * 86400000)).ymd;

// Is `minutes` inside a window that may wrap past midnight (e.g. 19:00 → 09:00)?
function inWindow(minutes, startMin, endMin) {
  if (startMin === null || endMin === null || startMin === endMin) return false;
  return startMin < endMin ? minutes >= startMin && minutes < endMin : minutes >= startMin || minutes < endMin;
}

// Next moment (Date) when the clock reaches endMin, strictly after `now`
function nextOccurrence(now, endMin) {
  const ist = istParts(now);
  const today = istDate(ist.ymd, endMin);
  return today > now ? today : istDate(addDaysYMD(ist.ymd, 1), endMin);
}

module.exports = { TZ, IST_OFFSET_MIN, istParts, toMinutes, fmt12, istDate, addDaysYMD, inWindow, nextOccurrence };
