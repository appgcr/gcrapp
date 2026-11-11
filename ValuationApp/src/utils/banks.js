import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config/api';

// The one bank list (Settings → Banks, managed by the Super Admin). Every bank picker uses it,
// so adding or renaming a bank shows up everywhere at once.
let cached = null;
let pending = null;

export async function loadBanks(force = false) {
  if (cached && !force) return cached;
  if (!pending || force) {
    pending = fetch(`${API_BASE_URL}/api/banks`)
      .then((r) => (r.ok ? r.json() : { banks: [] }))
      .then((d) => { cached = Array.isArray(d.banks) ? d.banks : []; return cached; })
      .catch(() => cached || [])
      .finally(() => { pending = null; });
  }
  return pending;
}

export function banksChanged() {
  cached = null;
  window.dispatchEvent(new Event('gcr_banks_changed'));
}

/** Active banks: [{ id, name, shortName, aliases, format, policies }] */
export function useBanks() {
  const [banks, setBanks] = useState(cached || []);
  useEffect(() => {
    let alive = true;
    const refresh = (force) => loadBanks(force).then((list) => { if (alive) setBanks(list); });
    refresh(false);
    const onChange = () => refresh(true);
    window.addEventListener('gcr_banks_changed', onChange);
    return () => { alive = false; window.removeEventListener('gcr_banks_changed', onChange); };
  }, []);
  return banks;
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Matches a typed name, short name or old spelling to a bank in the list. */
export function matchBank(banks, text) {
  const key = norm(text);
  if (!key) return null;
  return banks.find((b) => [b.name, b.shortName, ...(b.aliases || [])].some((n) => n && norm(n) === key)) || null;
}

/** Search helper for pickers: name, short name or any other spelling contains the text. */
export function searchBanks(banks, text) {
  const q = norm(text);
  if (!q) return banks;
  return banks.filter((b) => [b.name, b.shortName, ...(b.aliases || [])].some((n) => n && norm(n).includes(q)));
}
