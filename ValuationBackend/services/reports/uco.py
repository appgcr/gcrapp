"""
UCO Bank report builder (the bank's own formats in uco_source/).

UCO's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹5,000 (58,37,400 → 58,35,000); flats to ₹1,000
    (46,49,500 → 46,49,000), unless the engineer types it
  • Realizable / distress = % of the Say (Settings → Banks: house/flat 95/90, site 90/80), rounded to the
    nearest ₹10,000 (58,35,000 → 55,40,000 / 52,50,000)
  • Building depreciation 1% per year of age
"""
import os
import re

import apgb
import bob
from apgb import inr, num, trunc2, SQYD_PER_CENT, SQM_PER_CENT, SQFT_PER_SQM, apply_overrides
from union import core_words, dotted, cents_txt
from pnb import owner_fields

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
DROP_ROW = '__DROPROW__'

HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling', 'am_lift'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_sump'],
}
HOUSE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'postalAddress': 'As Of The Above',
    'occupancy': 'Owners', 'roadWidth': '30’0”Wide Road ', 'advantage1': 'Good Residential Area', 'specialRemarks': 'Nil',
    'guidelineNote': 'Copy Enclosed', 'buildingType': 'Residential Building', 'constructionType': 'RCC',
    'planAuthority': 'Commissiner', 'planVerified': 'YES / NO', 'planComments': 'NIL',
    'specGF_foundation': 'PCC & WITH RR STONE MASONARYIN CM OVER SAND CUSHION &SETTELEMENT BED (1:4:8)',
    'specGF_basement': 'RR STONE MASONARY INCM OF 0.60 HT FROM RL', 'specGF_superstructure': 'Brick Work',
    'specGF_joinery': 'Provided', 'specGF_rccWorks': 'Rcc ROOF & Columns', 'specGF_plastering': 'Provided',
    'specGF_flooring': 'Tiles', 'specGF_specialFinish': 'NA', 'specGF_roofing': 'RCC ROOF', 'specGF_drainage': 'Provided',
    'compoundWall': 'Provided', 'wiring': '--', 'fittingsClass': 'CTS & CONCELED', 'lightPoints': 'ORDINARY',
    'fanPoints': 'ADEQUATE', 'plugPoints': 'PROVIDED', 'electricalOther': 'MAIN SWITCHES',
    'waterMeter': 'Tap Connection Provided', 'otherFixtures': '--', 'district': 'Y.S.R', 'place': 'Kadapa',
}
BANK = {'label': 'UCO BANK', 'realizable': 0.95, 'distress': 0.90, 'say_step': 5000, 'site_say_step': 5000,
        'value_round': 10000, 'pct_of': 'say', 'extras': HOUSE_EXTRAS, 'defaults': {'house': HOUSE_DEFAULTS}}


def people(f, rep):
    """Applicant(s) first (up to two) with one address, then the owner."""
    for k, (nk, rk) in enumerate((('applicantName', 'applicantRel'), ('applicant2Name', 'applicant2Rel')), start=1):
        name, rel = rep.get(nk), bob.relation(rep.get(rk))
        sfx = '' if k == 1 else '2'
        f[f'applicant{sfx}Line'] = (f'{name}, {rel.rstrip(".")}.' if rel else name) if name else DROP
        f[f'applicant{sfx}Name'] = f'{name}, ' if name else DROP
        f[f'applicant{sfx}Rel'] = (f'{rel.rstrip(".")}.' if rel else ' ') if name else DROP
    any_app = bool(rep.get('applicantName'))
    f['applicantLabel'] = 'Applicant :-' if any_app else DROP
    f['applicantAddr'] = (rep.get('applicantAddr') or ' ') if any_app else DROP
    f['ownerLine1'] = f['ownerLine1'].strip()


