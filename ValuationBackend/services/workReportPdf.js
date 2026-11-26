// The daily / weekly performance report as a polished A4 PDF (same look as the invoices): navy header with the
// Gouru logo, a gold strip with whose report it is, six number cards, an attendance bar, and the branch /
// engineer tables. Built from services/workReports.js → workReport(period, ymd, scope).
const fs = require('fs');
const path = require('path');

const LOGO = path.join(__dirname, '..', 'assets', 'gouru_logo.png');
const ascii = (s) => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '|').replace(/[^\x20-\x7E\n]/g, '');
const hrs = (h) => { const m = Math.round((h || 0) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };

async function workReportPdf(r, { firmName = 'Gouru Valuations', scopeName = '', generatedFor = '' } = {}) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setTitle(`${r.period === 'week' ? 'Weekly' : 'Daily'} performance report - ${r.label}`);
  doc.setAuthor(firmName);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const C = {
    navy: rgb(0.06, 0.16, 0.36), navy2: rgb(0.11, 0.25, 0.52), ink: rgb(0.06, 0.09, 0.16), grey: rgb(0.42, 0.46, 0.53),
    line: rgb(0.88, 0.9, 0.94), soft: rgb(0.965, 0.972, 0.985), white: rgb(1, 1, 1),
    gold: rgb(0.96, 0.78, 0.3), goldBg: rgb(1, 0.97, 0.86), goldInk: rgb(0.47, 0.25, 0.02),
    green: rgb(0.09, 0.5, 0.24), amber: rgb(0.85, 0.47, 0.02), red: rgb(0.76, 0.17, 0.12), blue: rgb(0.15, 0.39, 0.92), violet: rgb(0.4, 0.3, 0.85),
  };
  const W = 595; const H = 842; const M = 40;
  let page = doc.addPage([W, H]);
  let pageNo = 1;
  const text = (s, x, y, o = {}) => page.drawText(ascii(s), { x, y, size: o.size || 10, font: o.f || font, color: o.color || C.ink });
  const width = (s, size = 10, f = font) => f.widthOfTextAtSize(ascii(s), size);
  const right = (s, xr, y, o = {}) => text(s, xr - width(s, o.size || 10, o.f || font), y, o);
  const center = (s, xc, y, o = {}) => text(s, xc - width(s, o.size || 10, o.f || font) / 2, y, o);
  const rect = (x, y, w, h, o) => page.drawRectangle({ x, y, width: w, height: h, ...o });

  const header = async () => {
    rect(0, H - 96, W, 96, { color: C.navy });
    rect(0, H - 100, W, 4, { color: C.gold });
    let lx = M;
    try {
      const logo = await doc.embedPng(fs.readFileSync(LOGO));
      rect(M - 3, H - 77, 54, 54, { color: C.white });
      page.drawImage(logo, { x: M, y: H - 74, width: 48, height: 48 });
      lx = M + 64;
    } catch { /* name only */ }
    text(firmName, lx, H - 44, { f: bold, size: 19, color: C.white });
    text('Performance Report', lx, H - 62, { size: 10.5, color: rgb(0.78, 0.84, 0.95) });
    right(r.period === 'week' ? 'WEEKLY REPORT' : 'DAILY REPORT', W - M, H - 42, { f: bold, size: 13, color: C.gold });
    right(r.label, W - M, H - 60, { size: 10.5, color: C.white });
  };
  const footer = () => {
    page.drawLine({ start: { x: M, y: 46 }, end: { x: W - M, y: 46 }, thickness: 0.6, color: C.gold });
    const at = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    text(`Generated automatically by ${firmName} on ${at} (India time)${generatedFor ? ` for ${generatedFor}` : ''}`, M, 32, { size: 8, color: C.grey });
    right(`Page ${pageNo}`, W - M, 32, { size: 8, color: C.grey });
  };
  await header();
  let y = H - 130;
  const room = async (need) => {
    if (y - need > 70) return;
    footer();
    page = doc.addPage([W, H]); pageNo += 1;
    await header();
    y = H - 130;
  };

  // Whose report it is — gold strip
  const isEng = r.kind === 'engineer';
  const who = isEng ? (r.engineer && r.engineer.name) || 'Engineer' : r.kind === 'branch' ? `${(r.branch && r.branch.name) || scopeName || 'Branch'} Branch` : 'All Branches';
  const sub = isEng ? `Engineer${scopeName ? ` | ${scopeName} Branch` : ''}` : r.kind === 'branch' ? 'Branch performance' : 'Whole office - every branch and engineer';
  rect(M, y - 34, W - 2 * M, 46, { color: C.goldBg, borderColor: C.gold, borderWidth: 0.9 });
  text(who, M + 14, y - 6, { f: bold, size: 15, color: C.goldInk });
  text(sub, M + 14, y - 23, { size: 9.5, color: rgb(0.55, 0.36, 0.06) });
  right(r.period === 'week' ? 'Week' : 'Day', W - M - 14, y - 6, { f: bold, size: 10, color: C.goldInk });
  right(r.label, W - M - 14, y - 23, { size: 9.5, color: rgb(0.55, 0.36, 0.06) });
  y -= 62;

  // Six number cards
  const t = isEng ? null : r.totals;
  const e = isEng ? r.engineer : null;
  const cards = isEng ? [
    [r.period === 'week' ? `${e.daysPresent}` : (e.daysPresent ? hrs(e.hours) : '-'), r.period === 'week' ? `Days present (${hrs(e.hours)})` : (e.daysPresent ? `On duty${e.firstIn ? ` (in ${e.firstIn})` : ''}` : 'Not checked in'), C.blue],
    [e.siteVisits, 'Site visits', C.green], [e.submitted, 'Reports submitted', C.violet],
    [e.approved, 'Approved', C.green], [e.returned, 'Returned to fix', e.returned ? C.red : C.grey], [e.openNow, 'Open cases now', C.amber],
  ] : [
    [`${t.present}/${t.engineers}`, r.period === 'week' ? 'Engineers who worked' : 'Engineers present', C.blue],
    [t.siteVisits, 'Site visits', C.green], [t.submitted, 'Reports submitted', C.violet],
    [t.approved, 'Approved', C.green], [t.waitingReview, 'Waiting review', C.amber], [t.unassigned, 'Not assigned', t.unassigned ? C.red : C.grey],
  ];
  const cw = (W - 2 * M - 2 * 12) / 3; const ch = 62;
  cards.forEach(([v, label, color], i) => {
    const x = M + (i % 3) * (cw + 12); const top = y - Math.floor(i / 3) * (ch + 12);
    rect(x, top - ch, cw, ch, { color: C.soft, borderColor: C.line, borderWidth: 0.7 });
    rect(x, top - ch, 4, ch, { color });
    text(String(v), x + 16, top - 30, { f: bold, size: 22, color: C.ink });
    text(label, x + 16, top - 48, { size: 9, color: C.grey });
  });
  y -= 2 * ch + 12 + 22;

  // Attendance bar + one-line highlights
  if (!isEng) {
    const pct = t.engineers ? Math.round((t.present / t.engineers) * 100) : 0;
    text(r.period === 'week' ? 'Attendance this week' : 'Attendance today', M, y, { f: bold, size: 10 });
    right(`${pct}%`, W - M, y, { f: bold, size: 10, color: pct >= 80 ? C.green : pct >= 50 ? C.amber : C.red });
    y -= 12;
    rect(M, y - 8, W - 2 * M, 8, { color: C.line });
    if (pct) rect(M, y - 8, ((W - 2 * M) * pct) / 100, 8, { color: pct >= 80 ? C.green : pct >= 50 ? C.amber : C.red });
    y -= 24;
    text(`${t.newCases} new case${t.newCases === 1 ? '' : 's'}  |  ${t.returned} returned to fix  |  ${hrs(t.hours)} on duty in all  |  ${t.open} open`, M, y, { size: 9.5, color: C.grey });
    y -= 26;
  } else {
    const bits = [e.firstIn && `First check-in ${e.firstIn}`, e.lastOut && `Last check-out ${e.lastOut}`, e.onDutyNow && 'On duty now', e.missedCheckOut && 'Forgot to check out'].filter(Boolean);
    if (bits.length) { text(bits.join('  |  '), M, y, { size: 9.5, color: e.missedCheckOut ? C.red : C.grey }); y -= 24; }
  }

  // Tables
  const table = async (title, cols, rows) => {
    await room(60);
    text(title.toUpperCase(), M, y, { f: bold, size: 9.5, color: C.navy2 });
    y -= 8;
    const head = async () => {
      rect(M, y - 20, W - 2 * M, 20, { color: C.navy });
      let x = M + 8;
      cols.forEach(([h, w, al]) => { if (al === 'r') right(h, x + w - 8, y - 14, { f: bold, size: 8.5, color: C.white }); else text(h, x, y - 14, { f: bold, size: 8.5, color: C.white }); x += w; });
      y -= 20;
    };
    await head();
    for (let i = 0; i < rows.length; i++) {
      if (y - 20 < 70) { await room(200); await head(); }
      if (i % 2) rect(M, y - 20, W - 2 * M, 20, { color: C.soft });
      let x = M + 8;
      rows[i].forEach((cell, k) => {
        const [, w, al] = cols[k]; const o = { size: 9, ...(cell && typeof cell === 'object' ? cell.o : {}) };
        const s = cell && typeof cell === 'object' ? cell.v : cell;
        if (al === 'r') right(String(s), x + w - 8, y - 14, o); else text(String(s).slice(0, 34), x, y - 14, o);
        x += w;
      });
      y -= 20;
    }
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: C.line });
    y -= 24;
  };
  if (Array.isArray(r.branches) && r.branches.length) {
    await table('Branches', [['Branch', 155], ['Present', 62, 'r'], ['Visits', 58, 'r'], ['Reports', 62, 'r'], ['Approved', 70, 'r'], ['Review', 52, 'r'], ['Open', 46, 'r']],
      r.branches.map((b) => [{ v: b.name, o: { f: bold } }, `${b.totals.present}/${b.totals.engineers}`, b.totals.siteVisits, b.totals.submitted, b.totals.approved, b.totals.waitingReview, b.totals.open]));
  }
  if (Array.isArray(r.engineers) && r.engineers.length) {
    const week = r.period === 'week';
    await table('Engineers', [['Engineer', 140], [week ? 'Days' : 'In - Out', 78, 'r'], ['Hours', 52, 'r'], ['Visits', 46, 'r'], ['Reports', 54, 'r'], ['Approved', 58, 'r'], ['Open', 77, 'r']],
      r.engineers.map((x) => [
        { v: x.name, o: { f: bold } },
        week ? String(x.daysPresent) : (x.daysPresent ? `${x.firstIn || '-'} - ${x.lastOut || (x.onDutyNow ? 'now' : '-')}` : { v: 'Absent', o: { color: C.red } }),
        x.hours ? hrs(x.hours) : '-', x.siteVisits, x.submitted, x.approved,
        x.returned ? { v: `${x.openNow} (${x.returned} returned)`, o: { color: C.red } } : x.openNow,
      ]));
  }
  if (isEng) {
    await room(80);
    rect(M, y - 50, W - 2 * M, 50, { color: C.soft, borderColor: C.line, borderWidth: 0.7 });
    text('Keep it up', M + 14, y - 20, { f: bold, size: 11, color: C.navy2 });
    text(e.returned ? `${e.returned} report${e.returned === 1 ? ' was' : 's were'} returned - fix and resubmit to keep your approval rate high.` : 'Submit reports on time with all photos and the selfie for quick approval.', M + 14, y - 37, { size: 9.5, color: C.grey });
    y -= 70;
  }
  footer();
  return Buffer.from(await doc.save());
}

module.exports = { workReportPdf };
