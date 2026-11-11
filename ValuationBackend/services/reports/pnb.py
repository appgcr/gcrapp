"""
Punjab National Bank report builder (the bank's own formats in pnb_source/).

PNB's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹5,000 (4,99,97,046 → 4,99,95,000; 27,13,… → 27,10,000),
    unless the engineer types the Say amount (report field sayValue)
  • Realizable / distress = % of the Say (Settings → Banks: house/site 90/80, flat 95/85), rounded to
    the nearest ₹10,000 (4,99,95,000 → 4,50,00,000 / 4,00,00,000)
  • Building depreciation 1% per year of age
The building and extras sums are shared with the Bank of Baroda builder (same valuer's method).
"""
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, SQYD_PER_CENT, SQM_PER_CENT, SQFT_PER_SQM, apply_overrides
from union import core_words, dotted, cents_txt

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
SQFT_PER_SQYD = 9

HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump', 'sv_lift', 'sv_staircase'],
}
HOUSE_DEFAULTS = {
    'purpose': 'For Bank Facility', 'occupancy': 'Occupied by the Owners', 'cityTown': 'Kadapa',
    'buildingType': 'Residential Building', 'planAuthority': 'Kadapa Municipal Commissioner', 'district': 'Y.S.R',
    'place': 'Kadapa',
}
BANK = {'label': 'Punjab National Bank', 'realizable': 0.90, 'distress': 0.80, 'say_step': 5000,
        'site_say_step': 5000, 'value_round': 10000, 'pct_of': 'say', 'extras': HOUSE_EXTRAS,
        'defaults': {'house': HOUSE_DEFAULTS}}


def owner_fields(f, case, rep, n=3):
    """Every way PNB prints the owners: 'Sri N. Krishna Reddy,  S/o Sri N.C. Venkata Reddy.' lines,
    name / relation pairs and numbered '1)  Name,' lines. Unused lines are dropped."""
    people = [(f['owner1Name'], f['owner1Rel'] if f.get('owner1Rel') not in (None, DROP) else '')]
    for i in range(2, n + 1):
        if rep.get(f'owner{i}Name'):
            people.append((apgb.title_for(rep[f'owner{i}Name'], rep.get(f'owner{i}Rel')), bob.relation(rep.get(f'owner{i}Rel'))))
    for i in range(1, n + 1):
        if i <= len(people):
            name, rel = people[i - 1]
            rel = rel.rstrip('.') + '.' if rel else ''
            f[f'ownerLine{i}'] = f' {name},  {rel} ' if rel else f' {name}.'
            f[f'owner{i}NameLine'] = f'{name}, '
            f[f'ownerNum{i}Name'] = f'  {i})  {name}, '
            f[f'owner{i}RelLine'] = f' {rel}' if rel else DROP
        else:
            for k in (f'ownerLine{i}', f'owner{i}NameLine', f'ownerNum{i}Name', f'owner{i}RelLine'):
                f[k] = DROP
    phone = rep.get('ownerPhone') or case.get('clientPhone') or case.get('phone')
    f['ownerPhone'] = phone or DROP
    f['ownerPhoneLine'] = f'Cell No : {phone}.' if phone else DROP
    if f.get('owner1Addr') == DROP:
        f['owner1Addr'] = ' '


def yd_c(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or)  {cents_txt(c)} Cents'


def ft_yd_c(c):
    yd = trunc2(c * SQYD_PER_CENT)
    return f'{trunc2(yd * SQFT_PER_SQYD):.2f} Sqfts (or) {yd:.2f} Sqyds (or)  {cents_txt(c)} Cents'


def sqm_yd_c(c):
    return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmt (or) {trunc2(c * SQYD_PER_CENT):.2f}  Sqyds (or) {cents_txt(c)} Cents  '


