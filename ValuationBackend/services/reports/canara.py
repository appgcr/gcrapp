"""
Canara Bank report builder (the bank's own formats in canara_source/).

Canara Bank's rules, read from the bank's sample reports:
  • Present market value (PMR column) = land + buildings + amenities + services; "Say" = rounded down to ₹1,000
  • Realizable 95% and forced-sale (distress) 90% of that, rounded to the nearest ₹5,000
  • Buildings built at different times are valued separately, depreciation 1% per year of age
  • A second column shows the value by the Government guideline rate (GLR)
"""
import datetime as dt
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, extent_in_cents, SQYD_PER_CENT, SQM_PER_CENT, money

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
BANK = {'label': 'Canara Bank', 'realizable': 0.95, 'distress': 0.90, 'say_step': 1000, 'site_say_step': 1000,
        'value_round': 5000, 'pct_of': 'say', 'defaults': {}}
from make_templates_canara import AMENITIES, SERVICES  # noqa: E402


def owners(f, case, rep):
    bob.owners(f, case, rep)
    for n in (1, 2, 3):
        if f[f'ownerLine{n}'] != DROP:
            f[f'ownerLine{n}'] = re.sub(r'\. ([SWDC]/o)', r', \1', f[f'ownerLine{n}'])


def ext_line(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {c:.2f} Cents'


def rs(v, dash='Rs ----'):
    return f'Rs {inr(v)}/-' if v else dash


HOUSE_DEFAULTS = {
    'purpose': 'For bank Purpose', 'mvCertificate': 'Copy Enclosed', 'scope': 'Enquire from local people',
    'cityTown': 'Kadapa Municipal Corporation, Y.S.R. (Dt).', 'areaResidential': 'Yes', 'areaCommercial': '---',
    'areaIndustrial': '---', 'localBodyType': 'Kadapa Municipal Corporation, Y.S.R. (Dt).', 'govtEnactments': 'NA',
    'agriConversion': 'No', 'electricityLine': '---', 'occupiedBy': 'Owner’s/ Tenants/ Both / Vacant (Purchase)',
    'monthlyRent': '---', 'rentNote': 'N.A', 'locality': 'Middle', 'localityClass': 'Residential',
    'surroundings': 'Developing', 'flooding': 'Nil', 'civicAmenities': 'Near By', 'levelOfLand': 'Level Of Ground',
    'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil', 'layoutApproved': 'No',
    'cornerPlot': 'Intermittent Plot', 'roadFacilities': 'Yes', 'landLocked': 'No', 'roadType': 'CC Road',
    'roadWidth': 'Below 20 Feet Wide Road', 'sewerage': 'No', 'advantage1': 'Good Residential Area',
    'specialRemarks': 'Nil', 'marketabilityFactors': 'Topography', 'landType': 'Residential', 'accessibility': 'Yes',
    'pmrRateLine': '--', 'planAuthority': 'Kadapa Municipal Commissioner', 'sroName': 'Cuddapah (R.O)',
    'plusFactors': 'Rs. 0.00/-', 'minusFactors': 'Rs.0.00/-', 'blank': ' ', 'floorsLine': 'Ground Floor',
    'buildingDesc': 'Residential Building (GF)', 'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R',
    'place': 'Kadapa', 'totalLifeLine': '60 Years',
    **{f'spec{f}_{k}': v for f, d in (('GF', True), ('FF', True), ('SF', False)) for k, v in (
        ('foundation', 'R.C.C Framed Structure' if d else '--'), ('floorFinish', 'Marble' if d else '--'),
        ('superstructure', 'Brick masonry C.M (1:4)' if d else '--'), ('roof', 'R.C.C Roof' if d else '--'),
        ('doors', 'Provided' if d else '--'), ('windows', 'Provided' if d else '--'), ('weathering', 'Yes' if d else '--'))},
}


def build_house(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, HOUSE_DEFAULTS)
    owners(f, case, rep)
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    loc = rep.get('locationText') or rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or HOUSE_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb} Of  {district}. (Dt).'
    branch = re.sub(r',?\s*kadapa.*$', '', case.get('bankBranch') or 'Branch', flags=re.I)
    postal = f'At In Site Survey No : {survey}, Door No’s : {door}, Ward No : {ward}, {loc}, {village} Village Filed At {local_body}'
    two = bool(rep.get('deed2No'))
    plan2 = rep.get('plan2No')
    d1 = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    d2 = extent_in_cents(rep.get('deed2ExtentRaw')) if two else 0
    total_c = d1 + d2
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw')) or total_c
    considered = min(total_c, plan_c) if plan_c else total_c
    deed1, deed2 = pd.get('deedNo') or '---', rep.get('deed2No')
    dd1 = apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---'
    dd2 = apgb.ddmmyyyy(rep.get('deed2Date')) or '---'
    f.update({
        'wardNo': ward, 'locationText': loc, 'village': village, 'localBody': local_body,
        'localBodyUpper': f'{lb.upper()}, {district} (Dt).', 'postalAddress': postal,
        'bankBranchName': branch, 'branchPlace': rep.get('branchPlace') or f'Kadapa Town, {district}. (Dt).',
        'bankBranchLine': f'{branch}, Kadapa City, {district} (Dt).', 'bankPurposeLine': f'Canara Bank, {branch}, Kadapa Town, {district} (Dt).',
        'ownerPhone': case.get('clientPhone') or DROP, 'ownerPhoneLine': f"Cell No : {case['clientPhone']}." if case.get('clientPhone') else DROP,
        'deedNo': deed1, 'deed1Cents': f'{d1:.2f}', 'deed2No': deed2 if two else DROP, 'deed2Cents': f'{d2:.2f}' if two else DROP,
        'totalCents': f'{total_c:.2f}', 'planCents': f'{plan_c:.2f}',
        'deed1Line': f'Deed No :- {deed1}, Dt : {dd1}.', 'deed2Line': f'Deed No :- {deed2}, Dt : {dd2}.' if two else DROP,
        'plan1Line': f'B.A. No : {f["planNo"]}, Dt : {f["planDate"]}.' if f['planNo'] else 'NA',
        'plan2No': plan2 or DROP, 'plan2Date': apgb.ddmmyyyy(rep.get('plan2Date')) or '---' if plan2 else DROP,
        'plan2Line': f"B.A. No : {plan2}, Dt : {apgb.ddmmyyyy(rep.get('plan2Date')) or '---'}." if plan2 else DROP,
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'deedCountWord': 'Two' if two else 'One', 'deedDatesLine': f'{dd1} & {dd2}' if two else dd1,
        'deedNosLine': f'{deed1}, {deed2}' if two else deed1,
        'deed1Header': f'A (As per Deed {deed1}) ', 'deed2Header': f'A (As per Deed {deed2})' if two else ' ',
        'deed1ExtentLine': ext_line(d1), 'deed2ExtentLine': ext_line(d2) if two else ' ',
        'totalExtentSummary': (f'Total Extent : Deed {deed1.split("/")[0]} + Deed {deed2.split("/")[0]} = {ext_line(total_c)}'
                               if two else f'Total Extent : {ext_line(total_c)}'),
        'netExtentPlan': ext_line(plan_c), 'extentConsidered': ext_line(considered),
        'consideredCents': f'{considered:.2f}', 'consideredYd': f'{trunc2(considered * SQYD_PER_CENT):.2f}',
        'surveyLine': f'Survey No :- {survey}, ', 'doorLine': f'Door No’s :- {door},', 'villageLine': f'{village} Village Field,',
        'wardLine': f'Ward No: {ward}, {loc},', 'localBodyComma': f'{lb}, {district} (Dt).',
        'assessmentNo': pd.get('assessmentNo') or '---',
        'taxAmountLine': f"Rs {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '---',
        'taxPaidName': f'{f["owner1Name"]}, ',
        'briefDescription': rep.get('briefDescription') or f'The Residential Building With R.C.C. Roof, R.C.C. Framed Structure {postal}',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'bd2{side}'] = rep.get(f'bd2{side}') or ('---' if two else ' ')
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or ('---' if two else ' ')

    # Land: adopted market rate per cent; guideline value per Sqyd
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    pmr = num(rep.get('pmrRatePerCent'))
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = money(considered * rate)
    glr_land = money(trunc2(considered * SQYD_PER_CENT) * guide) if guide else 0
    f.update({
        'marketRate': inr(rate), 'guideRate': f'{int(guide)}' if guide else '---',
        'marketRateLine': f'Rs {inr(rate)}/- Per Cent', 'landValueLine': f'Rs {inr(land)}/-',
        'pmrRateLine': f'Rs  {inr(pmr)}/- Per Cent' if pmr else HOUSE_DEFAULTS['pmrRateLine'],
        'guidelineRateLine': f'Rs {int(guide)}/- Per Sqyds' if guide else '---',
        'glrLandLine': f'Rs {inr(glr_land)}/-(Land)' if guide else '---',
    })

    # Buildings (each phase valued separately; 1% depreciation per year of age)
    year_now = dt.date.today().year
    blds = [b for b in (rep.get('buildings') or []) if b]
    if not blds:
        floors = (pd.get('siteValue') or {}).get('floors') or []
        area = sum(num(x.get('value')) for x in floors)
        age0 = int(num(pd.get('buildingAge')))
        blds = [{'label': rep.get('buildingLabel') or 'GF', 'area': area, 'year': rep.get('yearOfConstruction') or year_now - age0,
                 'rate': rep.get('constructionRate') or 2000}]
    rows, total_net, ages, lefts = [], 0, [], []
    for i, b in enumerate(blds[:3], start=1):
        area, rate_b = num(b.get('area')), num(b.get('rate')) or 2000
        year = int(num(b.get('year'))) or year_now
        age = max(year_now - year, 0)
        pct = min(age * 1.0, 70.0)
        repl = money(area * rate_b)
        dep = money(repl * pct / 100)
        net = repl - dep
        total_net += net
        ages.append(f'{age} Years')
        lefts.append(f'{max(60 - age, 0)} Years')
        label = b.get('label') or 'GF'
        rows.append({'sno': str(i), 'label': label, 'year': str(year), 'roof': b.get('roof') or 'R.C.C Roof',
                     'plinth': f'{area:.2f}\nSqft', 'cantilever': '-', 'plinthSqft': f'{area:.2f}\nSqft',
                     'height': b.get('height') or '10 Ft', 'ageLine': f'{age} Years', 'rateLine': f'Rs {int(rate_b)}/- Sqft',
                     'repl': f'Rs {inr(repl)}/-', 'depPct': f'(-{pct:g}%)', 'dep': f'Rs {inr(dep)}/-', 'net': f'Rs {inr(net)}/-'})
        f.update({f'b{i}Plinth': f'{area:.2f} Sqft', f'b{i}Year': str(year), f'b{i}DepPct': f'-{pct:g}%',
                  f'b{i}RateLine': f'{label} = Rs {int(rate_b)}/- Per Sqft', f'b{i}Repl': f'Rs {inr(repl)}/-',
                  f'b{i}Dep': f'(-{pct:g}%) Rs {inr(dep)}/-', f'b{i}Net': f'Rs {inr(net)}/-'})
    for i in range(len(rows) + 1, 4):
        for k in ('Plinth', 'Year', 'DepPct', 'RateLine', 'Repl', 'Dep', 'Net'):
            f[f'b{i}{k}'] = '--' if k in ('Plinth', 'Year') else ' '
    plinth_lines = '\n'.join(f"{r['label']}= {num(r['plinth']):.2f} Sqft" for r in rows)
    f.update({
        'agesLine': ' & '.join(ages), 'lifeLeftLine': ' & '.join(lefts),
        'plinthTotalLine': f"{sum(num(r['plinth']) for r in rows):.2f} Sqft", 'buildingTotalLine': f'Rs {inr(total_net)}/-',
        'plinthPlan': rep.get('plinthPlanText') or f'As Per Plan :- \n{plinth_lines}',
        'plinthActual': rep.get('plinthActualText') or f'Actual On The Ground :-\n{plinth_lines}',
        'carpetPlan': rep.get('carpetText') or 'As Per Plan :- \n' + '\n'.join(f"{r['label']}= {num(r['plinth']) * 0.85:.2f} Sqft" for r in rows),
        'carpetActual': rep.get('carpetText') or 'Actual On The Ground :- \n' + '\n'.join(f"{r['label']}= {num(r['plinth']) * 0.85:.2f} Sqft" for r in rows),
    })

    # Amenities & services
    am = sum(num(rep.get(k)) for k in AMENITIES)
    sv = sum(num(rep.get(k)) for k in SERVICES)
    for k in AMENITIES + SERVICES:
        v = num(rep.get(k))
        f[k] = f'Rs {inr(v)}' if v else 'Rs ----'
    f['amenitiesTotal'] = rs(am, 'Rs 0.00/-')
    f['servicesTotal'] = rs(sv, 'Rs 0.00/-')
    total = land + total_net + am + sv
    fmv, _, _ = bob.final_values(f, case, rep, 'house', total, bank=BANK)
    glr_bld = num(rep.get('glrBuildingValue'))
    f.update({
        'glrLand': rs(glr_land, '---'), 'glrBuilding': rs(glr_bld, '---'), 'glrTotal': rs(glr_land + glr_bld, '---'),
        'pmrLand': f'Rs  {inr(land)}/-', 'pmrBuilding': f'Rs  {inr(total_net)}/-', 'pmrAmenities': f'Rs  {inr(am)}/-',
        'pmrServices': f'Rs  {inr(sv)}/-', 'pmrTotal': f'Rs  {inr(total)}/-', 'pmrSay': f'Rs  {inr(fmv)}/-',
        'presentValueLine': f'Rs {inr(fmv)}/-',
        'realizableWords': words(num(f['realizable'])), 'distressWords': words(num(f['distress'])),
        'declBackground': f'{considered:.2f} Cents of freehold land & Building belonging to the client. The {f["buildingDesc"]}, {postal}',
        'declPurpose': f'For collateral security. The Branch Manager, Canara Bank, {branch}, Kadapa Town, {district} (Dt).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date : {f["reportDate"]}, ', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 12)
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {'bd': rows}, 'images': images}



# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'Purchase loan', 'mvCertificate': 'Copy Enclosed', 'layoutLine': 'N.A', 'planAuthority': 'Kadapa Municipal Corporation',
    'planVerified': 'Yes, Verified', 'planComments': 'Nil', 'cityTown': 'Kadapa Town', 'areaResidential': 'Yes',
    'areaCommercial': '--', 'areaIndustrial': '--', 'areaClass': 'Middle Class', 'localBodyType': 'Corporation Limits',
    'govtEnactments': 'N.A', 'occupancy': 'Vacant', 'aptNature': 'Residential Apartment', 'blockNo': '--',
    'structure': 'R.C.C Framed Structure', 'quality': 'Superior/I class/ II Class', 'appearance': 'Superior/I class/ II Class',
    'maintenance': 'Good', 'lift': 'Available', 'protectedWater': 'Available', 'sewerage': 'Available',
    'carParking': 'Available', 'carParkingType': 'Open', 'compoundWall': 'Yes', 'pavement': 'Yes', 'otherFacility': 'Nil',
    'specRoof': 'R.C.C', 'specFlooring': 'Tiles', 'specDoors': 'Wooden Doors', 'specWindows': 'Wooden Windows',
    'specFittings': 'Provided', 'specFinishing': 'Provided', 'houseTax': 'N.A', 'electricityNo': 'Not Submitted',
    'meterName': ' ', 'flatMaintenance': 'Good', 'fsi': ' ', 'flatClass': 'I Class', 'usage': 'Residential Flat',
    'occupancy2': 'Vacant', 'monthlyRent': 'N.A', 'marketability': 'Good', 'advantages': 'Good Residential Area',
    'negatives': 'Nil', 'comparableRate': 'As Per Local Enquiry', 'adoptedBasicRate': '--', 'guidelineNote': 'Copy Enclosed',
    'plusFactors': 'Rs 0.00', 'minusFactors': 'Rs 0.00/-', 'carParkingRate': ' ', 'forcedLessPct': '10',
    'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa', 'deedNote': ' ',
    **{k: ' ' for k in ('x_carParking', 'x_showcases', 'x_superfine', 'x_interior', 'x_deposits', 'x_electrical',
                        'x_grills', 'x_potential', 'x_commonAmenities')}, 'x_wardrobes': ' ', 'x_kitchen': 'Rs 0.00',
}


