// "Documents annexure": every document the engineer uploaded and every site photo, as one PDF.
// It goes with the bank report (which stays in the bank's own format) — for admins to check the
// work, and attached to the email to the bank.

const fileStore = require('./fileStore');

const DOCS = [
  ['officeSheet', 'Office data sheet (GOURU VALUATION - OFFICE)'],
  ['bankDocs', 'Documents received from the bank'],
  ['saleDeed', 'Registered Document / Sale Deed'],
  ['buildingPlan', 'Approved Building Plan / Permit Order'],
  ['propertyTax', 'Property Tax Assessment / Receipt'],
  ['marketValue', 'Market Value / Guideline Certificate'],
  ['layoutPlan', 'Layout / Approval Plan'],
];
const A4 = [595, 842];
const ascii = (s) => String(s == null ? '' : s).replace(/[^\x20-\x7E]/g, (ch) => ({ '₹': 'Rs.', '–': '-', '—': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '·': '-' }[ch] || ''));

/** Bytes of a saved page / photo: a data: URL or a link to our file storage. → { bytes, type } or null */
async function bytesOf(src) {
  const url = typeof src === 'string' ? src : (src && (src.url || src.dataUrl || src.data)) || '';
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(url);
  if (m) return { bytes: Buffer.from(m[3], m[2] ? 'base64' : 'utf8'), type: (m[1] || '').toLowerCase() };
  const f = fileStore.parseFileUrl(url);
  if (f) {
    const meta = await fileStore.findFile(f.id, f.key).catch(() => null);
    if (!meta) return null;
    return { bytes: await fileStore.readBuffer(f.id), type: String(meta.contentType || '').toLowerCase(), name: meta.filename };
  }
  return null;
}

const kindOf = ({ bytes, type }) => {
  if (/pdf/.test(type) || bytes.slice(0, 4).toString() === '%PDF') return 'pdf';
  if (/png/.test(type) || bytes.slice(1, 4).toString() === 'PNG') return 'png';
  if (/jpe?g/.test(type) || (bytes[0] === 0xff && bytes[1] === 0xd8)) return 'jpg';
  return 'other';
};