def value_lines(f, case, rep):
    """Purchase / book / FMV / realizable / distress table and the localised wording shared by all formats."""
    pd = case.get('propertyDetails') or {}
    price = num(rep.get('purchasePrice')) or num(rep.get('bookValue'))
    book = num(rep.get('bookValue')) or price
    f.update({
        'purchaseDate': f' {f.get("deedDate") or "---"}',
        'purchasePrice': f'RS {inr(price)}/- ' if price else '---', 'bookValueLine': f'  RS {inr(book)}/-' if book else '---',
        'fmvLine': f'Rs  {f["fmv"]}/-', 'realizableLine': f'Rs  {f["realizable"]}/-', 'distressLine': f'Rs  {f["distress"]}/-',
        'fmvWordsCore': core_words(num(f['fmv'])), 'fmvWordsCoreUpper': core_words(num(f['fmv'])).upper(),
        'districtDotted': dotted(f['district']),
        'bankBranch': (case.get('bankBranch') or '---').strip(),
        'bankBranchLine': f'{(case.get("bankBranch") or "---").strip()}, {dotted(f["district"])} (Dt)',
        'latitude': f.get('latitude') or '---', 'longitude': f.get('longitude') or '---',
        'planLine': f'B.A.No : {f["planNo"]}, Dt:-{f["planDate"]}.' if f.get('planNo') not in (None, '', 'NA') else 'NA',
        'deedDate': f.get('deedDate') or apgb.ddmmyyyy(pd.get('deedDate')) or '---',
    })
    for k in ('fmvWords', 'realizableWords', 'distressWords', 'fmvWordsCore', 'fmvWordsCoreUpper'):
        f[k] = f[k].replace('Crores', 'Crore').replace('CRORES', 'CRORE')


def build_house(case, temps, bank=None):
    job = bob.build_house(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', f['wardNo']
    lb, district = f['localBodyName'], f['district']
    near = rep.get('nearBy')
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60

    codes, plinth = [], []
    for i, row in enumerate(job['rows']['fl'], start=1):
        area = num(row['plinth'])
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in row['label'].lower()), row['label'])
        codes.append(code)
        plinth.append(f'{code}  = {trunc2(area / SQFT_PER_SQM):.2f} Sqmts (or) {area:.2f} Sqft')
        row.update({'sno': str(i), 'label': row['label'].title(), 'plinthNum': f'{area:.2f}',
                    'height': rep.get('floorHeight') or '10’0”', 'ageNum': str(age),
                    'depPct': row['depPct'].replace('(-', ' (-'), 'depAmt': row['depAmount'].replace('Rs. ', '')})
    kind = rep.get('buildingKindTitle') or 'Residential Building'
    f.update({
        'houseTitle': (f'{kind} ({" + ".join(codes) or "GF"} ) At Site Survey No : {survey}, Door No: {door}, Ward No: {ward}, '
                       f'In {f["landmark"]},' + (f' {near},' if near else '') +
                       f' {f["village"]} Village Field At {lb} of {dotted(district)} (Dt).'),
        'localBodyLine': f'{lb} Of {dotted(district)} (Dt).',
        'netExtentCents': cents_txt(considered),
        'extentYdC': yd_c(deed_c).replace('(or)  ', '(or) '), 'extentPlanFull': sqm_yd_c(plan_c),
        'extentFtYdC': ft_yd_c(deed_c), 'extentPlanFtYdC': ft_yd_c(plan_c), 'extentConsideredYdC': yd_c(considered),
        'rateCentLine': f'Rs. {inr(rate)}/ Cent', 'guidelineRateLine': f'Rs. {inr(guide)} /Sq yard' if guide else '---',
        'landCalc': f'{cents_txt(considered)} Cents X {inr(rate)}/- Cent', 'landValueLine': f'Rs. {inr(land)}/-',
        'remainingLifeLine': f'{max(life - age, 0)} Years', 'totalLifeLine': f'{life} Years',
        'plinthLines': '\n'.join(plinth) or '---', 'buildingTotalLine': f' {f["buildingTotalLine"]}',
    })
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'Rs {inr(v)}/-' if v else 'Rs --/-'
        parts[part] = tot
        f[part] = f'Rs {inr(tot)}/-' if tot else 'Rs 0.00/-'
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    f.update({
        'absA': f'Rs  {inr(land)}/-', 'absB': f'Rs. {inr(building)}/-',
        **{k: f'Rs.  {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs. {inr(total)}/-', 'absSayAs': f'Rs. {f["fmv"]}/-',
    })
    value_lines(f, case, rep)
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'Bank Facility', 'planAuthority': 'Commissioner, Kadapa Municipal Corporation', 'planVerified': 'YES/NO',
    'planComments': 'Nil', 'cityTown': 'Kadapa Municipal Corporation', 'areaResidential': 'Residential Area',
    'areaCommercial': '----', 'areaIndustrial': '----', 'areaClass': 'Middle', 'areaUrban': 'Urban',
    'localBodyType': 'Corporation Limits', 'govtEnactments': 'NO', 'localityType': 'Residential Area',
    'structure': 'R.C.C. Framed', 'dwellingUnits': '--', 'lift': 'Yes', 'carParkingType': 'Yes, Covered',
    'specRoof': 'R.C.C. Roof', 'specFlooring': 'Tiles', 'specDoors': 'Teak Wood', 'specWindows': 'Teak Wood',
    'specFittings': 'Yes', 'specFinishing': 'Yes', 'assessmentNo': '--', 'taxPaidName': '--', 'flatClass': 'I Class',
    'occupancy': 'Owner', 'flatDoorNo': 'NA', 'comparableRate': '-----', 'adoptedBasicRate': '-----',
    'advantages': 'It Is Good Residential Area,  All Civic   \nAmenities Are Very Near to In this Property, Like School, Apartments, etc.,',
    'x_wardrobes': 'Rs  0.00', 'x_showcases': 'Rs  0.00', 'x_kitchen': 'Rs    0.00', 'x_superfine': '--',
    'x_interior': 'Rs    0.00', 'x_grills': 'Rs    0.00', 'x_potential': '--', 'x_others': '--', 'district': 'Y.S.R',
}
DROP_ROW = '__DROPROW__'
SIDES = ('East', 'West', 'North', 'South')