def build_apartment(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, APT_DEFAULTS)
    owners(f, case, rep)
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    loc = rep.get('locationText') or rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or APT_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb} of  {district} (Dt).'
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    branch = re.sub(r',?\s*kadapa.*$', '', case.get('bankBranch') or 'Branch', flags=re.I)
    site = f'Site Survey No : {survey}, Ward No : {ward}, {loc}, {village} Village Field At {local_body}'
    two = bool(rep.get('deed2No') or rep.get('plot2Label'))
    f.update({
        'aptName': apt, 'aptNameUpper': apt.upper(), 'builderName': pd.get('builderName') or '---',
        'flatNo': flat, 'floorName': floor, 'wardNo': ward, 'locationText': loc, 'village': village,
        'localBody': local_body, 'localBodyUpper': f'{lb.upper()}; {district}. (Dt).',
        'bankBranchName': branch, 'bankBranchShort': re.sub(r'\s*branch$', '', branch, flags=re.I),
        'owner2Addr': rep.get('owner2Addr') or DROP,
        'applicantLabelCell': 'Applicant : -' if f['applicantName'] != DROP else 'Belongs to : -',
        'applicantRelLine': (f"  {f['applicantRel']}." if f['applicantName'] != DROP and f['applicantRel'] != DROP
                             else (f"  {f['owner1Rel']}." if f['owner1Rel'] != DROP else DROP)),
        'deedLineShort': f"{pd.get('deedNo') or '---'}.  Dt:- {f['deedDate'] if 'deedDate' in f else apgb.ddmmyyyy(pd.get('deedDate')) or '---'}",
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'briefDescription': f'The Residential Flat No:-{flat}, In“ {apt}, In  {floor} Floor, {site}',
        'surveyLine': f'Survey No:- {survey},', 'flatLine': f'Flat No:- {flat}, {floor} Floor,',
        'villageLine': f'{village} village Field,', 'wardLine': f'Ward No:- {ward},',
        'flatDescription': rep.get('flatDescription') or f'RCC Roof with RCC Framed structured. Residential Flat No:- {flat}, {floor} Floor, {site}',
        'aptNameLine': f'“{apt}” Residential Apartment',
        'flatPostal': f'Flat No:- {flat}, {floor} Floor, “{apt}” Apartment, {site}',
        'wardLocLine': f'Ward No: {ward}, {loc}.', 'villageLbLine': f'{village} Village Field {lb} of {district} (Dt)',
        'areaLine': rep.get('areaName') or loc, 'localityDesc': loc,
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'unitsLine': f"{rep['dwellingUnits']} Units" if rep.get('dwellingUnits') else ' ',
        'floorLine': f'{floor} Floor', 'flatNoLine': f'Flat No:- {flat},',
        'assessmentNo': pd.get('assessmentNo') or 'N.A',
        'taxAmountLine': f"Rs {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else 'N.A',
        'taxPaidName': rep.get('taxPaidName') or 'N.A', 'deedExecutant': rep.get('deedExecutant') or pd.get('builderName') or '---',
        'deedCountWord': 'Two' if two else 'One',
        'additionsTitleUpper': f'“{apt.upper()}” (RESIDENTIAL APARTMENT), FLAT NO : {flat}, IN  {floor.upper()} FLOOR, {site.upper()}',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or ('---' if two else ' ')
    # Land: undivided share in cents x rate per cent
    d1 = extent_in_cents(rep.get('extentDeedRaw'))
    d2 = extent_in_cents(rep.get('deed2ExtentRaw')) if two else 0
    parent_c = extent_in_cents(rep.get('parentExtentDeedRaw')) or (d1 + d2)
    uds_c = extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_yd, parent_yd = uds_c * SQYD_PER_CENT, parent_c * SQYD_PER_CENT
    yd = lambda c: f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {c:.2f} Cents'
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land = money(uds_c * rate_cent)
    plot1 = rep.get('plot1Label') or f"Plot No: {pd.get('plotNo') or '---'}"
    f.update({
        'plotNo': pd.get('plotNo') or '---',
        'deed1Header': f'As Per Deed {plot1}', 'deed2Header': f"As Per Deed {rep.get('plot2Label') or ''}" if two else ' ',
        'deed1ExtentLine': yd(d1) if d1 else '---', 'deed2ExtentLine': yd(d2) if two else ' ',
        'totalExtentSummary': (f'{trunc2(d1 * SQYD_PER_CENT):.2f} Sqyds + {trunc2(d2 * SQYD_PER_CENT):.2f} Sqyds = '
                               f'{trunc2(parent_yd):.2f} Sqyds (or) {parent_c:.2f} Cents') if two else yd(parent_c),
        'udsCents': f'{uds_c:.2f}', 'udsYd': f'{trunc2(uds_yd):.2f}', 'parentYd': f'{trunc2(parent_yd):.2f}',
        'udsOutOf': f'{trunc2(uds_yd):.2f} Sqyds  Out Of  {trunc2(parent_yd):.2f} Sqyds',
        'udsCentsLine': f'{uds_c:.2f} Cents',
        'landCalc1': f'= {uds_c:.2f} Cents  x Rs {inr(rate_cent)}/-', 'landCalc2': f'= Rs {inr(land)}/-',
        'landValueLine': f'Rs {inr(land)}/-',
    })
    # Flat
    plinth = apgb.sqft_of(rep.get('plinthArea')) or num((pd.get('siteValue') or {}).get('plinthArea')) or \
        sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    rate = num(rep.get('constructionRate')) or 2800
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * 1.0, 70.0)
    bld = money(plinth * rate)
    dep = money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    extras = 0
    for k in ('x_carParking', 'x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_deposits',
              'x_electrical', 'x_grills', 'x_potential', 'x_commonAmenities'):
        v = num(rep.get(k))
        if v:
            f[k] = f'Rs {inr(v)}/-'
            extras += v
    total = composite + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, bank=BANK)
    status = (rep.get('buildingStatus') or '').lower()
    f.update({
        'yearOfConstruction': rep.get('yearOfConstruction') or str(dt.date.today().year - age),
        'ageLine': f'{age} Years' if age else 'New', 'remainingLifeLine': str(max(life - age, 0)),
        'totalLifeLine': f'{life} Year’s', 'lifeLine': f'{life} Years',
        'maintenance': rep.get('maintenance') or ('Under Construction' if 'semi' in status else 'Good'),
        'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'buildingCalc': f'Building = {plinth:.2f} Sqft x Rs {int(rate)}/- =  Rs {inr(bld)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'deprPctLine': f'{dep_pct:g}%', 'deprAmountLine': f'Rs. {inr(dep) if dep else "0.00"}/-',
        'deprValueLine': f'Rs {inr(net)}/-', 'deprBuildingLine': f'Rs {inr(net)}/-', 'compositeLine': f'Rs {inr(composite)}/-',
        'unitRateLine': f'Rs {trunc2(composite / plinth):.2f} Sqft' if plinth else '--',
        'grandTotalLine': f'Rs {inr(total)}/-', 'sayLine': f'Say Rs {inr(fmv)}/-', 'presentValueLine': f'Rs.{inr(fmv)}/-',
        'fmvWordsRs': 'Rs. ' + words(fmv)[7:].replace(' Only', ' only'),
        'declBackground': (f'1) {uds_c:.2f} Cents belonging to the client. The Residential Flat “{apt}” (Residential Apartment), '
                           f'Flat No : {flat}, In  {floor} Floor, {site}'),
        'declPurpose': f'For collateral security.  The Manager, Canara bank , {branch}, Kadapa, {district} (Dt)',
        'declDates1': f'Date of appointment: {f["inspectionDate"]},', 'declDates2': f'Valuation date: {f["reportDate"]},',
        'declDates3': f'Date of report: {f["reportDate"]}.',
    })
    # Proposed additions
    adds = rep.get('additions') or [a for a in (pd.get('additionsWork') or []) if a]
    drop = []
    if adds:
        ad_total = 0
        for i, a in enumerate(adds[:11], start=1):
            amt = num(a.get('amount')) or num(a.get('rate')) * (num(a.get('quantity')) or 1)
            ad_total += amt
            f[f'ad{i}_amt'] = f'{inr(amt)}.00'
            f[f'ad{i}_rate'] = inr(num(a.get('rate'))) if a.get('rate') else inr(amt)
            f[f'ad{i}_qty'] = str(a.get('quantity') or 'L.S')
            f[f'ad{i}_desc'] = (f"PROPOSED TO PROVIDE {(a.get('description') or '').upper()}, INCLUDING COST OF AND CONVEYANCE OF "
                                f"MATERIAL AND LABOUR CHARGES COMPLETELY.")
        for i in range(len(adds) + 1, 12):
            f[f'ad{i}_amt'] = f[f'ad{i}_rate'] = f[f'ad{i}_qty'] = f[f'ad{i}_desc'] = DROP
        f.update({'adTotal': inr(ad_total), 'adWordsUpper': words(ad_total).upper()})
    else:
        drop.append('additions')
    for n in (1, 2, 3):      # Canara writes "Name, S/o …"
        if f[f'ownerLine{n}'] != DROP:
            f[f'ownerLine{n}'] = f[f'ownerLine{n}'].replace('. S/o', ', S/o').replace('. W/o', ', W/o').replace('. D/o', ', D/o')
    images = apgb.geo_and_photos(case, rep, f, temps, 6)
    if 'map1' in images:
        images['gmap1'] = images['gmap2'] = images['map1']
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images, 'drop': drop}