def common(f, case):
    say = num(f['fmv'])
    f.update({'districtDotted': dotted(f['district']), 'fmvWordsCore': core_words(say),
              'fmvWordsCoreUpper': core_words(say).upper().replace('CRORES', 'CRORE'),
              'declDates1': f'Date of appointment: {f["inspectionDate"]}, ', 'declDates2': f'Valuation date : {f["reportDate"]},',
              'declDates3': f'Date of report  : {f["reportDate"]}.',
              'declPurpose': f'For collateral security. Manager, UCO BANK, {f["bankBranchUpper"]}, {f["placeUpper"] or "KADAPA"}'})


def ext_line(c):
    return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents'


def build_house(case, temps, bank=None):
    job = bob.build_house(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    people(f, rep)
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', f['wardNo']
    lb, district = f['localBodyName'], f['district']
    plot = f.get('plotNo') or '---'
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land = apgb.money(considered * rate)
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60

    codes, plinth, carpet = [], [], []
    for i, row in enumerate(job['rows']['fl'], start=1):
        area = num(row['plinth'])
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in row['label'].lower()), row['label'])
        codes.append(code)
        plinth.append(f'{code} = {trunc2(area / SQFT_PER_SQM):.2f} Sqmt (or) {area:.2f} Sqft')
        carpet.append(f'{code} = {trunc2(area * 0.85):.2f} Sqft /- ')
        dep_amt = num(re.sub(r'[^\d.]', '', row['depAmount']))
        row.update({'sno': str(i), 'plinthNum': f' {area:.2f} ', 'ageWord': 'New ' if not age else f'{age} Years',
                    'depPct': f' (-) {int(min(age, 70)):02d}% ', 'depAmount': f'Rs. {inr(dep_amt) if dep_amt else 0}/-'})
    floors = '+'.join(codes) or 'GF'
    surveys = survey.rstrip(', ') + ','
    loc = (f'Site Survey No’s : {surveys} Door No : {door}, Plot No: {plot}, In {f["landmark"]}, {f["village"]}  At {lb}  of  '
           f'{dotted(district)} Dist.')
    f.update({
        'surveyNoComma': surveys, 'plotNo': plot, 'netExtentCents': cents_txt(considered),
        'houseTitle': f'{rep.get("buildingKindTitle") or "Residential Building"} ({floors}) At {loc}',
        'localBodyLine': f'{lb}, {dotted(district)} Dist.', 'villageLine': f'{f["village"]} Village Filed',
        'villageName': f['village'], 'localBodyLine2': f'{lb} of {dotted(district)} (Dt).',
        'briefDesc': f'This Building is Very Suitable for Residential  Purpose it is located  {loc}',
        'extentDeedLine': ext_line(deed_c), 'extentPlanLine': ext_line(plan_c), 'extentConsideredLine': ext_line(considered),
        'marketRateLine': f'Rs {inr(rate)}/-  Per Cent', 'adoptedRateLine': f'{cents_txt(considered)} Cents  X  Rs {inr(rate)}/- Cent',
        'landValueLine': f'= Rs {inr(land)}/-', 'ageLine': 'New' if not age else f'{age} Years',
        'remainingLifeLine': f'{max(life - age, 0)} Yrs', 'floorsLine': rep.get('floorsLine') or f'({floors}) 0.45  Basement',
        'plinthLines': '\n'.join(plinth) or '---', 'carpetLines': '\n'.join(carpet) or '---',
    })
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'{inr(v)}/-' if v else '0.00/-'
        parts[part] = tot
        f[part] = f'{inr(tot)}/-' if tot else '000/-'
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    f.update({
        'absA': f'Rs   {inr(land)}/-', 'absB': f'Rs   {inr(building)}/-',
        **{k: f'Rs.  {inr(parts[p]) if parts[p] else "000"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs. {inr(total)}/-', 'absSayAs': f'Rs. {f["fmv"]}/-',
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The land bearing At {loc}',
    })
    common(f, case)
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'Bank Purpose', 'mvCertificate': '--', 'localBodyType': 'Municipal Corporation', 'govtEnactments': '------',
    'occupancy': 'Owners', 'aptNature': 'Residential', 'structure': 'R.C.C. Framed', 'dwellingUnits': ' ',
    'quality': 'Good', 'appearance': 'Good', 'maintenance': 'Good', 'facilities': 'Yes', 'lift': 'Yes',
    'protectedWater': 'Yes', 'sewerage': 'Yes', 'carParkingType': 'Open', 'compoundWall': 'Yes', 'pavement': 'Yes',
    'specRoof': 'R.C.C. Roof', 'specFlooring': 'Granite', 'specDoors': 'Available', 'specWindows': 'Available',
    'specFittings': 'Available', 'specFinishing': 'Available', 'houseTax': 'YES', 'assessmentNo': '---',
    'taxPaidName': '---', 'flatMaintenance': 'Good', 'fsi': '--', 'flatClass': 'I CLASS', 'usage': 'Residential',
    'occupancy2': 'Owners', 'monthlyRent': '--', 'marketability': 'Good',
    'advantages': 'It Is Good Residential Area, All Civic Amenities Are Very Near To In this Property Like Hospitals, Schools, Theaters.. Etc.',
    'negatives': 'No', 'comparableRate': '---', 'adoptedBasicRate': '---', 'guidelineNote': 'Copy Enclosed',
    'x_wardrobes': '---', 'x_showcases': '---', 'x_kitchen': '---', 'x_superfine': '---', 'x_interior': '---',
    'x_electrical': '---', 'x_grills': '---', 'x_potential': '--', 'x_others': '---', 'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_apartment(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(APT_DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    people(f, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    near = rep.get('nearBy')
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    status = rep.get('flatStatus')
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    uds_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_plan_c = apgb.extent_in_cents(rep.get('udsPlanRaw')) or uds_c
    parent_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    rate = num(rep.get('ratePerCent')) or num(rep.get('marketRatePerCent')) or num(rep.get('landRatePerSqyd')) * SQYD_PER_CENT
    land = apgb.money(uds_plan_c * rate)
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    c_rate = num(rep.get('constructionRate')) or 1000
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * c_rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    xs = ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_electrical', 'x_grills', 'x_potential', 'x_others')
    extras = sum(num(rep.get(k)) for k in xs)
    for k in xs:
        if num(rep.get(k)):
            f[k] = f'Rs {inr(num(rep.get(k)))}/-'
    total = composite + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=1000, bank=BANK)
    uds_yd, parent_yd = trunc2(uds_c * SQYD_PER_CENT), trunc2(parent_c * SQYD_PER_CENT)
    kind = f'Residential {status} Flat' if status else 'Residential Flat'
    loc = (f'Flat No: {flat} ({floor} Floor), In Site Survey No’s: {survey}, Door No : {door}, Ward No : {ward}, In {landmark},'
           + (f' Near {near},' if near else '') + f' {village} Village Field At {lb} of {dotted(district)} (Dt).')
    deeds2 = [(rep.get(f'deed{k}No'), rep.get(f'deed{k}Date')) for k in ('2', '3') if rep.get(f'deed{k}No')]
    pw = [num(rep.get(f'pw{i}')) for i in range(1, 11)]
    f.update({
        'aptName': apt, 'aptNameUpper': apt.upper(), 'flatNo': flat, 'floorLine': f'{floor} Floor',
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'firmName': rep.get('firmName') or DROP,
        'udsSqyd': f'{uds_yd:.2f}', 'parentSqyd': f'{parent_yd:.2f}', 'parentSqydShort': f'{parent_yd:g}',
        'deed2No': deeds2[0][0] if deeds2 else '--', 'deed3Line': f'Rectification Deed No  :  {deeds2[1][0]}' if len(deeds2) > 1 else DROP,
        'deedOthersLine': ('Xerox Copy Of Rectification Deed No’s : ' + ' & '.join(f'{n}, Date : {d or "---"}' for n, d in deeds2)) if deeds2 else ' ',
        'reraLine': f'  AP RERA PROJECT REGISTRATION NO: {rep["reraNo"]}.' if rep.get('reraNo') else DROP,
        'planValidityLine': f'Validity Date              : {rep["planValidity"]}.' if rep.get('planValidity') else ' ',
        'aptTitle': f'{kind} In “{apt.upper()}” (Residential Apartment), {loc}',
        'localBodyLine': f'{lb}, {district.replace(".", " ").strip()} (DT)',
        'flatDescUpper': f'{kind} IN “{apt}” (RESIDENTIAL APARTMENT), {loc} WITH FRAMED STRUCTURED R.C.C ROOF.'.upper(),
        'villageLine': f' {village} Village Field,', 'wardLine': f' Ward No : {ward}, In {landmark},' + (f' Near {near},' if near else ''),
        'parentLine': f'{parent_yd:.2f} Sqyds (or) {trunc2(parent_c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(parent_c)} Cents' if parent_c else '---',
        'udsOutOf': f' {uds_yd:.2f} Sqyds Out Of  {parent_yd:.2f} Sqyds ',
        'occupancy': rep.get('occupancy') or ('Semi Finished Under Construction' if status else 'Owners'),
        'aptLocation': f'In {landmark},' + (f' Near {near},' if near else '') + f' {village} Village Field At {lb} of {dotted(district)} (Dt).',
        'surveyLine2': f'Survey No’s : {survey},', 'doorLine': f'Door No : {door},', 'villageWardLine': f'{village} Village Field',
        'localBodyName': lb, 'pinLine': f'Pin Code : {rep.get("pinCode") or "---"}',
        'yearOfConstruction': rep.get('yearOfConstruction') or str(apgb.dt.date.today().year - age),
        'flatNoLine': f'Flat No : {flat} ', 'udsCentsLine': f'{cents_txt(uds_c)} Cents',
        'taxAmountLine': f"Rs {int(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '---',
        'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'buildingCalc': f'Building = {plinth:.2f} Sqft x Rs {int(c_rate)}/- =  Rs {inr(bld)}/-',
        'landCalc': f'= {cents_txt(uds_plan_c)} Cents x Rs {inr(rate)}/- Cent = Rs {inr(land)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'ageLine': f'{age} Year', 'lifeLine': f'{life} Years',
        'deprLine': f'{dep_pct:g}%  =   Rs {inr(dep) if dep else "0.00"}/-', 'deprBuildingLine': f'Rs {inr(net)}/-',
        'landValueLine': f'Rs {inr(land)}/-', 'compositeLine': f'Rs. {inr(composite)}/-', 'compositeSayLine': f'Say Rs {inr(fmv)}/-',
        'unitRateLine': f' Rs {fmv / plinth:.2f}/-' if plinth else '--', 'sayValueLine': f'Rs  {inr(fmv)}/-',
        'grandTotalLine': f'Rs  {inr(fmv)}/-',
        'declBackground': f'1) {cents_txt(uds_plan_c)} Cents of freehold land belonging to the client. The land bearing At {kind} In “{apt.upper()}” (Residential Apartment), {loc}',
        'declBuilding': f'2) Residential Flat constructed on the said land. Built up area : {plinth:.2f} Sqft ',
        'nearLine': f'Near {near}' if near else landmark, 'gpsDecimal': '---',
        'pendingTotal': f'{inr(sum(pw))}.00', 'pendingWordsCoreUpper': core_words(sum(pw)).upper() if sum(pw) else 'NIL',
        'applicantLine': f['applicantLine'],
    })
    for i, v in enumerate(pw, start=1):
        f[f'pw{i}'] = f'{inr(v)}.00' if v else '0.00'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
        f[f'fbActual{side}'] = rep.get(f'fbActual{side}') or f[f'fb{side}']
    common(f, case)
    f['declPurpose'] = f'For collateral security. Manager, UCO Bank {f["bankBranchUpper"]}, {dotted(district)}. (Dt).'
    f['declDates3'] = f'Date of report  : {f["reportDate"]}.'
    images = apgb.geo_and_photos(case, rep, f, temps, 5)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images, 'drop': [] if sum(pw) else ['pending']}


