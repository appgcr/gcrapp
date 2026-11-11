// GCR attendance register — one shared calculation for the Excel (.xlsx) and PDF exports.
//
// Register = one row per engineer per day in the period (absent days included):
//   Date · Day · Engineer · ID · Check-in (first) · Check-out (last) · Hours · Status · Late · Face verified · Places
// Status rules:
//   Present      checked in and out
//   On duty      today, checked in, not yet out
//   Incomplete   a past day with a check-in but no check-out
//   Absent       no check-in on a working day
//   Weekly off   Sunday with no check-in
// Late = first check-in after LATE_AFTER (local time).

import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

export const LATE_AFTER = { h: 10, m: 0 }; // 10:00 AM
const COMPANY = 'GCR Valuation';

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dayStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const fmtHours = (h) => {
  if (!h) return '0h';
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins ? `${hrs}h ${mins}m` : `${hrs}h`;
};
const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-'); // 09-Nov-2026 (never ambiguous)
const fmtDay = (d) => d.toLocaleDateString('en-IN', { weekday: 'short' });
const fmtClock = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase();
const shortPlace = (r) => (r?.address ? r.address.split(',').slice(0, 2).join(',').trim() : (r?.lat && r?.lng ? `${Number(r.lat).toFixed(4)}, ${Number(r.lng).toFixed(4)}` : ''));

/**
 * @param people  [{ id, name, ...}] engineers to include
 * @param records Clock-In / Clock-Out records (all engineers)
 * @param range   { start: Date (inclusive, local midnight), end: Date (exclusive) }
 */
export function buildRegister(people, records, range) {
  const today = dayStart(new Date());
  const lastDay = addDays(range.end, -1) > today ? today : addDays(range.end, -1); // never future days
  const days = [];
  for (let d = dayStart(range.start); d <= lastDay; d = addDays(d, 1)) days.push(new Date(d));

  const rows = [];
  const summary = [];
  people.forEach((p) => {
    const mine = records
      .filter((r) => r.userId === p.id && (r.attendanceType === 'Clock-In' || r.attendanceType === 'Clock-Out'))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const byDay = new Map();
    mine.forEach((r) => {
      const k = ymd(new Date(r.timestamp));
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    });

    const s = { name: p.name, id: p.id, present: 0, absent: 0, off: 0, incomplete: 0, late: 0, hours: 0, inMinutes: [] };
    days.forEach((d) => {
      const evts = byDay.get(ymd(d)) || [];
      const ins = evts.filter((r) => r.attendanceType === 'Clock-In');
      const outs = evts.filter((r) => r.attendanceType === 'Clock-Out');
      const firstIn = ins[0];
      const lastOut = outs[outs.length - 1];
      const isToday = ymd(d) === ymd(today);
      const isSunday = d.getDay() === 0;

      // Hours: server-calculated per check-out; fall back to first-in → last-out
      let hours = outs.reduce((t, r) => t + (Number(r.workDurationHours) || 0), 0);
      if (!hours && firstIn && lastOut && new Date(lastOut.timestamp) > new Date(firstIn.timestamp)) {
        hours = (new Date(lastOut.timestamp) - new Date(firstIn.timestamp)) / 3600000;
      }
      hours = Math.round(hours * 100) / 100;

      let status;
      if (!firstIn) status = isSunday ? 'Weekly off' : 'Absent';
      else if (!lastOut || new Date(lastOut.timestamp) < new Date(firstIn.timestamp)) status = isToday ? 'On duty' : 'Incomplete';
      else status = 'Present';

      let late = false;
      if (firstIn) {
        const t = new Date(firstIn.timestamp);
        const mins = t.getHours() * 60 + t.getMinutes();
        late = mins > LATE_AFTER.h * 60 + LATE_AFTER.m;
        s.inMinutes.push(mins);
      }

      if (status === 'Present' || status === 'On duty') s.present += 1;
      if (status === 'Incomplete') { s.present += 1; s.incomplete += 1; }
      if (status === 'Absent') s.absent += 1;
      if (status === 'Weekly off') s.off += 1;
      if (late) s.late += 1;
      s.hours += hours;

      rows.push({
        date: d,
        dateText: fmtDate(d),
        day: fmtDay(d),
        name: p.name,
        id: p.id,
        checkIn: firstIn ? fmtClock(new Date(firstIn.timestamp)) : '',
        checkOut: lastOut && status !== 'Incomplete' && status !== 'On duty' ? fmtClock(new Date(lastOut.timestamp)) : '',
        hours,
        hoursText: hours ? fmtHours(hours) : '',
        status,
        late: late ? 'Late' : '',
        face: firstIn ? (ins.some((r) => r.faceVerified) ? 'Yes' : 'No') : '',
        inPlace: shortPlace(firstIn),
        outPlace: status === 'Present' ? shortPlace(lastOut) : '',
        sessions: ins.length,
      });
    });

    const avg = s.inMinutes.length ? Math.round(s.inMinutes.reduce((a, b) => a + b, 0) / s.inMinutes.length) : null;
    summary.push({
      ...s,
      hours: Math.round(s.hours * 100) / 100,
      hoursText: fmtHours(s.hours),
      workingDays: days.length - s.off,
      avgIn: avg === null ? '' : fmtClock(new Date(2000, 0, 1, Math.floor(avg / 60), avg % 60)),
    });
  });

  rows.sort((a, b) => a.date - b.date || a.name.localeCompare(b.name));
  return { rows, summary, days, from: days[0] || dayStart(range.start), to: lastDay };
}

