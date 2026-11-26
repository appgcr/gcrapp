// Phone model codes → the names people know. Android phones report Build.MODEL (Samsung uses codes such as
// SM-A146B; many other brands report the real name already); iPhones report an identifier such as iPhone15,2.
// Unknown codes are shown as "Brand CODE", so nothing is ever hidden.

const IPHONE = {
  'iPhone10,1': 'iPhone 8', 'iPhone10,4': 'iPhone 8', 'iPhone10,2': 'iPhone 8 Plus', 'iPhone10,5': 'iPhone 8 Plus',
  'iPhone10,3': 'iPhone X', 'iPhone10,6': 'iPhone X', 'iPhone11,8': 'iPhone XR', 'iPhone11,2': 'iPhone XS',
  'iPhone11,6': 'iPhone XS Max', 'iPhone12,1': 'iPhone 11', 'iPhone12,3': 'iPhone 11 Pro', 'iPhone12,5': 'iPhone 11 Pro Max',
  'iPhone12,8': 'iPhone SE (2nd gen)', 'iPhone13,1': 'iPhone 12 mini', 'iPhone13,2': 'iPhone 12', 'iPhone13,3': 'iPhone 12 Pro',
  'iPhone13,4': 'iPhone 12 Pro Max', 'iPhone14,4': 'iPhone 13 mini', 'iPhone14,5': 'iPhone 13', 'iPhone14,2': 'iPhone 13 Pro',
  'iPhone14,3': 'iPhone 13 Pro Max', 'iPhone14,6': 'iPhone SE (3rd gen)', 'iPhone14,7': 'iPhone 14', 'iPhone14,8': 'iPhone 14 Plus',
  'iPhone15,2': 'iPhone 14 Pro', 'iPhone15,3': 'iPhone 14 Pro Max', 'iPhone15,4': 'iPhone 15', 'iPhone15,5': 'iPhone 15 Plus',
  'iPhone16,1': 'iPhone 15 Pro', 'iPhone16,2': 'iPhone 15 Pro Max', 'iPhone17,3': 'iPhone 16', 'iPhone17,4': 'iPhone 16 Plus',
  'iPhone17,1': 'iPhone 16 Pro', 'iPhone17,2': 'iPhone 16 Pro Max', 'iPhone17,5': 'iPhone 16e',
};

// Samsung codes common in India (the letters after the number — B, F, E, N, U… — are the region; ignored)
const SAMSUNG = {
  A055: 'Galaxy A05', A057: 'Galaxy A05s', A065: 'Galaxy A06', A145: 'Galaxy A14', A146: 'Galaxy A14 5G', A155: 'Galaxy A15',
  A156: 'Galaxy A15 5G', A165: 'Galaxy A16', A166: 'Galaxy A16 5G', A235: 'Galaxy A23', A236: 'Galaxy A23 5G', A245: 'Galaxy A24',
  A256: 'Galaxy A25 5G', A266: 'Galaxy A26 5G', A325: 'Galaxy A32', A336: 'Galaxy A33 5G', A346: 'Galaxy A34 5G', A356: 'Galaxy A35 5G',
  A366: 'Galaxy A36 5G', A536: 'Galaxy A53 5G', A546: 'Galaxy A54 5G', A556: 'Galaxy A55 5G', A566: 'Galaxy A56 5G',
  A135: 'Galaxy A13', A136: 'Galaxy A13 5G', A035: 'Galaxy A03', A037: 'Galaxy A03s', A045: 'Galaxy A04', A047: 'Galaxy A04s',
  M135: 'Galaxy M13', M136: 'Galaxy M13 5G', M145: 'Galaxy M14', M146: 'Galaxy M14 5G', M156: 'Galaxy M15 5G', M166: 'Galaxy M16 5G',
  M336: 'Galaxy M33 5G', M346: 'Galaxy M34 5G', M356: 'Galaxy M35 5G', M536: 'Galaxy M53 5G', M546: 'Galaxy M54 5G',
  E135: 'Galaxy F13', E146: 'Galaxy F14 5G', E156: 'Galaxy F15 5G', E166: 'Galaxy F16 5G', E346: 'Galaxy F34 5G', E546: 'Galaxy F54 5G',
  S901: 'Galaxy S22', S906: 'Galaxy S22+', S908: 'Galaxy S22 Ultra', S911: 'Galaxy S23', S916: 'Galaxy S23+', S918: 'Galaxy S23 Ultra',
  S711: 'Galaxy S23 FE', S921: 'Galaxy S24', S926: 'Galaxy S24+', S928: 'Galaxy S24 Ultra', S721: 'Galaxy S24 FE',
  S931: 'Galaxy S25', S936: 'Galaxy S25+', S938: 'Galaxy S25 Ultra', S937: 'Galaxy S25 Edge',
  F731: 'Galaxy Z Flip5', F946: 'Galaxy Z Fold5', F741: 'Galaxy Z Flip6', F956: 'Galaxy Z Fold6',
  X205: 'Galaxy Tab A8', X115: 'Galaxy Tab A9', X216: 'Galaxy Tab A9+', X710: 'Galaxy Tab S9', X516: 'Galaxy Tab S9 FE',
};

