// Runs inside the portal page (injected by the popup). Self-contained: no imports.
// Finds each field by its fixed form ID (when the portal form has one) or by the label printed next
// to it, fills it, and colours it:
//   green  = filled from Gouru, orange = usual answer you should check, red list = not filled.
// Handles plain boxes, normal dropdowns, radio buttons, PrimeNG search boxes (p-autocomplete: type,
// wait for the portal's list, pick) and Angular Material dropdowns (mat-select).
// It never clicks Save, Submit, Finalise or Send.

// eslint-disable-next-line no-unused-vars
async function gouruFill(fields, opts) {
  const overwrite = !!(opts && opts.overwrite);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').replace(/[*:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const loose = (s) => norm(s).replace(/[^a-z0-9]/g, '');
  const CONTROL = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]):not([type=image]), textarea, select, ng-select, mat-select, p-autocomplete, p-dropdown, [role=combobox], .select2-selection, [contenteditable=true]';
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  // ---------- finding fields ----------
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1 && !n.matches(CONTROL) && !n.querySelector(CONTROL) && !/^(OPTION|SCRIPT|STYLE|BUTTON)$/.test(n.tagName)) t += ' ' + n.textContent;
    }
    return norm(t);
  }
  const labels = [];
  for (const el of document.querySelectorAll('label, td, th, div, span, p, dt, h5, h6, b, strong')) {
    if (!visible(el) || el.closest('#gouru-fill-panel')) continue;
    const t = ownText(el);
    if (t.length < 3 || t.length > 300) continue;
    if (el.matches('div, span, td') && [...el.children].some((c) => ownText(c) === t)) continue; // keep the innermost
    labels.push({ el, t });
  }
  const usedLabels = new Set();
  const usedControls = new Set();

  function findLabel(label, after) {
    const want = norm(label);
    let best = null; let score = 0;
    for (const l of labels) {
      if (usedLabels.has(l.el)) continue;
      if (after && !(after.compareDocumentPosition(l.el) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      let s = 0;
      if (l.t === want) s = 3;
      else if (l.t.startsWith(want)) s = 2 + want.length / l.t.length / 10;
      else if (l.t.includes(want)) s = 1 + want.length / l.t.length / 10;
      if (s > score) { score = s; best = l; }
    }
    return best;
  }

  // The control that belongs to a label: label[for], else the first unused control after it in its row
  function controlFor(labelEl) {
    const forId = labelEl.getAttribute && labelEl.getAttribute('for');
    if (forId && document.getElementById(forId)) return document.getElementById(forId);
    let box = labelEl;
    for (let i = 0; i < 7 && box; i++) {
      box = box.parentElement;
      if (!box) break;
      const after = [...box.querySelectorAll(CONTROL)]
        .filter((c) => !c.closest('#gouru-fill-panel') && !(c.tagName === 'INPUT' && c.closest('p-autocomplete, mat-select, p-dropdown')))
        .filter((c) => !usedControls.has(c) && (labelEl.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING));
      if (after.length) return after[0];
    }
    return null;
  }

  function byId(id) {
    if (!id) return null;
    const q = (a) => document.querySelector(`[${a}="${CSS.escape(id)}"]`);
    return q('formcontrolname') || document.getElementById(id) || q('name');
  }

  // ---------- setting values ----------
  function setNative(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
  }
  const blur = (el) => { el.dispatchEvent(new Event('blur', { bubbles: true })); el.blur && el.blur(); };

  const wants = (value) => (Array.isArray(value) ? value : [value]).map(norm).filter(Boolean);
  // Best option for the wanted value(s): exact, then starts-with, then contains, then shared words
  function pickOption(texts, value) {
    const ws = wants(value);
    const L = texts.map(loose);
    for (const w of ws) { const i = L.findIndex((t) => t && t === loose(w)); if (i >= 0) return i; }
    for (const w of ws) { const i = L.findIndex((t) => t && t.startsWith(loose(w)) && !/^select/.test(t)); if (i >= 0) return i; }
    for (const w of ws) { const i = L.findIndex((t) => t && (t.includes(loose(w)) || loose(w).includes(t)) && !/select|choose/.test(t)); if (i >= 0) return i; }
    let best = -1; let bestScore = 0;
    for (const w of ws) {
      const ww = norm(w).split(/[^a-z0-9]+/).filter((x) => x.length > 2);
      texts.forEach((t, i) => {
        const tw = norm(t).split(/[^a-z0-9]+/);
        const s = ww.filter((x) => tw.includes(x)).length / (ww.length || 1);
        if (s > bestScore) { bestScore = s; best = i; }
      });
    }
    return bestScore >= 0.5 ? best : -1;
  }

  async function fillSelect(el, value, wait) {
    if (wait) for (let i = 0; i < 40 && (el.disabled || el.options.length < 2); i++) await sleep(250);
    const texts = [...el.options].map((o) => o.textContent);
    const i = pickOption(texts, value);
    if (i < 0) return `no option "${wants(value)[0]}"`;
    el.selectedIndex = i;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  const OPTION_SEL = '.p-autocomplete-panel li, .p-autocomplete-item, .p-autocomplete-option, mat-option, [role=option], .ng-option, .select2-results__option';
  const openOptions = () => [...document.querySelectorAll(OPTION_SEL)].filter(visible)
    .filter((o) => !/no (results|records)|loading|searching/i.test(o.textContent));

  async function clickOption(o) {
    o.scrollIntoView && o.scrollIntoView({ block: 'nearest' });
    o.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    o.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    o.click();
    await sleep(300);
  }

  // PrimeNG search box: type a search word, wait for the portal's list, pick the best match
  async function fillAutocomplete(el, value, f) {
    const input = el.querySelector('input');
    if (!input) return 'no search box';
    for (let i = 0; i < (f.wait ? 40 : 4) && (input.disabled || input.readOnly); i++) await sleep(250);
    if (input.disabled) return 'locked (fill the box above first)';
    const terms = (f.search && f.search.length ? f.search : wants(value).map((w) => w.split(/\s+/).sort((a, b) => b.length - a.length)[0]))
      .filter(Boolean);
    for (const term of terms) {
      setNative(input, '');
      await sleep(150);
      setNative(input, term);
      input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: term.slice(-1) }));
      let opts = [];
      for (let i = 0; i < 28; i++) { await sleep(250); opts = openOptions(); if (opts.length) break; }
      if (!opts.length) continue;
      const k = pickOption(opts.map((o) => o.textContent), value);
      if (k >= 0) { await clickOption(opts[k]); blur(input); return true; }
    }
    setNative(input, '');
    blur(input);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    return `"${wants(value)[0]}" not in the portal's list`;
  }

  // Angular Material / other popup dropdowns: open, pick, close
  async function fillPopupSelect(el, value) {
    const trigger = el.querySelector('.mat-mdc-select-trigger, .mat-select-trigger, .p-dropdown, .ng-select-container, .select2-selection, [role=combobox]') || el;
    trigger.click();
    let opts = [];
    for (let i = 0; i < 20; i++) { await sleep(150); opts = openOptions(); if (opts.length) break; }
    const k = pickOption(opts.map((o) => o.textContent), value);
    if (k < 0) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return `no option "${wants(value)[0]}"`; }
    await clickOption(opts[k]);
    return true;
  }

  function fillChoice(el, value) {
    const scope = el.name ? [...document.querySelectorAll(`input[name="${CSS.escape(el.name)}"]`)] : [el];
    const texts = scope.map((r) => (r.labels && r.labels[0] && r.labels[0].textContent) || (r.closest('label') && r.closest('label').textContent) || (r.parentElement && r.parentElement.textContent) || r.value);
    const i = pickOption(texts, value);
    if (i < 0) return `no choice "${wants(value)[0]}"`;
    if (!scope[i].checked) scope[i].click();
    return true;
  }

  const isEmpty = (el) => {
    if (el.tagName === 'SELECT') return el.selectedIndex <= 0 || /select|choose/i.test(el.options[el.selectedIndex]?.textContent || '');
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) return !String(el.value || '').trim();
    const inp = el.querySelector('input');
    if (inp && el.tagName === 'P-AUTOCOMPLETE') return !String(inp.value || '').trim();
    const t = norm(el.textContent);
    // Material dropdown showing only its placeholder (e.g. Units: "Land")
    if (el.classList.contains('mat-mdc-select-empty') || el.querySelector('.mat-mdc-select-placeholder, .mat-select-placeholder')) return true;
    if (el.getAttribute('placeholder') && t === norm(el.getAttribute('placeholder'))) return true;
    return !t || /select|choose/.test(t);
  };

  function mark(el, color) {
    const target = el.matches('input, textarea, select') ? el
      : (el.querySelector('input, .mat-mdc-select-trigger, .ng-select-container, .select2-selection') || el);
    target.style.setProperty('outline', `2px solid ${color}`, 'important');
    target.style.setProperty('background-color', color === '#16a34a' ? '#ecfdf5' : '#fff7ed', 'important');
  }

  // ---------- run ----------
  const done = []; const guessed = []; const missing = []; const skipped = [];
  let lastLabel = null;
  for (const f of fields) {
    const value = f.value;
    const name = f.name || f.label || f.id;
    if (!wants(value).length) { skipped.push(`${name} (no data in Gouru)`); continue; }
    let el = byId(f.id);
    if (!el && f.label) {
      const lab = findLabel(f.label, f.afterPrevious ? lastLabel : null);
      if (lab) { usedLabels.add(lab.el); lastLabel = lab.el; el = controlFor(lab.el); }
    }
    if (el && el.tagName === 'INPUT' && el.closest('p-autocomplete')) el = el.closest('p-autocomplete');
    if (!el) { missing.push(`${name} (field not found)`); continue; }
    usedControls.add(el);
    try {
      let res;
      const tag = el.tagName;
      if (el.matches('input[type=radio], input[type=checkbox]')) res = fillChoice(el, value);
      else if (!overwrite && !isEmpty(el)) { skipped.push(`${name} (already filled)`); continue; }
      else if (el.disabled || el.readOnly) { skipped.push(`${name} (locked by the portal)`); continue; }
      else if (tag === 'SELECT') res = await fillSelect(el, value, f.wait);
      else if (tag === 'P-AUTOCOMPLETE') res = await fillAutocomplete(el, value, f);
      else if (tag === 'INPUT' || tag === 'TEXTAREA') {
        setNative(el, Array.isArray(value) ? String(value[0]) : String(value));
        blur(el);
        res = true;
      } else res = await fillPopupSelect(el, value);
      if (res === true) { mark(el, f.guess ? '#ea580c' : '#16a34a'); (f.guess ? guessed : done).push(name); }
      else missing.push(`${name} (${res})`);
      if (f.wait || tag === 'SELECT' || tag === 'P-AUTOCOMPLETE') await sleep(350); // let dependent boxes load
    } catch (e) {
      missing.push(`${name} (${e.message})`);
    }
  }

  // Result panel on the page
  document.getElementById('gouru-fill-panel')?.remove();
  const p = document.createElement('div');
  p.id = 'gouru-fill-panel';
  p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-height:60vh;overflow:auto;background:#fff;color:#111;border:1px solid #ccc;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.2);font:13px/1.4 system-ui,sans-serif;padding:12px';
  const esc = (x) => String(x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const list = (title, items, color) => items.length ? `<div style="margin-top:8px;font-weight:600;color:${color}">${title} (${items.length})</div><ul style="margin:4px 0 0 18px;padding:0">${items.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>Gouru Autofill</b><button id="gouru-fill-close" style="border:0;background:none;font-size:18px;cursor:pointer">×</button></div>
    <div style="margin-top:4px">Check the form, then press Save yourself.</div>
    ${list('Filled', done, '#16a34a')}${list('Please check (usual answer)', guessed, '#ea580c')}${list('Not filled', missing, '#dc2626')}${list('Skipped', skipped, '#6b7280')}`;
  document.body.appendChild(p);
  document.getElementById('gouru-fill-close').onclick = () => p.remove();
  return { done: done.length, guessed: guessed.length, missing, skipped: skipped.length };
}