# ---------------------------------------------------------------- OPEN SITE (90% / 80%)
SITE_DEFAULTS = {
    'purpose': 'For Bank Purpose', 'mvCertificate': 'Copy Enclosed', 'locality': 'Residential', 'localityClass': 'Middle Class',
    'surroundings': 'Developing Area', 'flooding': 'No', 'civicAmenities': 'Near by', 'levelOfLand': 'Level Of Ground',
    'landShape': 'Rectangular', 'landUse': 'Residential', 'usageRestriction': 'Nil', 'tenure': 'NA', 'layoutApproved': 'No',
    'approvalProblem': 'No', 'cornerPlot': 'Intermittent Plot', 'depthRatio': '--', 'roadFacilities': 'Yes',
    'roadType': 'CC Road', 'roadWidth': '30’0” Feet Wide Road', 'landLocked': 'No', 'water': 'Yes, Available',
    'sewerage': 'No', 'power': 'Yes', 'advantage1': 'Nil', 'disadvantage1': 'Nil', 'siteType': 'Residential Vacant Site',
    'plusFactors': 'Rs. 0.00/-', 'minusFactors': 'Rs. 0.00/-', 'sroName': 'Cuddapah (R.O)', 'staffInitials': ' ',
    'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_open_site(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, SITE_DEFAULTS)
    owners(f, case, rep)
    survey, plot = f['surveyNo'] or '---', pd.get('plotNo') or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    loc = rep.get('locationText') or rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or SITE_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb} Of {district}. (Dt).'
    branch = re.sub(r',?\s*kadapa.*$', '', case.get('bankBranch') or 'Branch', flags=re.I)
    postal = f'In Site Survey No’s : {survey}, Plot No : {plot}, Ward No : {ward}, In {loc}, {village} Village Field At {local_body}'
    deed_c = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = money(considered * rate)
    yd = trunc2(considered * SQYD_PER_CENT)
    glr_land = money(yd * guide) if guide else 0
    extras = sum(num(rep.get(k)) for k in ('ex_compoundWall', 'ex_bore', 'ex_water', 'ex_power'))
    total = land + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', total, step=5000,
                                 bank={**BANK, 'realizable': 0.90, 'distress': 0.80, 'value_round': 1000})
    ext3 = lambda c: f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmts (or) {c:.3f} Cents'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    for k in ('ex_compoundWall', 'ex_bore', 'ex_water', 'ex_power'):
        f[k] = f'Rs {inr(num(rep.get(k)))}/-' if num(rep.get(k)) else 'Rs --'
    f.update({
        'plotNo': plot, 'wardNo': ward, 'locationText': loc, 'village': village, 'localBody': local_body,
        'localBodyLine': f'{lb} of {district} (DT).', 'localBodyComma': f'{lb}, {district}. (Dt).',
        'bankBranchName': branch, 'branchPlace': rep.get('branchPlace') or f'Kadapa, {district} (Dt).',
        'bankBranchLine': f'{branch}, Kadapa City, {district}  (Dt).', 'postalAddress': postal,
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'deedCountWord': 'One',
        'deedLine': f"Deed No : {pd.get('deedNo') or '---'},  Date : {apgb.ddmmyyyy(pd.get('deedDate')) or '---'}.",
        'plotLine': f'Plot No : {plot},', 'surveyLine': f'Survey No’s : {survey},', 'villageLine': f'{village} Village Field,',
        'wardLine': f'Ward No : {ward}, In {loc},',
        'extentDeed': ext3(deed_c), 'extentActual': ext3(deed_c), 'netExtentPlan': ext3(plan_c), 'extentConsidered': ext3(considered),
        'consideredCents': f'{considered:.3f}', 'consideredYd': f'{yd:.2f}', 'guideRate': inr(guide) if guide else '---',
        'marketRate': inr(rate), 'guidelineRateLine': f'Rs {inr(guide)}/- Per Sqyd' if guide else '---',
        'glrLandLine': f'Rs {inr(glr_land)}/-' if guide else '---', 'marketRateLine': f'Rs {inr(rate)}/-Cent',
        'landValueLine': f'Rs  {inr(land)}/-', 'extrasTotal': f'Rs {inr(extras)}/-' if extras else 'Rs --',
        'glrLand': f'Rs {inr(glr_land)}/-' if guide else '--', 'glrExtras': '--', 'glrTotal': f'Rs {inr(glr_land)}/-' if guide else '--',
        'pmrLand': f'Rs  {inr(land)}/-', 'pmrExtras': f'Rs  {inr(extras)}/-' if extras else 'Rs  0.00/-',
        'pmrTotal': f'Rs  {inr(total)}/-', 'pmrSay': f'Rs  {inr(fmv)}/-', 'presentValueLine': f'Rs  {inr(fmv)}/-',
        'forcedLessPct': f'{100 - float(f["distressPct"]):g}',
        'declBackground': f'Extent {considered:.3f} Cents of freehold land belonging to the Client. The land bearing {postal}',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date :  {f["reportDate"]}, ', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 6)
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}



# ---------------------------------------------------------------- AGRICULTURE (90% / 80%)
AGRI_DEFAULTS = {
    'purpose': 'For Loan Facility', 'planLine': '--', 'mvCertificate': 'Yes, Copy Enclosed', 'nagarLine': '--', 'wardLine': '--',
    'locality': 'Agricultural Land', 'localityClass': 'Middle Class', 'surroundings': 'Developing of Agriculture',
    'flooding': 'Nil', 'civicAmenities': 'Nearly 3.00 Km', 'levelOfLand': 'Level Of Ground', 'landShape': 'Trapezoidal',
    'landUse': 'Agricultural Land', 'usageRestriction': 'Nil', 'tenure': '--', 'layoutApproved': 'No', 'approvalProblem': 'No',
    'cornerPlot': 'Intermittent Plot', 'depthRatio': '--', 'roadFacilities': 'Available', 'roadType': 'Metal Rastha',
    'roadWidth': 'Below 20’0” Wide Rastha', 'landLocked': 'No', 'water': 'Available', 'sewerage': 'No', 'power': 'Available',
    'advantage1': 'Medium Demand Locality', 'disadvantage1': 'Nil', 'sroName': 'Badvel', 'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_agriculture(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, AGRI_DEFAULTS)
    owners(f, case, rep)
    survey = f['surveyNo'] or '---'
    khatha = pd.get('khathaNo') or rep.get('khathaNo') or '---'
    lp = rep.get('lpNo') or '---'
    district = f['district']
    mandal = rep.get('mandal') or '---'
    loc = rep.get('locationText') or f"{rep.get('village') or '---'} Village Field "
    local_body = rep.get('localBody') or f'{mandal} Mandal of {district}. (Dt).'
    branch = re.sub(r',?\s*kadapa.*$', '', case.get('bankBranch') or 'Branch', flags=re.I)
    acres = apgb.acres_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    rate = num(rep.get('ratePerAcre')) or num(rep.get('marketRatePerCent')) * 100
    guide = num(rep.get('guidelineRatePerAcre'))
    land = money(acres * rate)
    glr = money(acres * guide) if guide else 0
    fmv, _, _ = bob.final_values(f, case, rep, 'agriculture', land, step=5000,
                                 bank={**BANK, 'realizable': 0.90, 'distress': 0.80, 'value_round': 1000})
    postal = f'In Site Survey No: {survey}, Khatha No : {khatha}, LP No : {lp}, {loc}At {local_body}'
    f.update({
        'khathaNo': khatha, 'lpNo': lp, 'lpNoLine': lp, 'locationText': loc, 'localBody': local_body,
        'localBodyLine': rep.get('localBodyLine') or f'{mandal} Mandal, {district} (Dt).',
        'bankBranchName': branch, 'branchPlace': rep.get('branchPlace') or f'{district} (Dt).',
        'bankBranchLine': f'{branch}, {district} (Dt).',
        'ownerPhone': case.get('clientPhone') or DROP, 'ownerPhoneLine': f"Cell No : {case['clientPhone']}." if case.get('clientPhone') else ' ',
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'deedCountWord': 'One',
        'extentLine': f'Ac {acres:.2f} Cents', 'extentLine3': f'Ac  {acres:.3f} Cents', 'totalAc3': f'{acres:.3f}', 'totalAcStr': f'{acres:.2f}',
        'khathaLine': f'Khatha No: {khatha}, LP No : {lp},',
        'deedLine': f"Deed No:{pd.get('deedNo') or '---'}, Dt : {apgb.ddmmyyyy(pd.get('deedDate')) or '---'}.",
        'surveyLine': f'Survey No: {survey}', 'villageBlock': f'{loc}At {local_body}', 'mandalLine': local_body,
        'postalAddress': postal, 'devLocation': f'{survey}, Khatha No : {khatha}, LP No : {lp}, {loc}At {local_body}',
        'guideRateAcre': inr(guide) if guide else '---', 'marketRateAcre': inr(rate),
        'guidelineRateLine': f'Rs {inr(guide)}/- Acre' if guide else '---', 'glrLandLine': f'Rs {inr(glr)}/-' if guide else '---',
        'marketRateLine': f'Rs {inr(rate)}/- Acre', 'landValueLine': f'Rs {inr(land)}/-  (Land Cost)',
        'glrLand': f'Rs {inr(glr)}/-' if guide else '---', 'pmrLand': f'Rs {inr(land)}/-', 'pmrTotal': f'Rs {inr(land)}/-',
        'pmrSay': f'Rs {inr(fmv)}/-', 'presentValueLine': f'Rs {inr(fmv)}/-',
        'forcedLessPct': f'{100 - float(f["distressPct"]):g}',
        'declBackground': f'Ac {acres:.3f} Cents of freehold land belonging to the client. The Agriculture land bearing {postal}',
        'declPurpose': f'For collateral security. The Manager, Canara Bank, {branch}, {district} (Dt).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date: {f["reportDate"]}, ', 'declDates3': f'Date of report: {f["reportDate"]}.',
    })
    # Land development estimate (optional page)
    dev = [num(x) for x in (rep.get('devAmounts') or [])]
    drop = []
    if any(dev):
        for i in range(5):
            f[f'dev{i}'] = inr(dev[i]) if i < len(dev) and dev[i] else '--'
        f.update({'devTotal': inr(sum(dev)), 'devWordsUpper': words(sum(dev)).upper()})
    else:
        drop.append('development')
    images = apgb.geo_and_photos(case, rep, f, temps, 8)
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images, 'drop': drop}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site,
            'agriculture': build_agriculture}
TEMPLATES = {name: f'canara_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Canara Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
