// The four ways an engineer can fill a New Case — Upload documents, Office sheet, Audio, Valocity — switched on or
// off per branch (Settings → Case fill options). Old branches: office sheet + audio follow the earlier sheetBypass switch.
const KEYS = ['docs', 'sheet', 'audio', 'valocity'];

function fillModesOf(branch) {
  const m = (branch && branch.fillModes) || {};
  const legacy = !!(branch && branch.sheetBypass);
  const pick = (v, dflt) => (v === true || v === false ? v : dflt);
  const out = { docs: pick(m.docs, true), sheet: pick(m.sheet, legacy), audio: pick(m.audio, legacy), valocity: pick(m.valocity, false) };
  if (!KEYS.some((k) => out[k])) out.docs = true; // never leave engineers with no way to make a case
  return out;
}

module.exports = { KEYS, fillModesOf };