/** → { pdf: Buffer, pages, skipped: [names] } */
async function annexurePdf(c, { internal = false } = {}) {
  const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.06, 0.09, 0.16); const grey = rgb(0.42, 0.47, 0.55); const navy = rgb(0.07, 0.2, 0.45);
  const fileNo = c.fileNumber || c.id;
  const skipped = [];
  const contents = [];

  const cover = doc.addPage(A4);
  const label = (page, text) => {
    page.drawRectangle({ x: 0, y: A4[1] - 34, width: A4[0], height: 34, color: rgb(0.95, 0.96, 0.98) });
    page.drawText(ascii(text).slice(0, 95), { x: 24, y: A4[1] - 22, size: 9.5, font: bold, color: navy });
    page.drawText(ascii(fileNo), { x: A4[0] - 24 - font.widthOfTextAtSize(ascii(fileNo), 9), y: A4[1] - 22, size: 9, font, color: grey });
  };
  const fitImage = async (pageLabel, item) => {
    const img = item.kind === 'png' ? await doc.embedPng(item.bytes) : await doc.embedJpg(item.bytes);
    const page = doc.addPage(A4);
    label(page, pageLabel);
    const maxW = A4[0] - 40; const maxH = A4[1] - 34 - 40;
    const s = Math.min(maxW / img.width, maxH / img.height, 1.6);
    const w = img.width * s; const h = img.height * s;
    page.drawImage(img, { x: (A4[0] - w) / 2, y: (A4[1] - 34 - h) / 2 + 6, width: w, height: h });
  };

  for (const [id, title] of DOCS) {
    const pages = Array.isArray(c.documents?.[id]) ? c.documents[id] : [];
    let count = 0;
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const name = (p && p.name) || `${title} ${i + 1}`;
      try {
        const got = await bytesOf(p);
        if (!got || !got.bytes.length) { skipped.push(name); continue; }
        const kind = kindOf(got);
        if (kind === 'pdf') {
          const src = await PDFDocument.load(got.bytes, { ignoreEncryption: true });
          const copied = await doc.copyPages(src, src.getPageIndices());
          copied.forEach((pg) => { doc.addPage(pg); count += 1; });
        } else if (kind === 'png' || kind === 'jpg') {
          await fitImage(`${title} - page ${i + 1}`, { ...got, kind });
          count += 1;
        } else {
          skipped.push(`${name} (Word / other file: open it in the app)`);
        }
      } catch (err) {
        skipped.push(`${name} (could not be read)`);
      }
    }
    if (count || !['officeSheet', 'bankDocs'].includes(id)) contents.push([title, count]);
  }

  let photoCount = 0;
  const photos = Array.isArray(c.sitePhotos) ? c.sitePhotos : [];
  for (let i = 0; i < photos.length; i++) {
    try {
      const got = await bytesOf(photos[i]);
      if (!got) continue;
      const kind = kindOf(got);
      if (kind !== 'png' && kind !== 'jpg') continue;
      await fitImage(`Site photo ${i + 1} of ${photos.length}`, { ...got, kind });
      photoCount += 1;
    } catch { /* skip unreadable photo */ }
  }
  contents.push(['Site photos', photoCount]);
  if (c.siteSelfie) {
    try {
      const got = await bytesOf(c.siteSelfie);
      const kind = got && kindOf(got);
      if (kind === 'png' || kind === 'jpg') { await fitImage('Engineer selfie at the site', { ...got, kind }); contents.push(['Engineer selfie at the site', 1]); }
    } catch { /* skip */ }
  }

  // Mahe AI review call: the questions and the engineer's answers (the recording itself stays with the case)
  const rv = c.aiReview;
  if (internal && rv && Array.isArray(rv.log) && rv.log.length) {
    let page = doc.addPage(A4); label(page, 'Mahe AI review call - questions and answers');
    let y = A4[1] - 70;
    const line = (txt, o = {}) => {
      const size = o.size || 10; const f = o.f || font; const maxW = A4[0] - 80 - (o.indent || 0);
      const parts = ascii(txt).split(/\s+/); let cur = '';
      const flush = () => {
        if (y < 50) { page = doc.addPage(A4); label(page, 'Mahe AI review call (continued)'); y = A4[1] - 70; }
        page.drawText(cur, { x: 40 + (o.indent || 0), y, size, font: f, color: o.color || ink }); y -= size + 4; cur = '';
      };
      for (const w of parts) { const t = cur ? `${cur} ${w}` : w; if (f.widthOfTextAtSize(t, size) > maxW && cur) { flush(); cur = w; } else cur = t; }
      if (cur) flush();
    };
    line(`Before submitting, Mahe AI asked the engineer ${rv.log.length} question${rv.log.length === 1 ? '' : 's'}. Call length ${Math.floor((rv.seconds || 0) / 60)} min ${(rv.seconds || 0) % 60} s. ${rv.recording ? 'The call recording is saved with the case.' : 'No recording (microphone not available).'}`, { color: grey });
    y -= 8;
    rv.log.forEach((e, k) => {
      line(`Q${k + 1}. ${e.question}`, { f: bold });
      const ans = e.decision === 'change' ? `Changed${e.label ? ` ${e.label}` : ''}: ${e.before || 'empty'} -> ${e.after}`
        : e.decision === 'keep' ? `Confirmed as entered${e.before ? `: ${e.before}` : ''}` : `Reason given: ${e.note || ''}`;
      line(ans, { indent: 14 });
      if (e.transcript) line(`Engineer said: "${e.transcript}"`, { indent: 14, color: grey, size: 9 });
      y -= 6;
    });
    contents.push(['Mahe AI review call (questions & answers)', 1]);
  }

  // Cover page
  let y = A4[1] - 70;
  const t = (s, x, yy, o = {}) => cover.drawText(ascii(s), { x, y: yy, size: o.size || 11, font: o.f || font, color: o.color || ink });
  t('Documents annexure', 40, y, { f: bold, size: 22, color: navy }); y -= 22;
  t('Copies of the documents and site photos for this valuation', 40, y, { color: grey, size: 10.5 }); y -= 34;
  const facts = [
    ['File no', fileNo], ['Client', c.clientName || c.borrowerName || ''], ['Bank', [c.bankName, c.bankBranch].filter(Boolean).join(', ')],
    ['Engineer', c.assignedEngineerName || ''], ['Inspection', c.inspectionDate ? String(c.inspectionDate).slice(0, 10) : ''],
  ].filter(([, v]) => v);
  for (const [k, v] of facts) { t(k, 40, y, { color: grey, size: 10 }); t(String(v).slice(0, 70), 130, y, { size: 10.5 }); y -= 18; }
  y -= 16;
  t('Contents', 40, y, { f: bold, size: 13 }); y -= 20;
  for (const [title, n] of contents) {
    t(title, 52, y, { size: 10.5 });
    const right = n ? `${n} page${n === 1 ? '' : 's'}` : 'not uploaded';
    t(right, A4[0] - 40 - font.widthOfTextAtSize(right, 10.5), y, { size: 10.5, color: n ? ink : grey });
    y -= 17;
  }
  if (skipped.length) {
    y -= 12; t('Not included here (open in the app):', 40, y, { f: bold, size: 10 }); y -= 15;
    for (const s of skipped.slice(0, 12)) { t(`- ${s}`.slice(0, 95), 52, y, { size: 9.5, color: grey }); y -= 13; }
  }
  t(`Prepared by Gouru Valuations on ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 40, 40, { size: 9, color: grey });

  const pdf = Buffer.from(await doc.save());
  return { pdf, pages: doc.getPageCount(), skipped, filename: `Documents_${String(fileNo).replace(/[^A-Za-z0-9]+/g, '-')}.pdf` };
}

module.exports = { annexurePdf, bytesOf, DOCS };
