"""
APGB (Andhra Pradesh Grameena Bank) report builder.

build(case) -> job for fill_report.py: every {{tag}} value, the per-floor rows,
the photo/map images, and all calculations (land, building depreciation, parts C–F,
abstract, "Say As", realizable / distress values, amounts in words).

Where values come from (later wins):
  1. DEFAULTS  — the standard wording the valuer normally uses (from the bank sample)
  2. the case  — client, bank, dates, deed, survey, extent, floors, photos, GPS …
  3. case.propertyDetails.report — anything the engineer/admin typed for this format
"""
import datetime as dt
import io
import math
import os
import re
import tempfile
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UPLOADS = os.path.abspath(os.path.join(HERE, '..', '..', 'uploads'))

SQM_PER_CENT = 40.468564
SQYD_PER_CENT = 48.4
SQFT_PER_SQM = 10.7639

# ---------------------------------------------------------------- formatting
def inr(n, decimals=False):
    """Indian digit grouping: 8714000 -> '87,14,000'."""
    n = float(n or 0)
    neg = n < 0
    n = abs(n)
    whole = int(round(n)) if not decimals else int(n)
    s = str(whole)
    if len(s) > 3:
        head, tail = s[:-3], s[-3:]
        head = re.sub(r'(\d)(?=(\d\d)+$)', r'\1,', head)
        s = head + ',' + tail
    if decimals:
        s += f'.{int(round((n - int(n)) * 100)):02d}'
    return ('-' if neg else '') + s


ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
        'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']


def _two(n):
    return ONES[n] if n < 20 else (TENS[n // 10] + (' ' + ONES[n % 10] if n % 10 else ''))


def words(n):
    """Indian system: 8714000 -> 'Rupees Eighty Seven Lakhs Fourteen Thousand Only'."""
    n = int(round(float(n or 0)))
    if n == 0:
        return 'Rupees Zero Only'
    parts = []
    for size, name in ((10000000, 'Crore'), (100000, 'Lakh'), (1000, 'Thousand'), (100, 'Hundred')):
        q, n = divmod(n, size)
        if q:
            label = name + ('s' if q > 1 and name in ('Crore', 'Lakh') else '')
            parts.append(f'{(words(q * 1)[7:-5] if q >= 100 else _two(q))} {label}')
    if n:
        parts.append(_two(n))
    return 'Rupees ' + ' '.join(parts) + ' Only'


def num(v, default=0.0):
    if v is None:
        return default
    m = re.search(r'-?\d[\d,]*\.?\d*', str(v))
    return float(m.group(0).replace(',', '')) if m else default


def ddmmyyyy(v):
    if not v:
        return ''
    if isinstance(v, (int, float)):
        d = dt.datetime.fromtimestamp(v / 1000)
    else:
        s = str(v)
        for fmt in ('%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y'):
            try:
                d = dt.datetime.strptime(s[:10], fmt)
                break
            except ValueError:
                d = None
        if d is None:
            try:
                d = dt.datetime.fromisoformat(s.replace('Z', '+00:00')) + dt.timedelta(hours=5, minutes=30)
            except ValueError:
                return s
    return d.strftime('%d-%m-%Y')


def floor_thousand(n):
    return math.floor(float(n) / 1000) * 1000


def trunc2(x):
    """Cut (not round) to 2 decimals — the valuer's own convention (68.097 -> 68.09)."""
    return math.floor(float(x) * 100) / 100


def rates_for(case, slot, realizable, distress):
    """Realizable / distress share of FMV for this property type, as set in Settings → Banks."""
    pol = ((case.get('bankPolicy') or {}).get(slot) or {})
    r, d = pol.get('realizable'), pol.get('distress')
    if r is None or d is None:
        return realizable, distress
    return float(r) / 100, float(d) / 100


def money(x):
    """Whole rupees, cut not rounded (2.01 x 7,00,000 must give 14,07,000, not 14,06,999)."""
    return int(math.floor(float(x) + 1e-6))


def rs(n):
    return f'Rs {inr(n)}/-'


# ---------------------------------------------------------------- extents
def extent_in_cents(text):
    """'2.83 Cents' / '266.66 Sq.Yds' / '124.62 Sqmts' / '1200 sqft' -> cents (float)."""
    if not text:
        return 0.0
    t = str(text).lower()
    v = num(t)
    if 'cent' in t:
        return v
    if 'yd' in t or 'yard' in t:
        return v / SQYD_PER_CENT
    if 'sqm' in t or 'sq.m' in t or 'sq m' in t or 'metre' in t or 'meter' in t:
        return v / SQM_PER_CENT
    if 'ft' in t or 'feet' in t:
        return v / SQFT_PER_SQM / SQM_PER_CENT
    if 'acre' in t:
        return v * 100
    return v  # bare number: treat as cents


def extent_line(cents, with_yards=True):
    sqm = trunc2(cents * SQM_PER_CENT)
    if with_yards:
        return f'{sqm:.2f} Sqmts (or) {trunc2(cents * SQYD_PER_CENT):.2f} Sqyds (or) {cents:.2f} Cents'
    return f'{sqm:.2f} Sqmts (or) {cents:.2f} Cents'


def gps_dms(lat, lng):
    def one(v, pos, neg):
        a = abs(v)
        d = int(a)
        m = int((a - d) * 60)
        s = (a - d - m / 60) * 3600
        return f"{d}°{m:02d}'{s:04.1f}\"{pos if v >= 0 else neg}"
    return f'{one(lat, "N", "S")} {one(lng, "E", "W")}'


# ---------------------------------------------------------------- defaults (house)
HOUSE_DEFAULTS = {
    'purpose': 'Bank Purpose', 'mvCertificate': 'Copy enclosed', 'tenure': 'Free Hold',
    'areaResidential': 'Yes', 'areaCommercial': '--', 'areaIndustrial': '--', 'areaClass': 'Middle', 'areaUrban': 'Urban',
    'localBodyType': 'Corporation Limits', 'govtEnactments': 'No', 'agriConversion': 'NA', 'occupancy': 'Owners',
    'locality': 'Middle', 'surroundings': 'Residential', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance',
    'levelOfLand': 'Level of Ground', 'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil',
    'layoutApproved': 'Not Approved', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided',
    'roadType': 'Metal Road', 'roadWidth': '20’0” Wide Road', 'landLocked': 'No', 'water': 'Adequate Corporation Tap',
    'sewerage': 'Yes', 'power': 'Provided', 'advantage1': 'Medium demand locality', 'advantage2': ' ',
    'specialRemarks': 'Nil', 'buildingType': 'Residential', 'constructionType': 'Rcc Framed Structure',
    'conditionExterior': 'Good', 'conditionInterior': 'Good', 'planAuthority': 'Municipal Commissioner',
    'planVerified': 'YES', 'planComments': 'NA',
    'specGF_foundation': 'R.C.C Framed Isolated Footing', 'specGF_basement': 'R.R. Stone Masonry',
    'specGF_superstructure': 'Brick Masonry in C.M(1:5)', 'specGF_joinery': 'Teak Wood Frames & Shutters',
    'specGF_rccWorks': 'Rcc Roof', 'specGF_plastering': 'Cement Plastering', 'specGF_flooring': 'Vitrified Tiles',
    'specGF_specialFinish': 'No', 'specGF_roofing': 'NA', 'specGF_drainage': 'Provided',
    **{f'specUpper_{k}': ' ' for k in ('foundation', 'basement', 'superstructure', 'joinery', 'rccWorks',
                                       'plastering', 'flooring', 'specialFinish', 'roofing', 'drainage')},
    'compoundWall': 'Yes', 'cwHeight': '---', 'cwLength': '---', 'cwType': '---',
    'wiring': 'CTS & CONCELED', 'fittingsClass': 'ORDINARY', 'lightPoints': 'ADEQUATE', 'plugPoints': 'PROVIDED',
    'electricalOther': 'MAIN SWITCHES', 'waterClosets': 'NA', 'washBasins': 'NA', 'urinals': '---',
    'bathTubs': '---', 'waterMeter': 'NA', 'otherFixtures': '---', 'place': 'Kadapa', 'district': 'Y.S.R',
    'cityTown': 'Kadapa City',
}

EXTRA_KEYS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'am_parking'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement', 'sv_lift'],
}


# ---------------------------------------------------------------- images
def _ssl_context():
    """Trusted certificates: the system's, or certifi / the OS bundle when Python has none
    (python.org builds on macOS ship without them, which silently blanked the maps)."""
    import ssl
    for cafile in (None, '/etc/ssl/cert.pem', '/etc/ssl/certs/ca-certificates.crt'):
        try:
            if cafile is None:
                import certifi  # noqa: F401
                return ssl.create_default_context(cafile=certifi.where())
            if os.path.exists(cafile):
                return ssl.create_default_context(cafile=cafile)
        except Exception:
            continue
    return ssl.create_default_context()


_SSL = None


def _fetch(url, timeout=12):
    global _SSL
    if _SSL is None:
        _SSL = _ssl_context()
    req = urllib.request.Request(url, headers={'User-Agent': 'GCRValuation/1.0 (valuation reports)'})
    with urllib.request.urlopen(req, timeout=timeout, context=_SSL) as r:
        return r.read()


def local_image(src, temps):
    """Photo reference (uploads URL, data URL, or http URL) -> local file path."""
    if not src:
        return None
    try:
        if src.startswith('data:'):
            import base64
            raw = base64.b64decode(src.split(',', 1)[1])
            fd, p = tempfile.mkstemp(suffix='.img'); os.close(fd)
            open(p, 'wb').write(raw); temps.append(p)
            return p
        m = re.search(r'/uploads/([^?#]+)$', src)
        if m and os.path.exists(os.path.join(UPLOADS, m.group(1))):
            return os.path.join(UPLOADS, m.group(1))
        if os.path.exists(src):
            return src
        if src.startswith('http'):
            raw = _fetch(src)
            fd, p = tempfile.mkstemp(suffix='.img'); os.close(fd)
            open(p, 'wb').write(raw); temps.append(p)
            return p
    except Exception:
        return None
    return None


TILE_CACHE = os.path.abspath(os.path.join(HERE, '..', '..', '.cache', 'map-tiles'))


def _tile(z, x, y):
    """OpenStreetMap tile, kept on disk for 30 days (fast repeat reports; OSM asks clients to cache)."""
    path = os.path.join(TILE_CACHE, str(z), str(x), f'{y}.png')
    try:
        if os.path.exists(path) and (dt.datetime.now().timestamp() - os.path.getmtime(path)) < 30 * 86400:
            with open(path, 'rb') as fh:
                return fh.read()
    except OSError:
        pass
    raw = _fetch(f'https://tile.openstreetmap.org/{z}/{x}/{y}.png')
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'wb') as fh:
            fh.write(raw)
    except OSError:
        pass
    return raw