const periodLabel = (reg) => `${fmtDate(reg.from)} to ${fmtDate(reg.to)}`;
const generatedLabel = () => `Generated ${fmtDate(new Date())} ${fmtClock(new Date())}`;

const STATUS_FILL = {
  Present: 'FFDCF5E3', 'On duty': 'FFDCEBFF', Incomplete: 'FFFFF4CC', Absent: 'FFFDE2E1', 'Weekly off': 'FFF0F0F2',
};
const STATUS_FONT = {
  Present: 'FF1E7B34', 'On duty': 'FF0055CC', Incomplete: 'FF8A6100', Absent: 'FFC0201A', 'Weekly off': 'FF6B6B70',
};

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Real Excel workbook: "Summary" + "Daily Register" sheets with styling. */
export async function exportRegisterXlsx(reg, { title, filename }) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = COMPANY;
  wb.created = new Date();

  const titleBlock = (ws, cols, sheetTitle) => {
    ws.mergeCells(1, 1, 1, cols);
    ws.getCell(1, 1).value = `${COMPANY} — ${sheetTitle}`;
    ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: 'FF0B1B3F' } };
    ws.mergeCells(2, 1, 2, cols);
    ws.getCell(2, 1).value = `${title} · ${periodLabel(reg)}`;
    ws.getCell(2, 1).font = { size: 11, color: { argb: 'FF555555' } };
    ws.mergeCells(3, 1, 3, cols);
    ws.getCell(3, 1).value = `${generatedLabel()} · Late = first check-in after ${pad(LATE_AFTER.h)}:${pad(LATE_AFTER.m)} · Sundays = weekly off`;
    ws.getCell(3, 1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
  };
  const headerRow = (ws, rowNo, headers) => {
    const row = ws.getRow(rowNo);
    headers.forEach((h, i) => {
      const c = row.getCell(i + 1);
      c.value = h;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF007AFF' } };
      c.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: 'FF0055CC' } } };
    });
    row.height = 22;
  };
  const thin = { style: 'thin', color: { argb: 'FFE3E3E8' } };

  // ---- Summary ----
  const sum = wb.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 5 }] });
  const sumHeaders = ['Engineer', 'ID', 'Working days', 'Days present', 'Days absent', 'Weekly off', 'Total hours', 'Avg check-in', 'Late days', 'Missing check-out'];
  titleBlock(sum, sumHeaders.length, 'Attendance Summary');
  headerRow(sum, 5, sumHeaders);
  reg.summary.forEach((s, i) => {
    const r = sum.getRow(6 + i);
    r.values = [s.name, s.id, s.workingDays, s.present, s.absent, s.off, s.hours, s.avgIn || '—', s.late, s.incomplete];
    r.getCell(7).numFmt = '0.00" h"';
    if (s.absent) r.getCell(5).font = { color: { argb: 'FFC0201A' }, bold: true };
    if (s.late) r.getCell(9).font = { color: { argb: 'FFB25E00' }, bold: true };
    if (s.incomplete) r.getCell(10).font = { color: { argb: 'FF8A6100' }, bold: true };
    r.eachCell((c) => { c.border = { bottom: thin }; });
  });
  sum.columns.forEach((col, i) => { col.width = [26, 12, 14, 14, 13, 12, 13, 14, 11, 18][i]; });

  // ---- Daily register ----
  const reg2 = wb.addWorksheet('Daily Register', { views: [{ state: 'frozen', ySplit: 5, xSplit: 3 }] });
  const regHeaders = ['Date', 'Day', 'Engineer', 'ID', 'Check-in', 'Check-out', 'Hours', 'Status', 'Late', 'Face verified', 'Check-in place', 'Check-out place'];
  titleBlock(reg2, regHeaders.length, 'Daily Attendance Register');
  headerRow(reg2, 5, regHeaders);
  reg.rows.forEach((x, i) => {
    const r = reg2.getRow(6 + i);
    // Excel stores dates as UTC: pass the calendar day itself so India time never shifts it to the previous day
    const excelDate = new Date(Date.UTC(x.date.getFullYear(), x.date.getMonth(), x.date.getDate()));
    r.values = [excelDate, x.day, x.name, x.id, x.checkIn || '—', x.checkOut || '—', x.hours || 0, x.status, x.late, x.face || '—', x.inPlace || '—', x.outPlace || '—'];
    r.getCell(1).numFmt = 'dd-mmm-yyyy';
    r.getCell(7).numFmt = '0.00" h"';
    const st = r.getCell(8);
    st.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[x.status] } };
    st.font = { bold: true, color: { argb: STATUS_FONT[x.status] } };
    if (x.late) r.getCell(9).font = { bold: true, color: { argb: 'FFB25E00' } };
    if (x.status === 'Weekly off') r.eachCell((c, n) => { if (n !== 8) c.font = { color: { argb: 'FF9A9AA0' } }; });
    r.eachCell((c) => { c.border = { bottom: thin }; c.alignment = { vertical: 'middle' }; });
  });
  reg2.columns.forEach((col, i) => { col.width = [13, 6, 24, 11, 11, 11, 9, 12, 7, 13, 28, 28][i]; });
  reg2.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + reg.rows.length, column: regHeaders.length } };

  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${filename}.xlsx`);
  return buf;
}

/** PDF with the same summary + per-day register. */
export function exportRegisterPdf(reg, { title, filename }) {
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(15); doc.setTextColor(11, 27, 63);
  doc.text(`${COMPANY} — ${title}`, 14, 16);
  doc.setFontSize(9.5); doc.setTextColor(110);
  doc.text(`${periodLabel(reg)} · ${generatedLabel()} · Late = first check-in after ${pad(LATE_AFTER.h)}:${pad(LATE_AFTER.m)} · Sundays = weekly off`, 14, 23);

  doc.autoTable({
    startY: 28,
    head: [['Engineer', 'ID', 'Working days', 'Present', 'Absent', 'Total hours', 'Avg check-in', 'Late', 'Missing check-out']],
    body: reg.summary.map((s) => [s.name, s.id, s.workingDays, s.present, s.absent, s.hoursText, s.avgIn || '—', s.late, s.incomplete]),
    theme: 'grid', headStyles: { fillColor: [0, 122, 255] }, styles: { fontSize: 8.5 },
  });

  const colors = { Present: [30, 123, 52], 'On duty': [0, 85, 204], Incomplete: [138, 97, 0], Absent: [192, 32, 26], 'Weekly off': [140, 140, 145] };
  doc.autoTable({
    startY: (doc.lastAutoTable.finalY || 28) + 8,
    head: [['Date', 'Day', 'Engineer', 'Check-in', 'Check-out', 'Hours', 'Status', 'Late', 'Face', 'Check-in place', 'Check-out place']],
    body: reg.rows.map((x) => [x.dateText, x.day, x.name, x.checkIn || '—', x.checkOut || '—', x.hoursText || '—', x.status, x.late, x.face || '—', x.inPlace || '—', x.outPlace || '—']),
    theme: 'striped', headStyles: { fillColor: [60, 60, 67] }, styles: { fontSize: 7.5, cellPadding: 1.6 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        data.cell.styles.textColor = colors[data.cell.raw] || [0, 0, 0];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 7 && data.cell.raw) {
        data.cell.styles.textColor = [178, 94, 0];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
  doc.setFontSize(8); doc.setTextColor(150);
  doc.text(`${COMPANY} · for admin use only`, 14, doc.internal.pageSize.getHeight() - 8);
  doc.save(`${filename}.pdf`);
}
