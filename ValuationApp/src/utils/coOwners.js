// Joint owners of a property, besides the client (owner 1). Kept in propertyDetails.report as
// owner2Name / owner2Rel … owner6Name / owner6Rel — the keys every bank report builder already reads.
export const MAX_CO_OWNERS = 5;

/** report → [{ name, rel }] (owners 2…6, in order) */
export function readCoOwners(report = {}) {
  const out = [];
  for (let i = 2; i < 2 + MAX_CO_OWNERS; i += 1) {
    const name = report[`owner${i}Name`];
    if (name != null) out.push({ name: String(name), rel: String(report[`owner${i}Rel`] || '') });   // '' = a row being typed
  }
  return out;
}

/** report + [{ name, rel }] → a new report with owners 2…6 rewritten (empty rows are kept while typing) */
export function writeCoOwners(report = {}, list = []) {
  const next = { ...report };
  for (let i = 2; i < 2 + MAX_CO_OWNERS; i += 1) { delete next[`owner${i}Name`]; delete next[`owner${i}Rel`]; }
  list.slice(0, MAX_CO_OWNERS).forEach((o, j) => {
    next[`owner${j + 2}Name`] = o.name;
    if (String(o.rel || '').trim()) next[`owner${j + 2}Rel`] = o.rel;
  });
  return next;
}