def site_map(lat, lng, zoom, w, h, temps):
    """Street map around the site with a red pin (OpenStreetMap), saved as PNG."""
    from PIL import Image, ImageDraw
    n = 2 ** zoom
    x = (lng + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    px, py = x * 256, y * 256
    left, top = int(px - w / 2), int(py - h / 2)
    canvas = Image.new('RGB', (w, h), (235, 235, 235))
    for tx in range(left // 256, (left + w) // 256 + 1):
        for ty in range(top // 256, (top + h) // 256 + 1):
            try:
                tile = Image.open(io.BytesIO(_tile(zoom, tx % n, ty)))
                canvas.paste(tile, (tx * 256 - left, ty * 256 - top))
            except Exception:
                pass
    d = ImageDraw.Draw(canvas)
    cx, cy = w // 2, h // 2
    d.ellipse((cx - 14, cy - 40, cx + 14, cy - 12), fill=(229, 57, 53), outline=(255, 255, 255), width=3)
    d.polygon([(cx - 10, cy - 18), (cx + 10, cy - 18), (cx, cy)], fill=(229, 57, 53))
    d.ellipse((cx - 5, cy - 31, cx + 5, cy - 21), fill=(255, 255, 255))
    d.rectangle((0, h - 18, 210, h), fill=(255, 255, 255))
    d.text((4, h - 16), '© OpenStreetMap contributors', fill=(90, 90, 90))
    fd, p = tempfile.mkstemp(suffix='.png'); os.close(fd)
    canvas.save(p); temps.append(p)
    return p


# ---------------------------------------------------------------- HOUSE
def build_house(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = dict(HOUSE_DEFAULTS)

    father = case.get('clientFatherName') or ''
    owner = title_for(case.get('clientName') or '', father)
    insp = ddmmyyyy(case.get('inspectionDate')) or ddmmyyyy(case.get('createdAt'))
    report_date = ddmmyyyy(rep.get('reportDate')) or ddmmyyyy(dt.date.today().isoformat())
    door = pd.get('doorNo') or ''
    survey = pd.get('surveyNo') or ''
    plot = pd.get('plotNo') or ''
    plan_no = pd.get('approvalPlanNo') or ''
    plan_dt = ddmmyyyy(pd.get('approvalPlanDate')) if pd.get('approvalPlanDate') else ''

    f.update({
        'fileNo': case.get('fileNumber') or case.get('id'),
        'bankBranchUpper': (case.get('bankBranch') or '').upper() or '---',
        'reportDate': report_date, 'valuationDate': report_date, 'inspectionDate': insp,
        'ownerName': owner, 'ownerRelation': father if father else '', 'ownerAddress': case.get('address') or '',
        'deedNo': pd.get('deedNo') or '', 'doorNo': door, 'surveyNo': survey, 'plotNo': plot,
        'planNo': plan_no, 'planDate': plan_dt,
        'saleDeedLine': f"Deed No:{pd.get('deedNo') or '---'}, Dt :{ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---'}",
        'planLine': f'B.A. No : {plan_no},   Dt : {plan_dt}' if plan_no else 'NA',
        'surveyLine': f'Survey No : {survey},' if survey else '---',
        'doorLine': f'Door No : {door}' if door else '---',
        'district': case.get('bankDistrict') or HOUSE_DEFAULTS['district'],
    })
    if rep.get('ownerRelation') is None and father and not re.match(r'^(s|w|d)/o', father.strip(), re.I):
        f['ownerRelation'] = f'S/o {father}'

    # Boundaries
    for side, key in (('East', 'east'), ('West', 'west'), ('North', 'north'), ('South', 'south')):
        f[f'bdDeed{side}'] = (pd.get('boundariesDoc') or {}).get(key) or ''
        f[f'bdActual{side}'] = (pd.get('boundariesActual') or {}).get(key) or f[f'bdDeed{side}']

    # Land
    deed_cents = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_cents = extent_in_cents(rep.get('netExtentPlanRaw') or pd.get('netExtent'))
    considered = min(c for c in (deed_cents, plan_cents) if c) if (deed_cents or plan_cents) else 0
    f.update({
        'extentDeed': extent_line(deed_cents), 'extentActual': extent_line(deed_cents),
        'extentSite': extent_line(deed_cents), 'totalExtent': extent_line(deed_cents),
        'sizeNorthSouth': extent_line(deed_cents), 'sizeEastWest': extent_line(deed_cents),
        'netExtentPlan': extent_line(plan_cents, with_yards=False),
        'extentConsidered': extent_line(considered, with_yards=False),
        'netExtentShort': f'{considered:.2f} Cents',
        'plotShape': f.get('landShape'),
    })
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land_value = considered * rate_cent
    guide_yd = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    f.update({
        'marketRateLine': f'Rs {inr(rate_cent)}/- Per Cent',
        'guidelineRateLine': f'Rs {inr(guide_yd)}/- Sqyds' if guide_yd else '---',
        'adoptedRateLine': f'{considered:.2f} Cent X Rs  {inr(rate_cent)}/- Cent',
        'landValueLine': rs(land_value),
    })

    # Building
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    year = rep.get('yearOfConstruction') or (str(dt.date.today().year - age) if age else '---')
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    rate_sft = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2500
    floors_src = (pd.get('siteValue') or {}).get('floors') or []
    floors, total_net, plinth_lines = [], 0, []
    short = {'ground': 'GF', 'first': 'FF', 'second': 'SF', 'third': 'TF'}
    for fl in floors_src:
        area = num(fl.get('value'))
        if not area:
            continue
        label = fl.get('label') or 'Floor'
        repl = area * rate_sft
        dep = repl * dep_pct / 100
        net = repl - dep
        total_net += net
        floors.append({'label': label, 'plinth': f'{area:.2f} Sqft', 'height': rep.get('floorHeight') or '10’',
                       'age': f'{age} / Years', 'rate': f'Rs {int(rate_sft)}/-', 'replacement': rs(repl),
                       'depreciation': f'Rs (-{dep_pct:g}%) {inr(dep)}/-', 'net': rs(net)})
        code = next((v for k, v in short.items() if k in label.lower()), label)
        plinth_lines.append(f'{code}  = {trunc2(area / SQFT_PER_SQM):.2f} Sqmts (or) {area:.2f} Sqfts')
    f.update({
        'yearOfConstruction': year, 'ageLine': f'{age:02d} Years', 'remainingLifeLine': f'{max(life - age, 0)} Years',
        'totalLifeLine': f'{life} Years',
        'floorsLine': ' + '.join(short.get(next((k for k in short if k in (x.get('label') or '').lower()), ''), x.get('label') or '') for x in floors_src if num(x.get('value'))) or '---',
        'plinthPlan': '\n'.join(plinth_lines) or '---', 'plinthActual': '\n'.join(plinth_lines) or '---',
        'carpetPlan': rep.get('carpetArea') or '---', 'carpetActual': rep.get('carpetArea') or '---',
        'buildingTotalLine': f'RS {inr(total_net)}/-',
    })

    # Parts C–F
    part_totals = {}
    for part, keys in EXTRA_KEYS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = rs(v) if v else '---'
        part_totals[part] = tot
        f[part] = rs(tot) if tot else '---'

    total = land_value + total_net + sum(part_totals.values())
    fmv = floor_thousand(total)
    r_pct, d_pct = rates_for(case, 'house', 0.90, 0.80)
    realizable = floor_thousand(fmv * r_pct)
    f['realizablePct'], f['distressPct'] = f'{r_pct * 100:g}', f'{d_pct * 100:g}'
    distress = floor_thousand(fmv * d_pct)
    f.update({
        'absA': f'Rs.  {inr(land_value)}/-', 'absB': f'Rs.  {inr(total_net)}/-',
        'absC': f'Rs.  {inr(part_totals["partC"])}/-' if part_totals['partC'] else 'Rs.  0.00',
        'absD': f'Rs.  {inr(part_totals["partD"])}/-' if part_totals['partD'] else 'Rs.  0.00',
        'absE': f'Rs.  {inr(part_totals["partE"])}/-' if part_totals['partE'] else 'Rs.  0.00',
        'absF': f'Rs.  {inr(part_totals["partF"])}/-' if part_totals['partF'] else 'Rs.  0.00',
        'absTotal': f'Rs.  {inr(total)}/-', 'absSayAs': f'Rs   {inr(fmv)}/-',
        'fmv': inr(fmv), 'fmvWords': words(fmv), 'fmvWordsUpper': words(fmv).upper(),
        'fmvLine': f'Rs  {inr(fmv)}/-', 'realizable': inr(realizable), 'realizableWords': words(realizable),
        'realizableLine': f'Rs  {inr(realizable)}/-', 'distress': inr(distress), 'distressWords': words(distress),
        'distressLine': f'Rs  {inr(distress)}/-', 'bookValue': inr(num(rep.get('bookValue'))) if rep.get('bookValue') else '---',
    })

    # Location text
    village = rep.get('village') or ''
    ward_no = rep.get('wardNo') or pd.get('wardNo') or ''
    landmark = rep.get('landmark') or ''
    ward = ', '.join(x for x in [f'Ward No :- {ward_no}' if ward_no else '', landmark] if x)
    local_body = rep.get('localBody') or f'Kadapa Municipal Corporation Of {f["district"]} (Dt).'
    postal = rep.get('postalAddress') or ', '.join(x for x in [
        f'In Site Survey No : {survey}' if survey else '', f'Door No  : {door}' if door else '',
        f'Plot No  : {plot}' if plot else '', ward.replace(':-', ':'), f'{village} At {local_body.rstrip(".")}' if village else local_body.rstrip('.')] if x) + '.'
    f.update({
        'village': village or '---', 'wardLine': ward or '---', 'mandalDistrict': local_body,
        'wardNo': ward_no or '---', 'landmark': landmark or '---', 'localBody': local_body,
        'postalAddress': postal, 'localBodyUpper': local_body.upper(),
        'declBackground': f'{considered:.2f} Cents of freehold land belonging to the client. This House bearing {postal}',
        'declPurpose': f'For collateral security.  The Manager, A.P.G.B, {case.get("bankBranch") or "---"}, {f["district"]} (Dt).',
        'declDates1': f'Date of appointment: {ddmmyyyy(case.get("createdAt")) or insp},',
        'declDates2': f'Valuation date  : {report_date},', 'declDates3': f'Date of report  : {report_date}.',
    })

    # GPS + maps
    lat = num(rep.get('latitude') or (case.get('currentLocation') or {}).get('lat'), None) if (rep.get('latitude') or (case.get('currentLocation') or {}).get('lat')) else None
    lng = num(rep.get('longitude') or (case.get('currentLocation') or {}).get('lng'), None) if (rep.get('longitude') or (case.get('currentLocation') or {}).get('lng')) else None
    images = {}
    if lat is not None and lng is not None:
        f['latitude'] = f'{lat:.6f}'
        f['longitude'] = f'{lng:.6f}'
        f['gpsDecimal'] = f'{lat:.6f}, {lng:.6f}'
        f['gpsDms'] = gps_dms(lat, lng)
        try:
            if not case.get('_valuesOnly'):
                images['areaMap'] = site_map(lat, lng, 15, 1300, 900, temps)
                images['map1'] = site_map(lat, lng, 17, 1400, 1014, temps)
        except Exception:
            pass
    else:
        for k in ('latitude', 'longitude', 'gpsDecimal', 'gpsDms'):
            f[k] = '---'

    photos = [] if case.get('_valuesOnly') else [p for p in (local_image(s, temps) for s in (case.get('sitePhotos') or [])) if p]
    for i, p in enumerate(photos[:12]):
        images[f'photo{i + 1}'] = p
    sig = local_image(case.get('signatureDataUrl'), temps)
    if sig:
        images['signature'] = sig

    # Anything typed for this format overrides the computed/default value
    # (raw inputs such as dates and extents were already converted above)
    RAW_INPUTS = {'reportDate', 'extentDeedRaw', 'netExtentPlanRaw', 'marketRatePerCent', 'guidelineRatePerSqyd',
                  'constructionRate', 'totalLife', 'depreciationPerYear', 'bookValue', 'latitude', 'longitude'}
    for k, v in rep.items():
        if k not in RAW_INPUTS and not FORMATTED_INPUT.match(k) and v not in (None, ''):
            f[k] = v
    return {'fields': f, 'rows': {'fl': floors}, 'images': images}


# ---------------------------------------------------------------- shared pieces (apartment / land formats)
ORDINALS = ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth',
            'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth']


def floor_word(v):
    s = str(v or '').strip()
    if not s:
        return '---'
    if re.fullmatch(r'\d+', s):
        n = int(s)
        return ORDINALS[n] if n < len(ORDINALS) else f'{n}th'
    if s.lower() in ('g', 'gf', 'ground'):
        return 'Ground'
    return re.sub(r'\s*floor\s*$', '', s, flags=re.I).title()


def title_for(name, relation):
    """'Sri' / 'Smt' (W/o) / 'Kum' (D/o) in front of the owner's name unless it already has one."""
    name = (name or '').strip()
    if not name or re.match(r'^(sri|smt|kum|ms|mrs|mr|m/s|dr)\b\.?', name, re.I):
        return name
    rel = (relation or '').strip().lower()
    return ('Smt ' if rel.startswith('w/o') else 'Kum ' if rel.startswith('d/o') else 'Sri ') + name


def owner_bits(case, rep):
    father = (case.get('clientFatherName') or '').strip()
    owner = title_for(case.get('clientName') or '', father)
    rel = father
    if father and not re.match(r'^(s|w|d|c)/o', father, re.I):
        rel = 'S/o ' + (father if re.match(r'^(sri|smt|late)\b', father, re.I) else 'Sri ' + father)
    return owner, rel


def site_choices(f, pd):
    """Step 3 choices (road type, plot type, road width, flooring, structure) in the bank's wording."""
    road = (pd.get('roadType') or '').strip()
    if road:
        r = road.lower()
        f['roadType'] = ('CC Road' if 'cc' in r else 'BT Road' if r.startswith('bt') or 'bitum' in r else
                         'Metal Road' if 'metal' in r else 'WBM Road' if 'wbm' in r else
                         'Mud / Gravel Road' if 'mud' in r or 'gravel' in r else road)
    plot = (pd.get('plotType') or '').lower()
    if plot:
        f['cornerPlot'] = ('Corner Plot' if 'corner' in plot else 'Intermittent Plot' if 'interm' in plot else
                           'Road Facing Plot' if 'road' in plot else pd['plotType'])
    width = str(pd.get('roadWidth') or '').strip()
    if width:
        m = re.fullmatch(r'(\d+(?:\.\d+)?)\s*(ft|feet|fts|’|\')?', width, re.I)
        f['roadWidth'] = f'{m.group(1)}’0” Wide Road' if m else (width if re.search(r'road', width, re.I) else f'{width} Wide Road')
    floor = (pd.get('flooringType') or '').strip()
    if floor:
        f['specGF_flooring'] = f['specFlooring'] = floor
    struct = (pd.get('structureType') or '').strip()
    if struct:
        word = 'RCC Framed Structure' if 'frame' in struct.lower() else ('Load Bearing Structure' if 'load' in struct.lower() else struct)
        f['constructionType'] = f['structure'] = word


def common_fields(case, rep, defaults):
    f = dict(defaults)
    pd = case.get('propertyDetails') or {}
    owner, rel = owner_bits(case, rep)
    insp = ddmmyyyy(case.get('inspectionDate')) or ddmmyyyy(case.get('createdAt'))
    report_date = ddmmyyyy(rep.get('reportDate')) or ddmmyyyy(dt.date.today().isoformat())
    plan_no = pd.get('approvalPlanNo') or ''
    plan_dt = ddmmyyyy(pd.get('approvalPlanDate')) if pd.get('approvalPlanDate') else ''
    district = case.get('bankDistrict') or defaults.get('district') or 'Y.S.R'
    f.update({
        'fileNo': case.get('fileNumber') or case.get('id'),
        'bankBranchUpper': (case.get('bankBranch') or '').upper() or '---',
        'reportDate': report_date, 'valuationDate': report_date, 'inspectionDate': insp,
        'ownerName': owner, 'ownerRelation': rel, 'ownerAddress': case.get('address') or '',
        'deedNo': pd.get('deedNo') or '', 'doorNo': pd.get('doorNo') or '', 'surveyNo': pd.get('surveyNo') or '',
        'plotNo': pd.get('plotNo') or '', 'planNo': plan_no, 'planDate': plan_dt,
        'planLine': f'B.A.NO : {plan_no}   Dt : {plan_dt}' if plan_no else 'NA',
        'saleDeedLine': f"Deed No.{pd.get('deedNo') or '---'}, Dt: {ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---'}",
        'district': district, 'placeUpper': (rep.get('place') or defaults.get('place') or '').upper(),
        'assessmentNo': pd.get('assessmentNo') or '---',
        'declDates1': f'Date of appointment : {ddmmyyyy(case.get("createdAt")) or insp},',
        'declDates2': f'Valuation date   : {report_date}, ', 'declDates3': f'Date of report   : {report_date}.',
    })
    site_choices(f, pd)
    for side, key in (('East', 'east'), ('West', 'west'), ('North', 'north'), ('South', 'south')):
        f[f'bdDeed{side}'] = (pd.get('boundariesDoc') or {}).get(key) or ''
        f[f'bdActual{side}'] = (pd.get('boundariesActual') or {}).get(key) or f[f'bdDeed{side}']
    return f


def geo_and_photos(case, rep, f, temps, max_photos):
    loc = case.get('currentLocation') or {}
    lat_src = rep.get('latitude') or loc.get('lat')
    lng_src = rep.get('longitude') or loc.get('lng')
    images = {}
    if case.get('_valuesOnly'):          # figures only (values.py): no maps or photos
        lat_src = lng_src = None
    if lat_src not in (None, '') and lng_src not in (None, ''):
        lat, lng = num(lat_src), num(lng_src)
        f.update({'latitude': f'{lat:.6f}', 'longitude': f'{lng:.6f}', 'gpsDecimal': f'{lat:.6f}, {lng:.6f}',
                  'gpsDms': gps_dms(lat, lng)})
        try:
            images['areaMap'] = site_map(lat, lng, 15, 1300, 900, temps)
            images['map1'] = site_map(lat, lng, 17, 1400, 1014, temps)
        except Exception:
            pass
    else:
        for k in ('latitude', 'longitude', 'gpsDecimal', 'gpsDms'):
            f[k] = '---'
    photos = [] if case.get('_valuesOnly') else [p for p in (local_image(s, temps) for s in (case.get('sitePhotos') or [])) if p]
    for i, p in enumerate(photos[:max_photos]):
        images[f'photo{i + 1}'] = p
    sig = local_image(case.get('signatureDataUrl'), temps)
    if sig:
        images['signature'] = sig
    return images


RAW_INPUTS = {'reportDate', 'extentDeedRaw', 'netExtentPlanRaw', 'marketRatePerCent', 'guidelineRatePerSqyd',
              'constructionRate', 'totalLife', 'depreciationPerYear', 'bookValue', 'latitude', 'longitude',
              'udsDeedRaw', 'udsPlanRaw', 'parentExtentDeedRaw', 'parentExtentPlanRaw', 'landRatePerSqyd',
              'plinthArea', 'carpetArea', 'taxAmount', 'carParkingValue', 'additions', 'ratePerAcre', 'ratePerCent', 'guidelineRatePerAcre'}


# Typed amounts (extra items, amenities, services…) and names that the builder formats itself
FORMATTED_INPUT = re.compile(r'^((ex|am|mi|sv|x)_\w+|owner\d(Name|Rel|Addr)|ownerLine\d|(cn|cs)_\w+|buildings|devAmounts|items|applicant\d?(Name|Rel|Addr)|sayValue|fee|deed2Date|plan2Date|pw\d+)$')


def apply_overrides(f, rep):
    for k, v in rep.items():
        if k in RAW_INPUTS or FORMATTED_INPUT.match(k):
            continue
        if v not in (None, '') and not isinstance(v, (list, dict)):
            f[k] = v


def sqft_of(text):
    """'1475 sqft' / '137 sqm' / '163 sqyd' -> square feet."""
    t = str(text or '').lower()
    v = num(t)
    if 'yd' in t or 'yard' in t:
        return v * 9
    if 'sqm' in t or 'sq.m' in t or 'metre' in t or 'meter' in t:
        return v * SQFT_PER_SQM
    return v


def site_extent_line(raw):
    """Parent site extent as the APGB apartment sample prints it: Sqmt (or) Sqfts (or) Cents."""
    if not raw:
        return '---', 0.0
    t = str(raw).lower()
    v = num(t)
    if 'ft' in t or 'feet' in t:
        sqft = v
        sqm = v / SQFT_PER_SQM
        cents = sqm / SQM_PER_CENT
    else:
        cents = extent_in_cents(raw)
        sqm = cents * SQM_PER_CENT
        sqft = sqm * SQFT_PER_SQM
    return f'{trunc2(sqm):.2f} Sqmt (or) {trunc2(sqft):.2f} Sqfts (or) {cents:.2f} Cents', cents


# ---------------------------------------------------------------- APARTMENT
APARTMENT_DEFAULTS = {
    'purpose': 'Bank Purpose', 'mvCertificate': 'Copy enclosed', 'tenure': 'Free Hold', 'ownerRole': 'Applicant',
    'deedLabel': 'Sale Deed No', 'cityTown': 'Kadapa City', 'areaResidential': 'Yes', 'areaCommercial': '--',
    'areaIndustrial': '--', 'areaClass': 'Middle', 'areaUrban': 'Urban', 'localBodyType': 'Corporation Limits',
    'govtEnactments': 'No', 'agriConversion': 'NA', 'occupancy': 'Owner', 'aptNature': 'Residential',
    'localityType': 'Residential', 'structure': 'R.C.C. Framed', 'quality': 'Good', 'appearance': 'Good',
    'maintenance': 'Good', 'facilities': 'Yes', 'lift': 'Yes', 'protectedWater': 'Yes', 'sewerage': '--',
    'carParkingType': 'Open', 'compoundWall': 'Yes', 'pavement': 'Yes', 'specRoof': 'R.C.C Roof',
    'specFlooring': 'Tiles', 'specDoors': 'Wooden Doors', 'specWindows': 'Upvc Windows', 'specFittings': 'Yes',
    'specFinishing': 'Tiles', 'houseTax': 'Yes', 'electricityNo': 'NA', 'meterName': 'NA', 'flatMaintenance': 'Good',
    'flatClass': 'I Class', 'usage': 'Residential', 'monthlyRent': '---', 'marketability': 'Good',
    'advantages': 'It Is Good Residential Area,  All Civic Amenities Are Very Near To In this Property, Like School, Colleges, Apartments, etc.,',
    'negatives': 'No', 'comparableRate': '-----', 'guidelineNote': 'Copy Enclosed', 'buildingStatus': 'Finished',
    'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa', 'deprRatio': ' ',
    'x_superfine': '--', 'x_wardrobes': '--', 'x_showcases': '--', 'x_grills': '--', 'x_potential': '--',
    'x_others': '--', 'x_kitchen': ' ', 'x_interior': ' ', 'x_electrical': ' ',
}

# Additions estimate page: slot -> words that identify the item, and how the sample prints its rate
ADDITION_SLOTS = [('show ?case|showcase', 'dec'), ('ward ?robe', 'dec'), ('rack', None), ('plat ?form|plot ?form', None),
                  ('pop|false ceiling', None), ('grill', None), ('tile', 'plain'), ('sanitary', 'plain'), ('paint', 'plain')]


def build_apartment(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, APARTMENT_DEFAULTS)

    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = floor_word(rep.get('floorName') or pd.get('floorNo'))
    door, survey = f['doorNo'], f['surveyNo']
    village = rep.get('village') or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    landmark = rep.get('landmark') or '---'
    lb_name = rep.get('localBodyName') or APARTMENT_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb_name} of  {f["district"]} (Dt).'
    postal = rep.get('postalAddress') or (f'In Site Door No : {door}, (Survey No.’s : {survey}), {landmark}, '
                                          f'{village} Village Field  At  {local_body}')
    f.update({
        'aptName': rep.get('aptName') or pd.get('apartmentName') or '---',
        'builderName': pd.get('builderName') or '---', 'partnerName': pd.get('managingPartner') or '---',
        'partnerRelation': rep.get('partnerRelation') or ' ',
        'flatNo': flat, 'floorName': floor, 'village': village, 'wardNo': ward, 'landmark': landmark,
        'localBodyName': lb_name, 'localBody': local_body,
        'localBodyUpper': rep.get('localBodyUpper') or f'{lb_name.upper()} {f["district"]} (Dt).',
        'postalAddress': postal,
        'flatLocationLine': f' Flat No :- {flat}, ({floor} Floor),  Door No : {door},',
        'surveyLine': f'Survey No :- {survey},', 'wardVillageLine': f' Ward No:-{ward}, {village}  Village Field,',
        'floorLine': f'{floor}  Floor', 'flatNoLine': f'Flat No : {flat}, ',
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'unitsLine': f"{rep.get('dwellingUnits')}  Flats" if rep.get('dwellingUnits') else '---',
        'deedExecutant': rep.get('deedExecutant') or f['ownerName'],
        'deedExecutantRelation': rep.get('deedExecutantRelation') or f['ownerRelation'],
        'taxPaidName': rep.get('taxPaidName') or f['ownerName'],
        'taxAmountLine': f"Rs.  {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '---',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    # Land: the flat's undivided share (UDS) of the site
    site_line, site_cents = site_extent_line(rep.get('parentExtentDeedRaw'))
    plan_parent = extent_in_cents(rep.get('parentExtentPlanRaw')) or site_cents
    uds_deed = extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_plan = extent_in_cents(rep.get('udsPlanRaw')) or uds_deed
    uds = min(x for x in (uds_deed, uds_plan) if x) if (uds_deed or uds_plan) else 0
    uds_yd = trunc2(uds * SQYD_PER_CENT)
    rate_yd = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    land = money(uds_yd * rate_yd)
    f.update({
        'extentDeed': site_line, 'extentActual': site_line, 'extentSite': site_line,
        'udsDeed': f'{uds_deed:.2f}', 'udsPlan': f'{uds_plan:.2f}',
        'parentExtentDeed': f'{site_cents:.2f}', 'parentExtentPlan': f'{plan_parent:.2f}',
        'extentConsidered': f'{uds_yd:.2f} Sqyds (or) {uds:.2f} Cents',
        'udsDeedDims': f'{trunc2(uds_deed * SQYD_PER_CENT):.2f} Sqyds (or) {uds_deed:.2f} Cents',
        'udsPlanDims': f'{uds_plan:.2f} Cents (Out Of {plan_parent:.2f} Cents)',
        'udsLine': f'{uds_yd:.2f} Sqyds (or)  {uds:.2f}   CENTS (As Per Plan)',
        'landCalc1': f'= {uds_yd:.2f} Sqyds x Rs {inr(rate_yd)}/- Sqyds',
        'landCalc2': f'= Rs {inr(land)}/-',
    })

    # Flat (building)
    plinth = sqft_of(rep.get('plinthArea')) or num((pd.get('siteValue') or {}).get('plinthArea')) or \
        sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = sqft_of(rep.get('carpetArea')) or plinth * 0.85
    rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2250
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = money(plinth * rate)
    net = money(bld - bld * dep_pct / 100)
    composite = net + land
    status = rep.get('buildingStatus') or APARTMENT_DEFAULTS['buildingStatus']
    f.update({
        'buildingStatus': status,
        'yearOfConstruction': rep.get('yearOfConstruction') or (str(dt.date.today().year - age) if age else
                                                                ('Under Construction' if 'semi' in status.lower() else 'New Construction')),
        'plinth': f'{plinth:.2f}', 'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'buildingCalc1': f'Building = {plinth:.2f} Sqft x Rs {rate:.2f}  = ', 'buildingCalc2': f'Rs {inr(bld)}/-',
        'deprRate': f'{dep_pct:.2f}', 'replacementLine': f'Rs {inr(bld)}/-',
        'ageLine': f'{age} Years' if age else '0.00',
        'remainingLifeLine': f'{max(life - age, 0)} Years' if age else 'New One', 'totalLifeLine': str(life),
        'deprValueLine': f'Rs {inr(net)}/-', 'deprBuildingLine': f'Rs  {inr(net)}/-',
        'landValueLine': f'Rs  {inr(land)}/-', 'compositeLine': f'Rs  {inr(composite)}/-',
    })
    if dep_pct:
        f['deprRatio'] = f'{dep_pct:g} %'

    # Extra items in the valuation table
    extras = 0
    car = num(rep.get('carParkingValue'))
    f['x_carParking'] = rs(car) if car else '--'
    extras += car
    for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_electrical',
              'x_grills', 'x_potential', 'x_others'):
        v = num(rep.get(k + 'Value'))
        if v:
            f[k] = rs(v)
            extras += v
    total = composite + extras
    fmv = floor_thousand(total)
    r_pct, d_pct = rates_for(case, 'apartment', 0.85, 0.75)
    realizable = floor_thousand(fmv * r_pct)
    f['realizablePct'], f['distressPct'] = f'{r_pct * 100:g}', f'{d_pct * 100:g}'
    distress = floor_thousand(fmv * d_pct)
    f.update({
        'grandTotalLine': f'Rs {inr(total)}/-', 'sayLine': f'Say Rs {inr(fmv)}/-',
        'fmv': inr(fmv), 'fmvWords': words(fmv), 'fmvWordsUpper': words(fmv).upper(),
        'realizable': inr(realizable), 'realizableWords': words(realizable),
        'distress': inr(distress), 'distressWords': words(distress),
        'declBackground': f'1) {uds:.2f} Cents of freehold land belonging to the client. This Flat bearing Flat No : {flat}, {postal}',
        'declPurpose': f'For collateral security.  The Manager, APGB, {case.get("bankBranch") or "---"}, {f["district"]} (Dt).',
    })

    # Proposed additions (separate estimate page)
    adds = rep.get('additions') or [a for a in (pd.get('additionsWork') or []) if a]
    drop = []
    if adds:
        used, ad_total = set(), 0
        for a in adds:
            desc = (a.get('description') or '').lower()
            slot = next((i for i, (pat, _) in enumerate(ADDITION_SLOTS) if i not in used and re.search(pat, desc)), None)
            if slot is None:
                slot = next((i for i in range(len(ADDITION_SLOTS)) if i not in used), None)
            if slot is None:
                continue
            used.add(slot)
            amt = num(a.get('amount')) or num(a.get('rate')) * (num(a.get('quantity')) or 1)
            ad_total += amt
            n = slot + 1
            style = ADDITION_SLOTS[slot][1]
            f[f'ad{n}_qty'] = str(a.get('quantity') or '1')
            f[f'ad{n}_rate'] = (inr(num(a.get('rate'))) + ('.00' if style == 'dec' else '')) if a.get('rate') else '--'
            f[f'ad{n}_amt'] = inr(amt) + '.00'
        for n in range(1, len(ADDITION_SLOTS) + 1):
            for k in ('qty', 'rate', 'amt'):
                f.setdefault(f'ad{n}_{k}', '--')
        f.update({'adTotal': inr(ad_total), 'adWordsUpper': words(ad_total).upper()})
    else:
        drop.append('additions')

    images = geo_and_photos(case, rep, f, temps, 4)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images, 'drop': drop}


# ---------------------------------------------------------------- OPEN SITE
OPEN_SITE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'cityTown': 'City', 'areaResidential': 'Yes',
    'areaCommercial': 'NA', 'areaIndustrial': 'NA', 'areaClass': 'Middle', 'areaUrban': 'Urban',
    'localBodyType': 'Municipal Corporation', 'govtEnactments': '--', 'agriConversion': 'No', 'occupancy': 'N.A',
    'locality': 'Middle', 'surroundings': 'Residential', 'possibility': 'No', 'civicAmenities': 'At  Walkable Distance',
    'levelOfLand': 'Level of Ground', 'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil',
    'layoutApproved': 'NA', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road',
    'roadWidth': 'Below 20’0” Wide Road', 'landLocked': 'No', 'water': 'Available', 'sewerage': 'Open Area',
    'power': 'Provided', 'specialRemarks': 'Nil', 'siteType': 'Residential Vacant Site',
    'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa', 'pinCode': '---',
}


def yd_line(cents, raw=None):
    """'115.69 Sqyds (or) 96.82 Sqmts (or) 2.39 Cents' — an extent typed in Sqyds is printed as typed."""
    t = str(raw or '').lower()
    yd = num(t) if raw and ('yd' in t or 'yard' in t) else trunc2(cents * SQYD_PER_CENT)
    return f'{yd:.2f} Sqyds (or) {trunc2(cents * SQM_PER_CENT):.2f} Sqmts (or) {cents:.2f} Cents'


def build_open_site(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, OPEN_SITE_DEFAULTS)
    door, survey = f['doorNo'], f['surveyNo']
    plot = pd.get('plotNo') or ''
    lb_name = rep.get('localBodyName') or OPEN_SITE_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb_name} Of {f["district"]} (Dt).'
    landmark = rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    f.update({
        'plotLine': f'Plot No : {plot}' if plot else 'Plot No : ---',
        'village': village, 'wardNo': rep.get('wardNo') or pd.get('wardNo') or '---', 'landmark': landmark,
        'localBodyName': lb_name, 'localBody': local_body, 'localBodyLine': f'{lb_name}, {f["district"]} (Dt).',
        'planLine': f'B.A. No : {f["planNo"]}, Date : {f["planDate"]}' if f['planNo'] else 'NA',
        'saleDeedLine': f"Deed No: {pd.get('deedNo') or '---'}, Dt : {ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---'}.",
        'planNo': f['planNo'] or '---', 'planDate': f['planDate'] or '---',
    })
    for side in ('East', 'West', 'North', 'South'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']

    deed_raw = rep.get('extentDeedRaw') or pd.get('netExtent')
    plan_raw = rep.get('netExtentPlanRaw') or deed_raw
    deed_c, plan_c = extent_in_cents(deed_raw), extent_in_cents(plan_raw)
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    deed_line = yd_line(deed_c, deed_raw)
    plan_line = yd_line(plan_c, plan_raw)
    cons_line = plan_line if considered == plan_c else deed_line
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide_yd = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = money(considered * rate_cent)
    fmv = floor_thousand(land)
    r_pct, d_pct = rates_for(case, 'openSite', 0.90, 0.80)
    realizable = floor_thousand(fmv * r_pct)
    f['realizablePct'], f['distressPct'] = f'{r_pct * 100:g}', f'{d_pct * 100:g}'
    distress = floor_thousand(fmv * d_pct)
    f.update({
        'extentDeed': deed_line, 'extentActual': deed_line, 'totalExtent': deed_line,
        'sizeNorthSouth': deed_line, 'sizeEastWest': deed_line, 'netExtentPlan': plan_line,
        'extentConsidered': cons_line, 'consideredCents': f'{considered:.2f}',
        'marketRateLine': f'Rs {inr(rate_cent)}/- Cent',
        'guidelineRateLine': f' Rs {inr(guide_yd)}/- Sqyd ' if guide_yd else '---',
        'adoptedRateLine': f' Rs {inr(rate_cent)}/- Cent  X  {considered:.2f} Cent',
        'landValueLine': f'Rs {inr(land)}/-', 'absA': f'Rs. {inr(land)}/-', 'absTotal': f'Rs. {inr(land)}/-',
        'absSayAs': f'Rs. {inr(fmv)}/-',
        'fmv': inr(fmv), 'fmvWords': words(fmv), 'fmvWordsUpper': words(fmv).upper(),
        'realizable': inr(realizable), 'realizableWords': words(realizable),
        'distress': inr(distress), 'distressWords': words(distress),
        'advantage1': rep.get('advantage1') or (f'It is In {landmark}' if rep.get('landmark') else 'Medium demand locality'),
        'declBackground': (f'{considered:.2f} Cents of freehold land belonging to the client. The land bearing At Site '
                           f'Survey No : {survey}, Door No : {door},  Ward No : {f["wardNo"]}, In {landmark}, '
                           f'{village} Village Field At {local_body}'),
        'declPurpose': f'For collateral security.  The Manager, A.P.G.B, {case.get("bankBranch") or "---"}, {f["district"]}. (Dt).',
    })
    images = geo_and_photos(case, rep, f, temps, 6)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- OPEN AGRICULTURE LAND
AGRI_DEFAULTS = {
    'purpose': 'Bank Purpose', 'mvCertificate': 'Copy enclosed', 'tenure': 'Free Hold', 'cityTown': 'Kadapa City',
    'areaResidential': '--', 'areaCommercial': '--', 'areaIndustrial': '--', 'areaAgriculture': 'Yes',
    'areaClass': 'Middle', 'areaUrban': 'Urban', 'localBodyType': 'Municipal Corporation Limits',
    'govtEnactments': 'No', 'agriConversion': 'NA', 'occupancy': 'Agriculture Land, ', 'locality': 'Medium',
    'surroundings': 'Agriculture', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance',
    'levelOfLand': 'Level of Ground', 'landShape': 'Rectangular', 'landUse': 'Agriculture', 'usageRestriction': 'Nil',
    'layoutApproved': 'Not Approved', 'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided',
    'roadType': 'Metal  Road', 'roadWidth': 'Below 15’0” Wide Road', 'landLocked': 'No', 'water': 'Na',
    'sewerage': 'Na', 'power': 'Provided', 'advantage1': 'Medium demand locality', 'specialRemarks': 'Nil',
    'landType': 'Agriculture Land', 'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R',
    'place': 'Kadapa',
}
SQYD_PER_ACRE = 4840


def acres_of(raw):
    """'Ac 1.20 Cents' / '1.20 Acres' -> 1.20;  '120 Cents' -> 1.20;  '5808 Sqyds' -> 1.20."""
    if not raw:
        return 0.0
    t = str(raw).lower()
    if re.search(r'\bac\b|acre', t):
        return num(t)
    return extent_in_cents(raw) / 100


def build_agriculture(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = common_fields(case, rep, AGRI_DEFAULTS)
    survey = f['surveyNo']
    lb_name = rep.get('localBodyName') or AGRI_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb_name} of {f["district"]} (Dt).'
    landmark = rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    postal = rep.get('postalAddress') or (f'In Site Survey No : {survey}, In {landmark},  {village} Village Field '
                                          f'At {local_body}')
    f.update({
        'khathaNo': pd.get('khathaNo') or rep.get('khathaNo') or '---', 'village': village, 'landmark': landmark,
        'localBodyName': lb_name, 'localBody': local_body, 'postalAddress': postal,
        'localBodyUpper': rep.get('localBodyUpper') or f'{lb_name.upper()} {f["district"]} (Dt).',
        'saleDeedLine': f"Deed No : {pd.get('deedNo') or '---'}, Dt: {ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---'}.",
    })
    deed_ac = acres_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    actual_ac = acres_of(rep.get('netExtentPlanRaw')) or deed_ac
    considered = min(x for x in (deed_ac, actual_ac) if x) if (deed_ac or actual_ac) else 0
    line = lambda ac: f'Ac {ac:.2f} Cents'
    for side in ('East', 'West', 'North', 'South'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or line(deed_ac)
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or line(actual_ac)
    rate = num(rep.get('ratePerAcre')) or num(rep.get('marketRatePerCent')) * 100 or num(pd.get('landRate')) * SQYD_PER_ACRE
    guide = num(rep.get('guidelineRatePerAcre')) or num(pd.get('guidelineRate')) * SQYD_PER_ACRE
    land = money(considered * rate)
    fmv = floor_thousand(land)
    r_pct, d_pct = rates_for(case, 'agriculture', 0.85, 0.75)
    realizable = floor_thousand(fmv * r_pct)
    f['realizablePct'], f['distressPct'] = f'{r_pct * 100:g}', f'{d_pct * 100:g}'
    distress = floor_thousand(fmv * d_pct)
    f.update({
        'extentAc': line(considered), 'extentDeed': line(deed_ac), 'extentActual': line(actual_ac),
        'extentSite': line(deed_ac), 'extentConsidered': line(considered), 'totalExtent': line(deed_ac),
        'sizeNorthSouth': line(deed_ac), 'sizeEastWest': line(deed_ac), 'plotShape': f.get('landShape'),
        'marketRateLine': f'Rs {inr(rate)}/- Acre', 'guidelineRateLine': f'Rs {inr(guide)}/- Acre' if guide else '---',
        'adoptedRateLine': f'{considered:.2f} Cent X Rs  {inr(rate)}/- Acre ', 'landValueLine': f'Rs {inr(land)}/-  ',
        'absA': f'Rs. {inr(land)}/-', 'absTotal': f'Rs.  {inr(land)}/-', 'absSayAs': f'Rs   {inr(fmv)}/-',
        'fmv': inr(fmv), 'fmvWords': words(fmv), 'fmvWordsUpper': words(fmv).upper(),
        'fmvLine': f'RS {inr(fmv)}/-', 'realizable': inr(realizable), 'realizableWords': words(realizable),
        'realizableLine': f'Rs {inr(realizable)}/-', 'distress': inr(distress), 'distressWords': words(distress),
        'distressLine': f'Rs {inr(distress)}/-',
        'bookValue': inr(num(rep.get('bookValue'))) if rep.get('bookValue') else '---',
        'declBackground': f'Ac {considered:.2f} Cents of freehold land belonging to the client. {f.get("landType")} {postal}',
        'declPurpose': f'For collateral security.  The Manager, APGB, {case.get("bankBranch") or "---"}, {f["district"]} (Dt).',
    })
    images = geo_and_photos(case, rep, f, temps, 6)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site,
            'agriculture': build_agriculture}
TEMPLATES = {name: f'apgb_{name}.docx' for name in BUILDERS}


def format_for(case):
    t = ((case.get('propertyDetails') or {}).get('propertyType') or '').lower()
    if 'apartment' in t or 'flat' in t:
        return 'apartment'
    if 'agri' in t:
        return 'agriculture'
    if 'site' in t or 'plot' in t or 'land' in t:
        return 'open_site'
    return 'house'


def people_fields(f, case):
    """Second / third owner and applicant typed on the case (report fields owner2Name … applicantAddr)."""
    rep = (case.get('propertyDetails') or {}).get('report') or {}
    def rel(t):
        t = (t or '').strip().rstrip('.')
        if not t:
            return ''
        return t if re.match(r'^(s|w|d|c)/o', t, re.I) else 'S/o. Sri. ' + re.sub(r'^(sri\.?|late)\s*', '', t, flags=re.I)
    for k in ('owner2', 'owner3', 'applicant'):
        if rep.get(f'{k}Name') and not f.get(f'{k}Name'):
            f[f'{k}Name'] = title_for(rep[f'{k}Name'], rep.get(f'{k}Rel'))
            f[f'{k}Rel'] = rel(rep.get(f'{k}Rel'))
            f[f'{k}Addr'] = rep.get(f'{k}Addr') or ''


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'APGB {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    people_fields(job['fields'], case)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
