// Runs inside the portal page (injected by the popup). Self-contained: no imports.
// Finds each field by the label text printed next to it, fills it, and colours it:
//   green  = filled from Gouru, orange = usual answer you should check, red list = not found.
// It never clicks Save, Submit or Finalise.

// eslint-disable-next-line no-unused-vars
async function gouruFill(fields, opts) {
  const overwrite = !!(opts && opts.overwrite);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (s) => String(s || '').replace(/[*:]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  const CONTROL = 'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=file]):not([type=image]), textarea, select, ng-select, mat-select, [role=combobox], .select2-selection, [contenteditable=true]';
  const visible = (el) => !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  // Text of an element without the text of controls / options inside it
  function ownText(el) {
    let t = '';
    for (const n of el.childNodes) {
      if (n.nodeType === 3) t += n.textContent;
      else if (n.nodeType === 1 && !n.matches(CONTROL) && !n.querySelector(CONTROL) && !/^(OPTION|SCRIPT|STYLE)$/.test(n.tagName)) t += ' ' + n.textContent;
    }
    return norm(t);
  }

  // Every short piece of text that could be a field label
  const labels = [];
  for (const el of document.querySelectorAll('label, td, th, div, span, p, dt, h5, h6, b, strong')) {
    if (!visible(el) || el.closest('#gouru-fill-panel')) continue;
    const t = ownText(el);
    if (t.length < 3 || t.length > 260) continue;
    if (el.matches('div, span') && [...el.children].some((c) => ownText(c) === t)) continue; // keep the innermost
    labels.push({ el, t });
  }
  const used = new Set();

  function findLabel(label) {
    const want = norm(label);
    let best = null, score = 0;
    for (const l of labels) {
      if (used.has(l.el)) continue;
      let s = 0;
      if (l.t === want) s = 3;
      else if (l.t.startsWith(want)) s = 2 + want.length / l.t.length / 10;
      else if (l.t.includes(want)) s = 1 + want.length / l.t.length / 10;
      if (s > score) { score = s; best = l; }
    }
    return best;
  }

  // The control that belongs to a label: label[for], else the first control after it in the nearest row
  function controlFor(labelEl) {
    const forId = labelEl.getAttribute && labelEl.getAttribute('for');
    if (forId && document.getElementById(forId)) return { el: document.getElementById(forId), box: labelEl.parentElement };
    let box = labelEl;
    for (let i = 0; i < 6 && box; i++) {
      box = box.parentElement;
      if (!box) break;
      const all = [...box.querySelectorAll(CONTROL)].filter((c) => !c.closest('#gouru-fill-panel'));
      const after = all.filter((c) => labelEl.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING);
      if (after.length) {
        // stop if this box already holds other labels' fields (we went too far up)
        return { el: after[0], box };
      }
    }
    return null;
  }

  function setNative(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
    el.focus();
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const wants = (value) => (Array.isArray(value) ? value : [value]).map(norm).filter(Boolean);
  function pickOption(texts, value) {
    const ws = wants(value);
    for (const w of ws) { const i = texts.findIndex((t) => t === w); if (i >= 0) return i; }
    for (const w of ws) { const i = texts.findIndex((t) => t && (t.includes(w) || w.includes(t)) && !/select/.test(t)); if (i >= 0) return i; }
    return -1;
  }

  async function fillSelect(el, value, wait) {
    if (wait) for (let i = 0; i < 40 && (el.disabled || el.options.length < 2); i++) await sleep(250);
    const texts = [...el.options].map((o) => norm(o.textContent));
    const i = pickOption(texts, value);
    if (i < 0) return `no option "${wants(value)[0]}"`;
    el.value = el.options[i].value;
    el.selectedIndex = i;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  // Searchable dropdowns (ng-select / select2 / mat-select / custom): open, type, click the match
  async function fillCustom(el, value, wait) {
    const trigger = el.matches('.select2-selection') ? el : (el.querySelector('.ng-select-container, .select2-selection, [role=combobox]') || el);
    for (let i = 0; i < (wait ? 40 : 1) && (el.classList.contains('ng-select-disabled') || el.getAttribute('aria-disabled') === 'true'); i++) await sleep(250);
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    trigger.click();
    await sleep(300);
    const search = el.querySelector('input') || document.querySelector('.select2-search__field, .select2-container--open input');
    if (search) { setNative(search, wants(value)[0] || ''); search.focus(); }
    let opts = [];
    for (let i = 0; i < (wait ? 30 : 12); i++) {
      await sleep(250);
      opts = [...document.querySelectorAll('[role=option], .ng-option, .select2-results__option, mat-option, .dropdown-menu.show li, .dropdown-menu.show a')].filter(visible);
      if (opts.length && !(opts.length === 1 && /loading|searching/i.test(opts[0].textContent))) break;
    }
    const i = pickOption(opts.map((o) => norm(o.textContent)), value);
    if (i < 0) { document.body.click(); return `no option "${wants(value)[0]}"`; }
    opts[i].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    opts[i].click();
    opts[i].dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    return true;
  }

  function fillChoice(box, value) {
    const inputs = [...box.querySelectorAll('input[type=radio], input[type=checkbox]')];
    const texts = inputs.map((r) => norm((r.labels && r.labels[0] && r.labels[0].textContent) || (r.parentElement && r.parentElement.textContent) || r.value));
    const i = pickOption(texts, value);
    if (i < 0) return `no choice "${wants(value)[0]}"`;
    if (!inputs[i].checked) inputs[i].click();
    return true;
  }

  const isEmpty = (el) => {
    if (el.tagName === 'SELECT') return el.selectedIndex <= 0 || /select/i.test(el.options[el.selectedIndex]?.textContent || '');
    if (/^(INPUT|TEXTAREA)$/.test(el.tagName)) return !String(el.value || '').trim();
    const t = norm(el.textContent);
    return !t || /select/.test(t) || t === 'choose';
  };

  function mark(el, color) {
    const target = el.matches('input, textarea, select') ? el : (el.querySelector('.ng-select-container, .select2-selection') || el);
    target.style.setProperty('outline', `2px solid ${color}`, 'important');
    target.style.setProperty('background-color', color === '#16a34a' ? '#ecfdf5' : '#fff7ed', 'important');
  }

  const done = [], guessed = [], missing = [], skipped = [];
  for (const f of fields) {
    const value = f.value;
    if (!wants(value).length) { skipped.push(`${f.label} (no data in Gouru)`); continue; }
    const lab = findLabel(f.label);
    if (!lab) { missing.push(`${f.label} (field not found)`); continue; }
    used.add(lab.el);
    const hit = controlFor(lab.el);
    if (!hit) { missing.push(`${f.label} (no box next to it)`); continue; }
    const { el, box } = hit;
    try {
      let res;
      if (el.matches('input[type=radio], input[type=checkbox]')) res = fillChoice(box, value);
      else if (!overwrite && !isEmpty(el)) { skipped.push(`${f.label} (already filled)`); continue; }
      else if (el.tagName === 'SELECT') res = await fillSelect(el, value, f.wait);
      else if (el.matches('input, textarea')) { setNative(el, wants(value).length && Array.isArray(value) ? value[0] : String(value)); res = true; }
      else res = await fillCustom(el, value, f.wait);
      if (res === true) { mark(el, f.guess ? '#ea580c' : '#16a34a'); (f.guess ? guessed : done).push(f.label); }
      else missing.push(`${f.label} (${res})`);
      if (f.wait || el.tagName === 'SELECT') await sleep(400); // let the next dropdown load
    } catch (e) {
      missing.push(`${f.label} (${e.message})`);
    }
  }

  // Result panel on the page
  document.getElementById('gouru-fill-panel')?.remove();
  const p = document.createElement('div');
  p.id = 'gouru-fill-panel';
  p.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;width:340px;max-height:60vh;overflow:auto;background:#fff;color:#111;border:1px solid #ccc;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.2);font:13px/1.4 system-ui,sans-serif;padding:12px';
  const list = (title, items, color) => items.length ? `<div style="margin-top:8px;font-weight:600;color:${color}">${title} (${items.length})</div><ul style="margin:4px 0 0 18px;padding:0">${items.map((x) => `<li>${x.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : '';
  p.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center"><b>Gouru Autofill</b><button id="gouru-fill-close" style="border:0;background:none;font-size:18px;cursor:pointer">×</button></div>
    <div style="margin-top:4px">Check the form, then press Save yourself.</div>
    ${list('Filled', done, '#16a34a')}${list('Please check (usual answer)', guessed, '#ea580c')}${list('Not filled', missing, '#dc2626')}${list('Skipped', skipped, '#6b7280')}`;
  document.body.appendChild(p);
  document.getElementById('gouru-fill-close').onclick = () => p.remove();
  return { done: done.length, guessed: guessed.length, missing, skipped: skipped.length };
}
