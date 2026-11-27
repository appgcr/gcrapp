// Runs inside the Valocity page: puts the chosen Gouru files into the page's upload box, as if picked by hand.
// list: [{ name, type, b64 }] → { ok, how, count, multiple }
// eslint-disable-next-line no-unused-vars
function gouruAttach(list) {
  const files = list.map((f) => {
    const bin = atob(f.b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], f.name, { type: f.type || 'application/octet-stream', lastModified: Date.now() });
  });
  const shown = (el) => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden') return false;
    }
    return true;
  };
  // The file box itself is usually hidden inside a visible upload area: judge by its parent. The newest
  // (last) one is the upload dialog the user just opened.
  const inputs = [...document.querySelectorAll('input[type=file]')].filter((i) => !i.disabled);
  const visible = inputs.filter((i) => shown(i.parentElement || i));
  const target = (visible.length ? visible : inputs).slice(-1)[0];
  if (target) {
    const dt = new DataTransfer();
    for (const f of target.multiple ? files : files.slice(0, 1)) dt.items.add(f);
    target.files = dt.files;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    return { ok: true, how: 'input', count: dt.files.length, multiple: !!target.multiple };
  }
  // No file box: drop the files on the page's upload area
  const zone = [...document.querySelectorAll('[class*="drop" i], [class*="upload" i]')].filter(shown).pop();
  if (zone) {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    for (const t of ['dragenter', 'dragover', 'drop']) zone.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt }));
    return { ok: true, how: 'drop', count: files.length, multiple: true };
  }
  return { ok: false };
}