# ---------------------------------------------------------------- OPEN SITE (one or two land items)
SITE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'postalAddress': 'As Of The Above', 'cityTown': 'City',
    'areaResidential': 'Residential Area', 'areaCommercial': 'NA', 'areaIndustrial': 'NA', 'areaClass': 'Middle',
    'areaUrban': 'Urban', 'localBodyType': 'Corporation', 'occupancy': 'Owners', 'locality': 'Middle',
    'surroundings': 'Residential', 'flooding': 'Nil', 'civicAmenities': 'At Walkable Distance', 'levelOfLand': 'Level Ground',
    'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil', 'layoutApproved': 'No',
    'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road', 'roadWidth': 'Above 24’0”Wide Road',
    'landLocked': ' No', 'water': ' Available', 'sewerage': ' Provided', 'power': ' Provided',
    'advantage1': 'Good Residential Area', 'specialRemarks': 'Nil', 'guidelineNote': 'Copy Enclosed',
    'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(SITE_DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    people(f, rep)
    f['applicantLabel'] = 'Applicant / Purchaser :-' if rep.get('applicantName') else DROP
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    near = rep.get('nearBy')
    survey, door, plot = f['surveyNo'] or '---', f['doorNo'] or '---', f['plotNo'] or '---'
    i1 = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    i2 = apgb.extent_in_cents(rep.get('extent2Raw'))
    total_c = i1 + i2
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or total_c
    considered = min(total_c, plan_c) if total_c else plan_c
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land = apgb.money(considered * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=5000, bank={**BANK, 'realizable': 0.90, 'distress': 0.80,
                                                                                 'value_round': 5000})
    loc = (f'Site Survey No : {survey}, Door No : {door}, In Plot No:- {plot}, {landmark},' + (f' Near {near},' if near else '')
           + f' {village} Village Field  At {lb}  of  {dotted(district)} Dist.')
    yd1, yd2 = trunc2(i1 * SQYD_PER_CENT), trunc2(i2 * SQYD_PER_CENT)
    f.update({
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'plotNo': plot,
        'planNo': f['planNo'] if f['planNo'] else 'Tentative Plan', 'netExtentCents': cents_txt(considered),
        'siteTitle': f'{rep.get("siteType") or "Residential Vacant site"} At {loc} ',
        'localBodyLine': f'{lb}, {dotted(district)} Dist.', 'localBodyLine2': f'{lb} of {dotted(district)} (Dt).',
        'briefDesc': f'This is Very Suitable for Residential  Purpose it is located {loc} ',
        'villageLine': f'{village} Village Field', 'wardLine': f'Ward No: {ward}, In  {landmark},',
        'item1Head': 'As Per Deed (Item No:- 1)' if i2 else 'As Per Deed',
        'item2Head': 'As Per Deed (Item No:- 2)' if i2 else DROP_ROW,
        'item1Extent': ext_line(i1), 'item2Extent': ext_line(i2) if i2 else DROP_ROW,
        'totalExtentLine': (f'Total Extent = {yd1:.2f} Sqyds + {yd2:.2f} Sqyds = {yd1 + yd2:.2f} Sqyds (or) {cents_txt(total_c)} Cents '
                            if i2 else f'Total Extent = {yd1:.2f} Sqyds (or) {cents_txt(total_c)} Cents '),
        'extentTotalLine': ext_line(total_c), 'extentPlanLine': ext_line(plan_c), 'extentConsideredLine': ext_line(considered),
        'marketRateLine': f'Rs {inr(rate)}/-  Per Cent', 'adoptedRateLine': f'{cents_txt(considered)} Cents  X  Rs {inr(rate)}/- Cent',
        'landValueLine': f'= Rs {inr(land)}/-', 'absA': f'Rs   {inr(land)}/-', 'absTotal': f'Rs. {inr(land)}/-',
        'absSayAs': f'Rs. {inr(fmv)}/-',
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The land bearing At {loc}',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
        f[f'dim2{side}'] = (rep.get(f'dim2{side}') or '---') if i2 else DROP_ROW
        f[f'dim2Actual{side}'] = (rep.get(f'dim2{side}') or '---') if i2 else DROP_ROW
    common(f, case)
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site}
TEMPLATES = {name: f'uco_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'UCO Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
