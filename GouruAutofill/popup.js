import { caseValues } from './values.js';
import { valocity } from './portals/valocity.js';

const PORTALS = [valocity];
const $ = (id) => document.getElementById(id);
let state = { server: '', token: '', user: null };
let cases = [];
let selected = null;

function show(text, kind) {
  const m = $('msg');
  m.textContent = text;
  m.className = `msg ${kind || ''}`;
  if (!text) m.classList.add('hidden');
}

async function api(path, options = {}) {
  const res = await fetch(`${state.server}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    if (path !== '/api/auth/login') { await logout(); throw new Error('Your Gouru login expired. Please log in again.'); }
  }
  if (!res.ok) throw new Error(body.error || body.message || `Server error ${res.status}`);
  return body;
}

async function logout() {
  state = { server: state.server, token: '', user: null };
  await chrome.storage.local.remove(['token', 'user']);
  render();
}

function render() {
  const loggedIn = !!state.token;
  $('login').classList.toggle('hidden', loggedIn);
  $('main').classList.toggle('hidden', !loggedIn);
  $('logout').classList.toggle('hidden', !loggedIn);
  if (loggedIn) {
    const name = state.user?.name || state.user?.username || '';
    $('who').textContent = name;
    $('avatar').textContent = (name.trim()[0] || 'G').toUpperCase();
    $('role').textContent = ({ SUPER_ADMIN: 'Super admin', ADMIN: 'Branch admin', ENGINEER: 'Engineer', BANK: 'Bank' })[state.user?.role] || 'Logged in';
    drawTabs();
    loadCases();
  }
}

function caseLine(c) {
  const pd = c.propertyDetails || {};
  return [c.fileNumber || c.id, pd.propertyType, pd.village, c.bankName].filter(Boolean).join(' · ');
}

function drawCases() {
  const q = $('search').value.trim().toLowerCase();
  const filter = $('statusFilter').value;
  const statusOk = (c) => filter === 'all'
    || (filter === 'done' && ['Approved', 'Completed'].includes(c.status))
    || (filter === 'review' && c.status === 'Reviewing');
  const rows = cases.filter((c) => statusOk(c) && (!q || `${c.clientName} ${caseLine(c)} ${c.address}`.toLowerCase().includes(q))).slice(0, 60);
  $('cases').innerHTML = '';
  for (const c of rows) {
    const d = document.createElement('div');
    d.className = `case${selected && selected.id === c.id ? ' sel' : ''}`;
    const av = document.createElement('div');
    av.className = 'avatar';
    av.style.cssText = 'width:30px;height:30px;font-size:12px';
    av.textContent = (String(c.clientName || '?').trim()[0] || '?').toUpperCase();
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('div');
    name.className = 'name';
    const n = document.createElement('span');
    n.textContent = c.clientName || 'No name';
    const pill = document.createElement('span');
    const kind = ['Approved', 'Completed'].includes(c.status) ? 'done' : c.status === 'Reviewing' ? 'review' : 'other';
    pill.className = `pill ${kind}`;
    pill.textContent = c.status === 'Reviewing' ? 'In review' : c.status;
    name.append(n, pill);
    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = caseLine(c);
    meta.title = caseLine(c);
    info.append(name, meta);
    d.append(av, info);
    d.onclick = () => { selected = c; setFillReady(); drawCases(); };
    $('cases').appendChild(d);
  }
  if (!rows.length) $('cases').innerHTML = `<div class="empty">${cases.length ? 'No cases here. Try “All”.' : 'No cases found.'}</div>`;
}

async function loadCases() {
  try {
    $('cases').innerHTML = '<div class="empty">Loading cases…<br>The server may take up to a minute to wake up.</div>';
    cases = await api('/api/cases?view=list');
    drawCases();
  } catch (e) {
    show(e.message, 'err');
  }
}

$('doLogin').onclick = async () => {
  show('');
  state.server = $('server').value.trim().replace(/\/+$/, '');
  try {
    $('doLogin').disabled = true;
    $('doLogin').innerHTML = '<span class="spin"></span>Logging in…';
    const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: $('user').value.trim(), password: $('pass').value }) });
    state.token = r.token;
    state.user = { name: r.user?.name, username: r.user?.username, role: r.user?.role };
    $('pass').value = '';
    $('pass').type = 'password';
    await chrome.storage.local.set({ server: state.server, token: state.token, user: state.user });
    render();
  } catch (e) {
    show(e.message, 'err');
  } finally {
    $('doLogin').disabled = false;
    $('doLogin').textContent = 'Log in';
  }
};

$('logout').onclick = logout;
$('eye').onclick = () => {
  const show = $('pass').type === 'password';
  $('pass').type = show ? 'text' : 'password';
  $('eyeOpen').classList.toggle('hidden', show);
  $('eyeShut').classList.toggle('hidden', !show);
  $('eye').title = show ? 'Hide password' : 'Show password';
  $('pass').focus();
};
for (const id of ['user', 'pass']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') $('doLogin').click(); });

function setFillReady(busy) {
  $('fill').disabled = !selected || !!busy;
  $('fill').classList.toggle('busy', !!busy);
  $('icoPick').classList.toggle('hidden', !!selected);
  $('icoBusy').classList.toggle('hidden', !busy);
  $('fillText').textContent = busy ? 'Filling the form…' : selected ? `Fill this page · ${selected.clientName}` : 'Select a case above';
}
function drawTabs() {
  for (const b of $('tabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === $('statusFilter').value);
}
for (const b of $('tabs').querySelectorAll('button')) {
  b.onclick = () => { $('statusFilter').value = b.dataset.v; drawTabs(); $('statusFilter').onchange(); };
}
$('search').oninput = drawCases;
$('statusFilter').onchange = async () => {
  selected = null;
  setFillReady();
  drawCases();
  await chrome.storage.local.set({ statusFilter: $('statusFilter').value });
};

$('fill').onclick = async () => {
  show('');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const portal = PORTALS.find((p) => p.match(tab?.url || ''));
  if (!portal) { show('Open the portal form (Valocity) in this tab first, then press Fill.', 'err'); return; }
  try {
    setFillReady(true);
    const full = await api(`/api/cases/${encodeURIComponent(selected.id)}`);
    const fields = portal.fields(caseValues(full));
    const target = { tabId: tab.id, allFrames: false };
    await chrome.scripting.executeScript({ target, files: ['fill.js'] });
    const [{ result }] = await chrome.scripting.executeScript({
      target,
      func: (f, o) => gouruFill(f, o), // eslint-disable-line no-undef
      args: [fields, { overwrite: $('overwrite').checked }],
    });
    show(`${portal.name}: filled ${result.done}, please check ${result.guessed}, not filled ${result.missing.length}.\nThe list is shown on the page. Press Save there yourself.`, 'ok');
  } catch (e) {
    show(e.message, 'err');
  } finally {
    setFillReady();
  }
};

(async () => {
  const saved = await chrome.storage.local.get(['server', 'token', 'user', 'statusFilter']);
  if (saved.statusFilter) $('statusFilter').value = saved.statusFilter;
  state.server = 'https://gcrapp-api.onrender.com';
  $('server').value = state.server;
  state.token = saved.token || '';
  state.user = saved.user || null;
  render();
})();