const BRAND = (m) => {
  const t = String(m || '').trim().toLowerCase();
  const known = { samsung: 'Samsung', xiaomi: 'Xiaomi', redmi: 'Redmi', poco: 'POCO', realme: 'realme', oppo: 'OPPO', vivo: 'vivo',
    oneplus: 'OnePlus', motorola: 'Motorola', google: 'Google', nokia: 'Nokia', iqoo: 'iQOO', nothing: 'Nothing', apple: 'Apple',
    lava: 'Lava', infinix: 'Infinix', tecno: 'TECNO', itel: 'itel', honor: 'HONOR', huawei: 'Huawei', asus: 'ASUS' };
  return known[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
};

/** { manufacturer, model } → "Samsung Galaxy A14 5G" / "iPhone 14 Pro" / "Redmi Note 13 5G" */
function modelName(manufacturer, model) {
  const m = String(model || '').trim();
  const brand = BRAND(manufacturer);
  if (/^iPhone\d+,\d+$/.test(m)) return IPHONE[m] || `iPhone (${m})`;
  if (/^iPad\d+,\d+$/.test(m)) return `iPad (${m})`;
  const sm = /^SM-([A-Z]\d{3})/i.exec(m);
  if (sm && SAMSUNG[sm[1].toUpperCase()]) return `Samsung ${SAMSUNG[sm[1].toUpperCase()]}`;
  if (!m) return brand;
  // Many brands already report the real name ("Redmi Note 13 5G", "moto g54 5G"); add the brand when missing
  const startsWithBrand = /^(redmi|poco|mi |galaxy|iqoo|moto|pixel|nord|oneplus|realme|oppo|vivo|nokia|infinix|tecno|nothing)/i.test(m);
  return brand && !startsWithBrand && !m.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${m}` : m;
}

/** The x-device header the app sends: "manufacturer|model|name|osVersion" (URI-encoded) */
function fromHeader(raw) {
  if (!raw) return null;
  let text = '';
  try { text = decodeURIComponent(String(raw)); } catch { return null; }
  const [manufacturer, model, name] = text.split('|').map((s) => String(s || '').trim());
  const real = modelName(manufacturer, model);
  if (!real) return null;
  // The phone's own name ("Ravi's Galaxy") when the owner set one — not the generic "iPhone" / model code
  const own = name && !/^(iphone|ipad|android)$/i.test(name) && name !== model && !real.toLowerCase().includes(name.toLowerCase()) ? name : '';
  return { name: real, ownName: own.slice(0, 60) };
}

module.exports = { modelName, fromHeader };