def build_apartment(case, temps, bank=None):
    bank_apt = {**BANK, 'realizable': 0.95, 'distress': 0.90, 'defaults': {'apartment': APT_DEFAULTS}}
    job = bob.build_apartment(case, temps, bank=bank_apt)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    apt, flat, floor = f['aptName'], f['flatNo'], f['floorName']
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    near = rep.get('nearBy')
    status = rep.get('flatStatus')

    # Applicant (if the buyer is not the owner)
    app = rep.get('applicantName')
    app_rel = bob.relation(rep.get('applicantRel'))
    f.update({
        'applicantLine': f'{app}, {app_rel.rstrip(".")}.' if app and app_rel else (app or DROP),
        'applicantLabel': 'Applicant :- ' if app else DROP, 'applicantName': f'  {app},' if app else DROP,
        'applicantRel': f' {app_rel.rstrip(".")}.' if app and app_rel else DROP,
        'applicantAddr': rep.get('applicantAddr') or DROP if app else DROP,
    })
    # Deeds: up to three (deed No + date)
    deeds = [(pd.get('deedNo'), apgb.ddmmyyyy(pd.get('deedDate')))]
    for k in ('2', '3'):
        if rep.get(f'deed{k}No'):
            deeds.append((rep[f'deed{k}No'], apgb.ddmmyyyy(rep.get(f'deed{k}Date')) or rep.get(f'deed{k}Date') or '---'))
    for i in range(3):
        no, dtx = deeds[i] if i < len(deeds) else (None, None)
        f[f'deedLine{i + 1}'] = f'Deed Xerox  :  {no}   Dt : {dtx or "---"}' if no else DROP
    f.update({'deedNoA': deeds[0][0] or '---', 'deedNoB': deeds[1][0] if len(deeds) > 2 else DROP,
              'deedNoC': deeds[-1][0] if len(deeds) > 1 else '--'})

    # Land: the flat's undivided share in cents x rate per cent
    uds_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    parent_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    rate = num(rep.get('ratePerCent')) or num(rep.get('marketRatePerCent')) or num(rep.get('landRatePerSqyd')) * SQYD_PER_CENT
    land = apgb.money(uds_c * rate)
    uds_yd, parent_yd = trunc2(uds_c * SQYD_PER_CENT), trunc2(parent_c * SQYD_PER_CENT)
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    c_rate = num(rep.get('constructionRate')) or 2200
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * c_rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    parking = num(rep.get('carParkingValue'))
    extras = sum(num(rep.get(k)) for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior',
                                            'x_electrical', 'x_grills', 'x_potential', 'x_others'))
    total = composite + parking + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=5000, bank=bank_apt)
    for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_grills', 'x_potential', 'x_others'):
        if num(rep.get(k)):
            f[k] = f'Rs  {inr(num(rep.get(k)))}/-'
    loc = (f'Flat No :- {flat} in {floor} Floor, Ward No: {ward}, Door No: {door},  In {f["landmark"]},'
           + (f' Near {near},' if near else '') + f'  {f["village"]} Village Field, At  {lb} of  {district} (Dt).')
    title = (f'Residential Flat In “{apt.upper()}” Residential Apartments' + (f' ({status})' if status else '') +
             f', Flat No: {flat} ({floor} Floor), In Survey No: {survey}, Door No:- {door}, Ward No: {ward}, '
             + (f'Near {near}, ' if near else '') + f'{f["landmark"]}, {f["village"]} Village Field  At {lb} of  {dotted(district)} (Dt).')
    f.update({
        'aptNameUpper': apt.upper(), 'aptNameQuoted': f'“{apt.upper()} APARTMENT”', 'aptTitle': title,
        'floorsDesc': rep.get('floorsDesc') or f.get('floorsDesc') or '---',
        'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'floorLine': f'{floor} Floor', 'udsSqyd': f'{uds_yd:.2f}', 'parentSqyd': f'{parent_yd:.2f}',
        'udsLine': f'{uds_yd:.2f} Sqyds  (or) {cents_txt(uds_c)} Cents', 'bankBranch': (case.get('bankBranch') or '---').strip(),
        'flatDesc': rep.get('flatDesc') or f'Flat No :-  {flat}, ({floor} Floor)  With Framed Structured R.C.C Roof, It’s a Residential  Flat.',
        'villageLine': f'{f["village"]} Village', 'landmarkLine': f'{f["landmark"]}, ' + (f'Near {near}, ' if near else ''),
        'localBodyLine2': f'{lb} of {dotted(district)} (Dt).',
        'locationBlock': f'Door No. {door},\nSurvey No. {survey}, {f["landmark"]}, {f["village"]} Village Field, {lb}, {district} (Dt).',
        'postalLine': f' ( Residential  Apartment ) {loc}',
        'occupancy': rep.get('occupancy') or ('Semi Finished Flat Purchasing By ' + app if app and status else 'Owner'),
        'yearOfConstruction': rep.get('yearOfConstruction') or ('New One' if not age else str(apgb.dt.date.today().year - age)),
        'deedExecutant': rep.get('deedExecutant') or f['owner1Name'],
        'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft', 'plinthSft': f'{plinth:.2f} sft',
        'buildingCalc': f'Building = {plinth:.2f} Sqftx Rs {inr(c_rate)}/-', 'buildingCalc2': f'=  Rs {inr(bld)}/-',
        'landCalc': f'{cents_txt(uds_c)} Cents x Rs {inr(rate)} /- Cent', 'landCalc2': f'= Rs {inr(land)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'ageLine': 'New One' if not age else f'{age} Years', 'lifeLine': f'{life}  Years',
        'deprLine': f' {dep_pct:g}. % - Rs {inr(dep) if dep else "0.00"}/-', 'deprBuildingLine': f'Rs   {inr(net)}/-',
        'landValueLine': f'Rs   {inr(land)}/-', 'compositeLine': f'Rs   {inr(composite)}/-',
        'unitRateLine': f'    Rs {composite / plinth:.2f}/-' if plinth else '--',
        'carParkingLine': f'Rs   {inr(parking)}/-' if parking else '--',
        'grandTotalLine': f'Rs  {inr(total)}/-', 'sayLine': f'Rs  {inr(fmv)}/-',
        'purchaseAmount': inr(num(rep.get('purchasePrice'))) if rep.get('purchasePrice') else '---',
        'declBackground': f'Residential Flat  in ““{apt.upper()} APARTMENT” ( Residential  Apartment ) {loc}',
        'declPurpose': f'For collateral security. The Manager, {(case.get("bankBranch") or "---").strip()}',
        'declDates1': f'Date of appointment: {f["inspectionDate"]},', 'declDates2': f'Valuation date  :  {f["reportDate"]}, ',
        'declDates3': f'Date of report   :  {f["reportDate"]}.',
    })
    for side in SIDES:
        f[f'fbActual{side}'] = rep.get(f'fbActual{side}') or f[f'fb{side}']

    # Site of the whole apartment: deed boundaries / dimensions and up to three more land items
    bd_doc, bd_act = pd.get('boundariesDoc') or {}, pd.get('boundariesActual') or {}
    second = len(deeds) > 1
    f['si1Label'] = f'As Per Deed ({deeds[0][0] or "---"}) '
    f['si2Label'] = f'As Per Deed ({deeds[1][0]})' if second else 'Actual On The Ground'
    f['sid1Label'] = f'As Per Deed  ({deeds[0][0] or "---"})'
    f['sid2Label'] = f'As Per Deed ({deeds[1][0]})' if second else 'Actual On The Ground'
    for side in SIDES:
        f[f'si1{side}'] = bd_doc.get(side.lower()) or '---'
        f[f'si2{side}'] = (rep.get(f'bd2{side}') if second else bd_act.get(side.lower())) or f[f'si1{side}']
        f[f'sid1{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'sid2{side}'] = (rep.get(f'dim2{side}') if second else rep.get(f'dimActual{side}')) or f[f'sid1{side}']
    parent_line = f'Extent : {trunc2(parent_c * SQM_PER_CENT):.2f} Sqmt (or) {parent_yd:.2f} Sqyds (or) {cents_txt(parent_c)} Cents'
    f['sid1Extent'] = parent_line if parent_c else '---'
    f['sid2Extent'] = rep.get('extent2Line') or f['sid1Extent']
    items = [i for i in (rep.get('siteItems') or []) if i]
    for n, k in ((3, 0), (4, 1), (5, 2)):
        it = items[k] if k < len(items) else None
        if it:
            f[f'si{n}Label'] = it.get('label') or f'Item No : {k + 2}'
            for side in SIDES:
                f[f'si{n}{side}'] = it.get(side.lower()) or '---'
            f[f'si{n}Extent'] = it.get('extent') or '---'
        else:
            empty = DROP_ROW if n in (3, 5) else ' '
            f[f'si{n}Label'] = empty
            for side in SIDES:
                f[f'si{n}{side}'] = empty
            f[f'si{n}Extent'] = empty

    # Pending works estimate (semi-finished flats)
    pw = [num(rep.get(f'pw{i}')) for i in range(1, 6)]
    for i, v in enumerate(pw, start=1):
        f[f'pw{i}'] = f'{inr(v)}.00' if v else '0.00'
    f['pendingTotal'] = f'{inr(sum(pw))}.00'
    f['pendingWordsCoreUpper'] = core_words(sum(pw)).upper() if sum(pw) else 'NIL'
    job['drop'] = [] if sum(pw) else ['pending']

    value_lines(f, case, rep)
    f['purchaseDate'] = f['deedDate']
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- OPEN SITE
SITE_DEFAULTS = {
    'purpose': 'For Bank Facility', 'occupancy': '--', 'cityTown': 'Kadapa Town', 'areaResidential': 'Residential Area',
    'areaClass': 'Middle', 'areaUrban': 'Urban', 'localBodyType': 'Kadapa Municipal Corporation',
    'surroundings': 'Residential', 'roadDetails': 'Metal  road', 'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(SITE_DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    near = rep.get('nearBy')
    survey, door, plot = f['surveyNo'] or '---', f['doorNo'] or '---', f['plotNo'] or '---'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    deed_yd = trunc2(deed_c * SQYD_PER_CENT)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=5000, bank=BANK)
    loc = (f'Site Survey No : {survey}, Plot No : {plot},  Door No : {door}, In {landmark},' + (f' Near {near},' if near else '')
           + f' {village} Village Field At {lb} of {dotted(district)} (Dt).')
    f.update({
        'village': village, 'wardNo': ward, 'landmark': landmark, 'localBodyName': lb, 'plotNo': plot,
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'netExtentCents': cents_txt(considered), 'siteTitle': f'{rep.get("siteType") or "Residential Vacant Site"} At {loc}',
        'localBodyLineUpper': f'{lb.upper()} OF {dotted(district)} (Dt).', 'villageLine': f'{village} Field',
        'localBodyLine2': f'{lb} Of {dotted(district)} (Dt).', 'nearLine': f'Near {near},' if near else f'{landmark},',
        'siteLocation': loc + ' ', 'extentPlanSqm': f'{trunc2(plan_c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(plan_c)} Cents',
        'extentYdC': f'{deed_yd:.2f} Sqyds (or) {cents_txt(deed_c)} Cents', 'extentYdC2': f'{deed_yd:.2f} Sqyds (or)  {cents_txt(deed_c)} Cents',
        'landCalc': f'{cents_txt(considered)} Cents X {inr(rate)}/- ', 'landCalc2': f'=  {inr(land)}/-',
        'landLine': f' Land       =  Rs  {inr(land)}/-', 'totalLine': f'Total        =   Rs {inr(land)}/-',
        'sayLine': f'Say  Rs {inr(fmv)}/-',
        'absA': f'Rs  {inr(land)}/-', 'absB': 'Rs    0.00/-', 'absC': 'Rs    0.00/-', 'absD': 'Rs    0.00/-',
        'absE': 'Rs.   0.00/-', 'absF': 'Rs    0.00/-', 'absTotal': f'Rs.  {inr(land)}/-', 'absSayAs': f'Rs.  {inr(fmv)}/-',
        'guidelineCalc': f'{inr(guide)}/- Per Sqyd X {deed_yd:.2f} Sqyd ' if guide else '---',
        'guidelineCalc2': f'= Rs {inr(apgb.money(guide * deed_yd))}/-   ' if guide else ' ',
        'declBackground': f'{cents_txt(considered)} Cents, {rep.get("siteType") or "Residential Vacant Site"} At {loc}',
        'declPurpose': f'For collateral security. Manager, {(case.get("bankBranch") or "---").strip()}, ',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ', 'declDates2': f'Valuation date : {f["reportDate"]}, ',
        'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    value_lines(f, case, rep)
    f['purchaseDate'] = f['deedDate']
    f['fmvLine'], f['realizableLine'], f['distressLine'] = (f'Rs {f["fmv"]}/-', f'Rs {f["realizable"]}/-', f'Rs {f["distress"]}/-')
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    f['latitude'], f['longitude'] = f.get('latitude', '---'), f.get('longitude', '---')
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site}
TEMPLATES = {name: f'pnb_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Punjab National Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
