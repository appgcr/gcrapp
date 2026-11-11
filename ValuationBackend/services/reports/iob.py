"""
Indian Overseas Bank report builder (the bank's own formats in iob_source/).

IOB's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹5,000 (90,25,418 → 90,25,000), unless the engineer types it
  • Realizable / distress = % of the Say (Settings → Banks, 90 / 80), rounded to the nearest ₹10,000
    (90,25,000 → 72,20,000 distress). The samples round some realizable values by hand
    (81,50,000); the engineer can type the exact figure if needed (report fields realizable / distress).
  • Building depreciation 1% per year of age
The house layout is the same valuer's layout as Bank of Baroda, so the BoB builder does the sums.
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

HOUSE_EXTRAS = {
    'partC': ['ex_portico', 'ex_frontDoor', 'ex_sitOut', 'ex_ohTank', 'ex_gates'],
    'partD': ['am_wardrobes', 'am_glazedTiles', 'am_sinks', 'am_marble', 'am_interior', 'am_elevation',
              'am_paneling', 'am_aluminium', 'am_handRails', 'am_falseCeiling'],
    'partE': ['mi_toilet', 'mi_lumber', 'mi_sump', 'mi_trees'],
    'partF': ['sv_water', 'sv_drainage', 'sv_compoundWall', 'sv_cbDeposits', 'sv_pavement'],
}
HOUSE_DEFAULTS = {
    'purpose': 'Bank Purpose', 'postalAddress': 'As Of The Above', 'cityTown': 'City', 'areaCommercial': 'NA',
    'areaIndustrial': 'NA', 'areaUrban': 'Urban', 'govtEnactments': 'NA', 'agriConversion': 'NA', 'occupancy': 'Owners',
    'levelOfLand': 'Level Ground', 'layoutApproved': 'NA', 'roadWidth': 'Above 20’0” Wide Road',
    'advantage1': 'Good Residential Area', 'buildingType': 'Residential', 'planVerified': 'Yes', 'planComments': 'NA',
    'specGF_foundation': 'PCC & WITH RR STONE\nMASONARYIN CM OVER SAND\nCUSHION &SETTLEMENT BED (1:4:8)',
    'specGF_basement': 'RR STONE MASONARY INCM\nOF 0.60 HT FROM RL', 'specGF_superstructure': 'BRICK WORK IN CM OF\n0.35 M  WIDE 3.0 M HEIGHT',
    'specGF_joinery': 'Wooden Doors & Windows', 'specGF_rccWorks': 'RCC Roof',
    'specGF_plastering': 'Cement Plastering in CM (1:4)\n12 MM THICK', 'specGF_flooring': 'Marbles & Granite',
    'specGF_specialFinish': ' ', 'specGF_roofing': 'RCC', 'specGF_drainage': 'Provided', 'compoundWall': 'Yes',
    'wiring': 'CTS & CONCELED', 'fanPoints': 'ADEQUATE', 'waterClosets': 'Four', 'washBasins': 'Four',
    'district': 'Y.S.R', 'place': 'Kadapa',
}
BANK = {'label': 'INDIAN OVERSEAS BANK', 'realizable': 0.90, 'distress': 0.80, 'say_step': 5000,
        'site_say_step': 5000, 'value_round': 10000, 'pct_of': 'say', 'extras': HOUSE_EXTRAS,
        'defaults': {'house': HOUSE_DEFAULTS}}


def sqyd_sqm_c(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmt  (or) {cents_txt(c)} Cents'


def sqm_sqyd_c(c):
    return f'{trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents'


def common(f, case, rep, title_kind, loc):
    """Wording shared by every IOB format."""
    district = f['district']
    say = num(f['fmv'])
    f.update({
        'districtDotted': dotted(district) + '.', 'fmvWordsCore': core_words(say),
        'fmvWordsCoreUpper': core_words(say).upper(), 'locationLine': loc,
        'bankBranchUpper': f['bankBranchUpper'].replace(', ', ' – '),
        'declPurpose': f'For collateral security. Manager, INDIAN OVERSEAS BANK, {f["bankBranchUpper"].replace(", ", "-")}.',
        'declDates1': f'Date of appointment: {f["inspectionDate"]} ', 'declDates2': f'Valuation date: {f["reportDate"]}, ',
        'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    for k in ('fmvWords', 'realizableWords', 'distressWords', 'fmvWordsCore', 'fmvWordsCoreUpper'):
        f[k] = re.sub(r'\s*Only$', '', f[k]).replace('Crores', 'Crore').replace('CRORES', 'CRORE') \
            if k in ('fmvWords', 'realizableWords', 'distressWords') else f[k].replace('Crores', 'Crore').replace('CRORES', 'CRORE')
    for k in ('fmvWords', 'realizableWords', 'distressWords'):
        f[k] = f[k] + ' Only'


def build_house(case, temps, bank=None):
    job = bob.build_house(case, temps, bank=BANK)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    f['ownerLine1'] = f['ownerLine1'].strip()
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

    codes, plinth, carpet = [], [], []
    for i, row in enumerate(job['rows']['fl'], start=1):
        area = num(row['plinth'])
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in row['label'].lower()), row['label'])
        codes.append(code)
        plinth.append(f'{code} = {trunc2(area / SQFT_PER_SQM):.2f} Sqmts (Or) {area:.2f} Sqft ')
        carpet.append(f'{code} = {trunc2(area * 0.85):.2f} Sqft ')
        fl_rate = num(re.sub(r'[^\d.]', '', row['rate']))
        row.update({'sno': str(i), 'code': code, 'plinthNum': f'{area:.2f}', 'ageNum': str(age),
                    'rateSqft': f'{inr(fl_rate)}/-Sqft', 'replacementNum': row['replacement'].replace('Rs ', ''),
                    'depPct': row['depPct'], 'depAmount': row['depAmount'].replace('Rs. ', 'Rs ')})
    floors = '+'.join(codes) or 'GF'
    kind = rep.get('buildingKindTitle') or 'Residential Building'
    loc = (f'In Site Survey No : {survey}, Door No: {door}, Ward No : {ward}, In {f["landmark"]},'
           + (f' Near {near},' if near else '') + f' {f["village"]} Village Field At {lb} Of  {dotted(district)}. (Dt).')
    deed_line = sqyd_sqm_c(deed_c)
    for side in ('North', 'South', 'East', 'West'):
        if not rep.get(f'dimDeed{side}'):
            f[f'dimDeed{side}'] = deed_line
            f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or deed_line
    f.update({
        'houseTitle': f'{kind} ({floors}), {loc}', 'localBodyLine': f'{lb} Of {dotted(district)}. (Dt).',
        'surveyLine': f'Survey No : {survey},', 'doorLine': f'Door No : {door},', 'villageLine': f'{f["village"]} Village Field,',
        'wardLine': f'Ward No : {ward}, In {f["landmark"]},' + (f' Near {near},' if near else ''),
        'localBodyLine2': f'{lb} Of  {dotted(district)}. (Dt).', 'localBodyType': f'{lb} Limit, {dotted(district)}. (Dt).',
        'planLine': f'B.A. No : {f["planNo"]}, Dt : {f["planDate"]}.' if f['planNo'] != 'NA' else 'NA',
        'planLine2': f' B.A. No: {f["planNo"]}, Dt : {f["planDate"]}.' if f['planNo'] != 'NA' else 'NA',
        'planAuthority': rep.get('planAuthority') or f'Municipal Corporation Of {dotted(district)}. (Dt). ',
        'netExtentCents': cents_txt(considered), 'netExtentLine': sqm_sqyd_c(considered),
        'netSqyd': f'{trunc2(considered * SQYD_PER_CENT):.2f}',
        'extentDeed': deed_line, 'extentActual': deed_line,
        'extentDeedA': f'{trunc2(deed_c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(deed_c * SQM_PER_CENT):.2f} Sqmt  (or) ',
        'extentDeedB': f'{cents_txt(deed_c)} Cents',
        'advantage2': rep.get('advantage2') or (f'It is Near {near}' if near else ' '),
        'marketRateLine': f'Rs {inr(rate)}/- Cent', 'guidelineRateLine': f'Rs {int(guide)}/- Sqyd' if guide else '---',
        'adoptedRateLine': f'Rs {inr(rate)}/- Per Cent  x {cents_txt(considered)} Cents', 'landValueLine': f'Rs {inr(land)}/-',
        'yearLine': f'{" & ".join(codes) or "GF"} = {f["yearOfConstruction"]}',
        'ageLine': f'{age} Years' if age else 'New', 'remainingLifeLine': f'{max(life - age, 0)} Years (Total Life : {life} Years)',
        'floorsLine': rep.get('floorsLine') or f'({floors}) 0.45  Basement',
        'plinthLines': '\n'.join(plinth) or '---', 'carpetLines': '\n'.join(carpet) or '---',
        'buildingTotalNum': f'  {f["buildingTotalLine"].replace("Rs ", "")}',
    })
    parts = {}
    for part, keys in HOUSE_EXTRAS.items():
        tot = 0
        for k in keys:
            v = num(rep.get(k))
            tot += v
            f[k] = f'Rs.   {inr(v) if v else "0.00"}/-'
        parts[part] = tot
        f[part] = f'Rs.   {inr(tot) if tot else "0.00"}/-'
    building = num(re.sub(r'[^\d.]', '', f['buildingTotalLine']))
    total = land + building + sum(parts.values())
    f.update({
        'absA': f'Rs.  {inr(land)}/-', 'absB': f'Rs.  {inr(building)}/-',
        **{k: f'Rs.   {inr(parts[p]) if parts[p] else "0.00"}/-'
           for k, p in (('absC', 'partC'), ('absD', 'partD'), ('absE', 'partE'), ('absF', 'partF'))},
        'absTotal': f'Rs.  {inr(total)}/-', 'absSayAs': f'Rs.  {f["fmv"]}/-',
        'declBackground': f'1) {cents_txt(considered)} Cents of freehold land Belonging to the client. The land bearing {loc}',
    })
    common(f, case, rep, kind, loc)
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'planAuthority': 'Municipal Commissioner,',
    'planVerified': 'YES, Verified', 'planComments': 'NIL', 'postalAddress': 'As Above', 'cityTown': 'Town',
    'areaResidential': 'Residential', 'areaClass': 'High', 'localBodyType': 'Municipal Corporation',
    'occupancy': 'Owners', 'aptNature': 'Residential', 'localityType': 'Residential', 'dwellingUnits': '--',
    'facilities': 'Yes', 'carParkingType': 'Open', 'specFlooring': 'Granite', 'specDoors': 'Available',
    'specWindows': 'Available', 'specFittings': 'Available', 'specFinishing': 'Available', 'houseTax': 'Yes',
    'assessmentNo': '--', 'taxPaidName': '--', 'fsi': '--', 'occupancy2': 'Owners', 'monthlyRent': '---',
    'advantages': '-', 'comparableRate': '---',
    'adoptedBasicRate': 'I am Verified Portals Like 99 Acers.com & Magic Bricks.com etc, Butin Kadapa is Not Appearing in the respective Above Sites  & Hence we Have Considering the Local Market Value Compared to SRO Kadapa.',
    'guidelineNote': 'Copy Enclosed', 'deprRateNote': 'NA', 'x_wardrobes': '----', 'x_showcases': '---',
    'x_kitchen': '--', 'x_superfine': '--', 'x_interior': '--', 'x_electrical': '--', 'x_grills': '--',
    'x_potential': '--', 'x_others': '--', 'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_apartment(case, temps, bank=None):
    bank_apt = {**BANK, 'say_step': 10000, 'defaults': {'apartment': APT_DEFAULTS}}
    job = bob.build_apartment(case, temps, bank=bank_apt)
    f = job['fields']
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    owner_fields(f, case, rep)
    f['ownerLine1'] = f['ownerLine1'].strip()
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    apt, flat, floor = f['aptName'], f['flatNo'], f['floorName']
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    near = rep.get('nearBy')
    app, app_rel = rep.get('applicantName'), bob.relation(rep.get('applicantRel'))

    uds_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    parent_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    rate = num(rep.get('ratePerCent')) or num(rep.get('marketRatePerCent')) or num(rep.get('landRatePerSqyd')) * SQYD_PER_CENT
    land = apgb.money(uds_c * rate)
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    actual = apgb.sqft_of(rep.get('plinthActual')) or plinth
    c_rate = num(rep.get('constructionRate')) or 2200
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * c_rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    xs = ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_electrical', 'x_grills',
          'x_potential', 'x_others')
    extras = sum(num(rep.get(k)) for k in xs)
    total = composite + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=10000, bank=bank_apt)
    for k in xs:
        if num(rep.get(k)):
            f[k] = f'Rs {inr(num(rep.get(k)))}/-'
    code = bob.ORDINAL_SHORT.get(floor, floor)
    code = {'G': 'GF'}.get(code, code if code.endswith('F') else (code[0] + 'F' if code[:1].isdigit() is False else code))
    loc = (f'“ {apt}” Flat No : {flat} In {floor} Floor, Door No :  {door}, Ward No: {ward}, Site Survey No: {survey}, '
           f'{f["landmark"]},' + (f' Near {near},' if near else '') + f' {f["village"]} Village At  {lb} of  {dotted(district)} (Dt).')
    uds_yd, parent_yd = trunc2(uds_c * SQYD_PER_CENT), trunc2(parent_c * SQYD_PER_CENT)
    f.update({
        'aptNameUpper': apt.upper(), 'districtUpper': district.upper().replace('Y.S.R', 'KADAPA'),
        'floorsDesc': rep.get('floorsDesc') or f.get('floorsDesc') or '---',
        'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'applicantLabel': 'Applicant  : -' if app else DROP, 'applicantLabel2': 'Applicant   : -' if app else DROP,
        'applicantLine': f'{app}, {app_rel.rstrip(".")}.' if app and app_rel else (app or DROP),
        'applicantName': f'{app}, ' if app else DROP, 'applicantRel': f'{app_rel.rstrip(".")}.' if app and app_rel else DROP,
        'applicantAddr': (rep.get('applicantAddr') or DROP) if app else DROP,
        'deedLabel': rep.get('deedLabel') or 'Sale Deed No', 'udsSqyd': f'{uds_yd:.2f}', 'parentSqyd': f'{parent_yd:.2f}',
        'udsCents': cents_txt(uds_c), 'floorLine': f'{floor} Floor',
        'aptTitle': f'Residential Flat In {loc}', 'localBodyLine': f'{lb}; {dotted(district)}. (Dt).',
        'flatDesc': rep.get('flatDesc') or f'Flat No. {flat}, {floor} Floor With Framed  Structured R.C.C Roof.',
        'surveyLine': f'Survey No’s :- {survey}', 'surveyLine2': f'Survey No :- {survey},', 'doorLine': f'Door No : {door},',
        'villageLine': f'{f["village"]} Village Field', 'wardLine': f'Ward No: {ward}, {f["landmark"]},',
        'wardNoLine': f'Ward No: {ward},', 'localBodyName': lb, 'districtDotted': dotted(district),
        'pinCode': rep.get('pinCode') or '---', 'aptLocation': loc,
        'parentLine': f'{parent_yd:.2f} Sqyds (or) {cents_txt(parent_c)} Cents' if parent_c else '---',
        'flatNoLine': f'Flat No: {flat},', 'udsLine': f'{uds_yd:.2f} Sqyds (or) {cents_txt(uds_c)} Cents',
        'deedExecutant': f'{f["owner1Name"]}, ', 'deedExecutantRelation': f['owner1RelLine'].strip() if f['owner1RelLine'] != DROP else ' ',
        'plinthPlanLine': f'As Per Plan {code}     =  {plinth:.2f} Sqft ', 'plinthActualLine': f'As Per Actual {code}  =  {actual:.2f} Sqft ',
        'carpetPlanLine': f'As Per Plan {code}     =  {plinth * 0.85:.2f} Sqft ', 'carpetActualLine': f'As Per Actual {code}  =  {actual * 0.85:.2f} Sqft',
        'buildingCalc': f'Building = {plinth:.2f} Sft x Rs {int(c_rate)}/-  =  Rs {inr(bld)}/-',
        'landCalc': f' = {cents_txt(uds_c)} Cents x Rs {inr(rate)}/- Cent= Rs {inr(land)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'ageLine': 'New' if not age else f'{age} Years', 'lifeLine': f'{life} Years,',
        'deprLine': f'{dep_pct:g}%  =   Rs {inr(dep) if dep else "0.00"}/-', 'deprBuildingLine': f'Rs {inr(net)}/-',
        'landValueLine': f'Rs  {inr(land)}/-', 'compositeLine': f'Rs  {inr(composite)}/-',
        'plinthSqft': f'{actual:.2f} Sqft', 'unitRateLine': f' Rs {composite / actual:.2f}/- Sqft' if actual else '--',
        'grandTotalLine': f'Rs {inr(total)}/-', 'sayLine': f'Rs {inr(fmv)}/-',
        'declBackground': f'{uds_yd:.2f}  Sqyds of Undivided land belonging to the client. The land bearing At  Residential Flat In {loc}',
    })
    common(f, case, rep, 'flat', loc)
    f['declPurpose'] = f'For collateral security. Manager, INDIAN OVERSEAS BANK, {f["bankBranchUpper"]}, {dotted(district)} (Dt),'
    f['declDates1'] = f'Date of appointment: {f["inspectionDate"]}, '
    f['declDates3'] = f'Date of report: {f["reportDate"]}.'
    apply_overrides(f, rep)
    return job


# ---------------------------------------------------------------- OPEN SITE (one or two deeds)
SITE_DEFAULTS = {
    'purpose': 'Bank Purpose', 'planLine': 'NA', 'mvCertificate': 'Copy Enclosed', 'tenure': 'Free Hold',
    'postalAddress': 'As of The Above', 'cityTown': 'City', 'areaResidential': 'NA', 'areaCommercial': 'Residential Area',
    'areaIndustrial': 'NA', 'areaClass': 'Middle', 'areaUrban': 'Urban', 'govtEnactments': 'NA', 'agriConversion': 'NA',
    'occupancy': 'Vacant Site', 'locality': 'Middle', 'surroundings': 'Residential', 'flooding': 'Nil',
    'civicAmenities': 'At Walkable Distance', 'levelOfLand': 'Level Ground', 'landShape': 'Rectangular',
    'landUse': 'Residential', 'usageRestriction': 'Nil', 'layoutApproved': 'No, But Boundaries Are Clear',
    'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Provided', 'roadType': 'CC Road', 'roadWidth': '30’0”  Wide Road',
    'landLocked': 'No', 'water': 'Available', 'sewerage': 'Provided', 'power': 'Provided',
    'advantage1': 'Good Residential Area', 'specialRemarks': 'Nil', 'guidelineNote': 'Copy Enclosed',
    'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(SITE_DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    f['ownerLine1'] = f['ownerLine1'].strip()
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    village, ward, landmark = rep.get('village') or '---', rep.get('wardNo') or pd.get('wardNo') or '---', rep.get('landmark') or '---'
    near = rep.get('nearBy')
    survey, plot = f['surveyNo'] or '---', f['plotNo'] or '---'
    two = bool(rep.get('deed2No'))
    d1 = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    d2 = apgb.extent_in_cents(rep.get('extent2Raw')) if two else 0
    total_c = d1 + d2
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw'))
    considered = min(total_c, plan_c) if plan_c else total_c
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land = apgb.money(considered * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=5000, bank=BANK)

    def ext(c):
        return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {cents_txt(c)} Cents'
    deed1, deed2 = pd.get('deedNo') or '---', rep.get('deed2No')
    ddate1 = apgb.ddmmyyyy(pd.get('deedDate')) or '---'
    ddate2 = apgb.ddmmyyyy(rep.get('deed2Date')) or rep.get('deed2Date') or ddate1
    loc = (f'In Site Survey No’s : {survey}, Plot No’s : {plot}, Ward No : {ward}, In {landmark},' + (f' Near {near},' if near else '')
           + f' {village} Village Field At {lb} Of {dotted(district)}. (Dt).')
    f.update({
        'districtDotted': dotted(district) + '.', 'localBodyName': lb, 'landmark': landmark,
        'nearVillage': (f'Near {near}, ' if near else '') + f'{village} Village Field',
        'deed1Cents': cents_txt(d1), 'totalCents': cents_txt(total_c),
        'deed2Line': f'      Deed No    :   {deed2}                            Extent   :    {cents_txt(d2)} Cents' if two else DROP,
        'surveyCont': ' ', 'siteTitle': f'{rep.get("siteType") or "Residential Vacant Site"}, {loc}',
        'localBodyLine': f'{lb} of {dotted(district)} (Dt).',
        'deedLine1': f'Deed No : {deed1}, Dt : {ddate1}.', 'deedLine2': f'Deed No : {deed2}, Dt : {ddate2}.' if two else DROP,
        'surveyLine': f'Survey No’s : {survey},', 'plotLine': f'Plot No’s : {plot},', 'villageLine': f'{village} Village Field,',
        'wardLine': f'Ward No : {ward}, In {landmark},' + (f' Near {near},' if near else ''),
        'deed1Head': f'As Per Deed/Actual ({deed1})', 'deed2Head': f'As Per Deed/Actual ({deed2})' if two else 'As Per Actual',
        'totalHead': f'As Per Actual ({deed1} +  {deed2})' if two else f'As Per Actual ({deed1})',
        'deed1Extent': ext(d1), 'deed2Extent': ext(d2) if two else ext(d1),
        'totalExtentLine': ext(total_c), 'totalExtentA': ext(considered).rsplit(' ', 2)[0] + ' ',
        'totalExtentB': f'{cents_txt(considered)} Cents', 'netExtentPlanLine': ext(plan_c) if plan_c else 'NA',
        'marketRateLine': f'Rs {inr(rate)}/- Cent', 'adoptedRateLine': f'{cents_txt(considered)} Cent x Rs {inr(rate)}/- Cent',
        'landValueLine': f'= Rs {inr(land)}/-', 'absA': f'Rs {inr(land)}/-', 'absTotal': f'Rs {inr(land)}/-',
        'absSayAs': f'Rs {inr(fmv)}/-',
        'declBackground': f'{cents_txt(considered)} Cents of freehold land belonging to the client. The Land Bearing At {loc.rsplit(" At ", 1)[0].replace(f" {village} Village Field", "")} ',
        'declBackground2': f'{village} Village Field At {lb} Of {dotted(district)}. (Dt).',
    })
    bd2 = rep.get('boundaries2') or {}
    for side in ('North', 'South', 'East', 'West'):
        f[f'bd2{side}'] = bd2.get(side.lower()) or (f[f'bdDeed{side}'] if not two else '---')
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or (f[f'dimDeed{side}'] if not two else '---')
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    common(f, case, rep, 'site', loc)
    f['declPurpose'] = f'For collateral security. Manager, IOB, {(case.get("bankBranch") or "---").strip()}, {dotted(district)}. (Dt).'
    f['declDates1'] = f'Date of appointment: {f["inspectionDate"]} '
    f['declDates2'] = f'Valuation date : {f["reportDate"]} '
    f['declDates3'] = f'Date of report  : {f["reportDate"]}.'
    images = apgb.geo_and_photos(case, rep, f, temps, 3)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site}
TEMPLATES = {name: f'iob_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Indian Overseas Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
