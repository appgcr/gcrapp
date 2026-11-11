"""
Bank of India report builder (the bank's own formats in boi_source/).

Bank of India's rules, read from the bank's sample reports:
  • "Say" = the total rounded down to ₹1,000 (1,13,78,750 → 1,13,78,000)
  • Realizable / distress = 95% / 90% of the total, rounded to the nearest ₹10,000
  • extents printed with 3 decimals (163.74 Sqmts (or) 195.835 Sqyds (or) 4.045 Cents)
The calculations are the same engine as Bank of Baroda (bob.py) with Bank of India's profile.
"""
import os
import re

import apgb
import bob
from apgb import inr, num, trunc2, SQM_PER_CENT, SQYD_PER_CENT, extent_in_cents

HERE = os.path.dirname(os.path.abspath(__file__))


def extent3(cents, with_yards=True):
    sqm = trunc2(cents * SQM_PER_CENT)
    if with_yards:
        return f'{sqm:.2f} Sqmts (or) {cents * SQYD_PER_CENT:.3f} Sqyds (or) {cents:.3f} Cents'
    return f'{sqm:.2f} Sqmts (or) {cents:.3f} Cents'


HOUSE_DEFAULTS = {
    'purpose': 'Purchase Loan', 'tenure': 'Free Hold', 'cityTown': 'Kadapa Municipal Corporation',
    'localBodyType': 'Kadapa Municipal Corporation', 'occupancy': 'Owner', 'landShape': 'Rectangular',
    'layoutApproved': 'No, But Boundaries Are Clear', 'roadType': 'CC  Road', 'roadWidth': '40’0” Wide Road',
    'buildingType': 'Residential', 'constructionType': 'RCC Framed', 'planAuthority': 'Kadapa Municipal Commissioner',
    'planComments': '--', 'compoundWall': 'Provided', 'cwHeight': '----', 'cwLength': '----', 'cwType': '-----',
    'wiring': 'CTS & CONCELED', 'fanPoints': 'ADEQUATE', 'waterClosets': 'One', 'washBasins': 'One',
    'waterMeter': 'TAP CONNECTION PROVIDED', 'otherFixtures': '--',
    'specGF_foundation': 'PCC & WITH RR STONE MASONARY IN CM OVER SAND CUSHION & SETTLEMENT BED (1:4:8)',
    'specGF_basement': 'RR STONE MASONARY IN CM OF 0.60 HT FROM RL',
    'specGF_superstructure': 'BRICK WORK IN CM OF 0.35 M\nWIDE 3.0 M HEIGHT', 'specGF_joinery': 'Rolling Shutters & Doors & Windows',
    'specGF_rccWorks': 'R.C.C. Framed', 'specGF_plastering': 'Cement Plastering in CM (1:4)\n12  MM THICK',
    'specGF_flooring': 'Tiles', 'specGF_specialFinish': '--', 'specGF_roofing': 'RCC', 'specGF_drainage': 'Provided',
}
BANK = {'label': 'Bank of India', 'realizable': 0.95, 'distress': 0.90, 'say_step': 1000, 'site_say_step': 1000,
        'extent': extent3, 'defaults': {'house': HOUSE_DEFAULTS}}


def rs(v):
    return f'Rs {inr(v)}/-' if v else 'Rs 0.00/-'


def build_house(case, temps):
    job = bob.build_house(case, temps, bank=BANK)
    f, rep = job['fields'], ((case.get('propertyDetails') or {}).get('report') or {})
    pd = case.get('propertyDetails') or {}
    district = f['district']
    lb = f['localBodyName']
    branch = case.get('bankBranch') or 'Kadapa Branch'
    # Amount style of the Bank of India sample: "Rs 3,50,000/-", "Rs 0.00/-"
    for part, keys in bob.HOUSE_EXTRAS.items():
        total = 0
        for k in keys:
            v = num(rep.get(k))
            total += v
            f[k] = rs(v)
        f[part] = rs(total)
    for k in ('absA', 'absB', 'absC', 'absD', 'absE', 'absF', 'absTotal', 'absSayAs'):
        f[k] = f[k].replace('Rs. ', 'Rs.  ').replace('Rs  ', 'Rs.  ') if f[k].startswith('Rs') else f[k]
    age = int(num(pd.get('buildingAge')))
    for row in job['rows']['fl']:
        row['age'] = 'New One' if not age else row['age']
        pct = re.search(r'-(\d+(\.\d+)?)%', row['depPct'])
        row['depPct'] = f'Rs {float(pct.group(1)) if pct else 0:.2f}% '
        dep = num(row['depAmount'])
        row['depAmount'] = f'{inr(dep)}/-' if dep else '0.00/-'
    f['buildingDesc'] = f['buildingDesc'].replace(' + ', '+')
    f['plinthPlan'] = f['plinthPlan'].replace(' Sqmt ', ' Sqmts ').replace(' Sqft', ' Sqfts')
    f['plinthActual'] = f['plinthActual'].replace(' Sqmt ', ' Sqmts ').replace(' Sqft', ' Sqfts')
    deed_c = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    f.update({
        'netExtentCents': f'{considered:.3f}', 'netExtentPlan': extent3(plan_c), 'extentConsidered': extent3(considered),
        'ageLine': 'New One' if not age else f['ageLine'],
        'guidelineValue': inr(apgb.money(guide * considered * SQYD_PER_CENT)) if guide else '---',
        'marketRateLine': f'  Rs {inr(rate_cent)}/- Per Cent', 'guidelineRateLine': f'   Rs {inr(guide)}/- Sqyd' if guide else '---',
        'adoptedRateLine': f'   {considered:.3f} Cents x Rs {inr(rate_cent)}/- Cent',
        'landValueLine': f'   = Rs {inr(apgb.money(considered * rate_cent))}/-',
        'bankBranchName': branch.replace(' Branch', '  Branch') if '  ' not in branch else branch,
        'nearBy': rep.get('nearBy') or f['landmark'],
        'plotNo': pd.get('plotNo') or '---',
        'localBody': rep.get('localBody') or f'{lb} of {district} Dist.',
        'localBodyLine': f'{lb.replace("Kadapa ", "Kadapa  ")}, {district} Dist.',
        'declBackground': (f'{considered:.3f} Cents of freehold land belonging to the client. The land bearing At Site Survey '
                           f'No’s : {survey}, Door No : {door}, Ward No : {f["wardNo"]}, In {f["landmark"]} {f["village"]} '
                           f'Village Field, {lb} Of {district} (Dt).'),
        'declPurpose': f'For collateral security. Bank of India, {branch}, {district} (Dt). ',
        'declDates2': f'Valuation date : {f["reportDate"]}, ', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    if 'map1' in job['images']:
        job['images']['gmap1'] = job['images']['gmap2'] = job['images']['map1']
    apgb.apply_overrides(f, rep)
    return job



# ---------------------------------------------------------------- APARTMENT
APT_DEFAULTS = {
    'purpose': 'Collateral Security of Loan', 'mvCertificate': 'Copy Enclosed', 'planAuthority': 'Municipal Corporation',
    'planVerified': 'YES/ NO', 'planComments': 'NIL', 'postalAddress': 'As Above', 'cityTown': 'City',
    'areaResidential': 'Residential', 'areaCommercial': '-----', 'areaIndustrial': '-----', 'areaClass': 'Middle',
    'areaUrban': 'Urban', 'localBodyType': 'Municipal Corporation', 'govtEnactments': '------', 'occupancy': 'Owner',
    'aptNature': 'Residential', 'blockNo': '--', 'localityType': 'Residential', 'structure': 'R.C.C. Framed',
    'quality': 'Good', 'appearance': 'Good', 'maintenance': 'Good', 'facilities': 'Yes', 'lift': 'Yes',
    'protectedWater': 'Yes', 'sewerage': 'Yes', 'carParkingType': 'Covered', 'compoundWall': 'Yes', 'pavement': 'Yes',
    'specRoof': 'R.C.C. Roof', 'specFlooring': 'Tiles', 'specDoors': 'Wooden Doors', 'specWindows': 'UPVC Windows',
    'specFittings': 'Yes', 'specFinishing': 'Yes', 'houseTax': 'Yes', 'electricityNo': '---', 'meterName': '---',
    'flatMaintenance': 'Good', 'fsi': '--', 'flatClass': 'I Class', 'usage': 'Residential Purpose',
    'occupancy2': 'Owner', 'monthlyRent': '--', 'marketability': 'Good', 'negatives': 'No', 'comparableRate': '---',
    'adoptedBasicRate': '---', 'guidelineNote': 'Copy Enclosed', 'statusNote': ' ', 'actualFloorsNote': ' ',
    'advantages': 'It Is Good Residential Area, All Civic Amenities Are Very Near To In this Property, Like School, Colleges, Apartments, etc.,',
    'buildingStatus': 'Finished', 'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa',
    'blankLine': ' ', **{k: ' ' for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_interior', 'x_electrical',
                                          'x_grills', 'x_potential', 'x_others')}, 'x_superfine': '--',
}
SUFFIX = {'1': 'st', '2': 'nd', '3': 'rd'}


def ordinal(n):
    n = int(n)
    return f'{n}{"th" if 10 <= n % 100 <= 20 else SUFFIX.get(str(n % 10), "th")}'


def build_apartment(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, APT_DEFAULTS)
    bob.owners(f, case, rep)
    D = bob.DROP
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    plot = pd.get('plotNo') or rep.get('plotNo') or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor_no = re.sub(r'\D', '', str(pd.get('floorNo') or rep.get('floorNo') or '')) or '0'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    village = rep.get('village') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or APT_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb} of  {district} (Dt).'
    loc = rep.get('locationText') or rep.get('landmark') or '---'
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    status = rep.get('buildingStatus') or APT_DEFAULTS['buildingStatus']
    two = bool(rep.get('deed2No'))
    f.update({
        'aptName': apt, 'aptNameUpper': apt.upper(), 'builderName': pd.get('builderName') or '---',
        'flatNo': flat, 'floorName': floor, 'floorNumber': floor_no, 'floorSuffixUpper': ordinal(floor_no)[len(floor_no):].upper(),
        'floorOrdinal': ordinal(floor_no), 'floorLine': f'{ordinal(floor_no)}  Floor', 'flatNoLine': f'Flat No: {flat}, ',
        'plotNo': plot, 'village': village, 'villageLine': f'{village} Village Field', 'locationText': loc,
        'nearBy': rep.get('nearBy') or loc, 'localBody': local_body, 'localBodyLine': local_body,
        'surveyLine': f'Survey No :-  {survey},', 'wardLine': f"Ward No: {rep.get('wardNo') or pd.get('wardNo') or '---'},",
        'flatAddressLine': f'Flat No: {flat} ({floor} Floor), In Survey No : {survey}, Plot No’s: {plot},  {loc}, {village} Village Field At {local_body}',
        'surveyNoUpper': survey.upper(), 'flatLineUpper': f'Flat No:{flat}, {floor} Floor, ',
        'locationUpper': f' {loc.upper()}, {village.upper()} VILLAGE FIELD AT {local_body.upper()}',
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'buildingStatus': status,
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'planNo': f['planNo'] or 'NA', 'planDate': f['planDate'] or '---',
        'bankBranchShort': re.sub(r'\s*branch.*$', '', case.get('bankBranch') or 'Kadapa', flags=re.I),
        'taxPaidName': rep.get('taxPaidName') or '\n'.join(x for x in (f['ownerLine1'], f['ownerLine2'], f['ownerLine3']) if x != D),
        'deedExecutant': rep.get('deedExecutant') or '\n'.join(x for x in (f['ownerLine1'], f['ownerLine2'], f['ownerLine3']) if x != D),
        'taxAmountLine': f"Rs {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '---',
        'assessmentNo': pd.get('assessmentNo') or '---',
        'unitsLine': f"{rep['dwellingUnits']} Units" if rep.get('dwellingUnits') else ' ',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
        f[f'fbDeed{side}'] = rep.get(f'fbDeed{side}') or f[f'fb{side}']
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'bd2{side}'] = rep.get(f'bd2{side}') or ('---' if two else ' ')
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or ('---' if two else ' ')
        f[f'dimTotal{side}'] = rep.get(f'dimTotal{side}') or f[f'dimDeed{side}']

    # Land: the flat's undivided share in cents x rate per cent
    d1 = extent_in_cents(rep.get('extentDeedRaw'))
    d2 = extent_in_cents(rep.get('deed2ExtentRaw')) if two else 0
    parent_c = extent_in_cents(rep.get('parentExtentDeedRaw')) or (d1 + d2)
    uds_c = extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_yd = uds_c * SQYD_PER_CENT
    parent_yd = parent_c * SQYD_PER_CENT
    rate_cent = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    land = apgb.money(uds_c * rate_cent)
    line = lambda c: f'{c * SQYD_PER_CENT * 9:.2f} Sqfts (or) {trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {c:.2f} Cents'
    f.update({
        'deed2No': rep['deed2No'] if two else D, 'deed2Date': apgb.ddmmyyyy(rep.get('deed2Date')) or '---' if two else D,
        'deed2NoOrDash': rep['deed2No'] if two else '---',
        'deed2BdHeader': f"(As Per deed: {rep['deed2No']})" if two else ' ',
        'deed2DimHeader': f"Dimensions (As Per deed: {rep['deed2No']})" if two else ' ',
        'deed1ExtentLine': line(d1) if d1 else '---', 'deed2ExtentLine': line(d2) if two else ' ',
        'totalExtentSummary': (f'TOTAL EXTENT = {d1:.2f} + {d2:.2f} = {parent_c:.3f} Cents (or) {trunc2(parent_yd):.2f} Sqyds'
                               if two else f'TOTAL EXTENT = {parent_c:.3f} Cents (or) {trunc2(parent_yd):.2f} Sqyds'),
        'parentExtentLine': line(parent_c), 'parentLine2': f'{trunc2(parent_yd):.2f} Sqyds (or) {parent_c:.3f} Cents',
        'udsCentsLine': f'{uds_c:.2f} Cents', 'parentCentsLine': f'{parent_c:.3f} Cents',
        'udsYd': f'{uds_yd:.3f}', 'parentYd': f'{trunc2(parent_yd):.2f}',
        'udsOutOf': f'{uds_yd:.3f} Sqyds Out Of {trunc2(parent_yd):.2f} Sqyds',
        'udsLine': f'{uds_yd:.3f} Sqyds (Or) {uds_c:.2f} Cents',
        'landCalc1': f' {uds_c:.2f} Cents x Rs {inr(rate_cent)} /-Cent ', 'landCalc2': f'= Rs {inr(land)}/-',
        'landValueLine': f' Rs {inr(land)}/-',
    })

    # Flat
    plinth = apgb.sqft_of(rep.get('plinthArea')) or num((pd.get('siteValue') or {}).get('plinthArea')) or \
        sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    rate = num(rep.get('constructionRate')) or 1500
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    extras = 0
    for k in ('x_wardrobes', 'x_showcases', 'x_kitchen', 'x_superfine', 'x_interior', 'x_electrical', 'x_grills',
              'x_potential', 'x_others'):
        v = num(rep.get(k))
        if v:
            f[k] = f'Rs {inr(v)}/-'
            extras += v
    total = composite + extras
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, bank={**BANK, 'value_round': 1000})
    guide = num(rep.get('guidelineValue'))
    fee = num(rep.get('fee')) or 5000
    f.update({
        'yearOfConstruction': rep.get('yearOfConstruction') or ('Under Construction' if 'semi' in status.lower() else str(apgb.dt.date.today().year - age)),
        'plinthLine': f'{plinth:.2f} Sqfts', 'carpetLine': f'{carpet:.2f} Sqfts',
        'buildingCalc1': f' Building = {plinth:.2f} Sqft x Rs {int(rate)}/-', 'buildingCalc2': f' =  Rs {inr(bld)}/- ',
        'guidelineNote': f'Rs. {inr(guide)}/-' if guide else 'Copy Enclosed',
        'replacementRateLine': f'Rs {int(rate)}/- Sqfts',
        'ageLine': status if 'semi' in status.lower() else (f'{age} Years' if age else 'New'),
        'remainingLifeLine': '60 Year’s After Completion' if 'semi' in status.lower() else f'{max(life - age, 0)} Years',
        'deprLine': f' {dep_pct:g}% (Rs {inr(dep) if dep else "000"}/-)', 'deprValueLine': f'Rs {inr(net)}/-',
        'deprBuildingLine': f' Rs {inr(net)}/-', 'compositeLine': f' Rs. {inr(composite)}/-',
        'compositeLine2': f'Rs {inr(composite)}/-', 'unitRateLine': f'Rs {trunc2(composite / plinth):.2f}/-' if plinth else '--',
        'grandTotalLine': f'Rs  {inr(total)}/-', 'sayLine': f'  Say Rs {inr(fmv)}/-',
        'fee': inr(fee),
        'declBackground': (f'1) {uds_c:.2f} Cents of freehold land belonging to the client. The land bearing At Residential Flat '
                           f'In “{apt}” (Residential Apartments), Flat No: {flat} ({floor} Floor), In Survey No : {survey}, '
                           f'Plot No’s: {plot},  {loc}, {village} Village Field At {local_body}'),
        'declPurpose': f'For collateral security. Manager, BOI, {(case.get("bankBranch") or "---").upper()}, {district} (Dt),',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date: {f["reportDate"]}, ', 'declDates3': f'Date of report: {f["reportDate"]}.',
    })
    # Proposed additions (separate estimate page)
    adds = rep.get('additions') or [a for a in (pd.get('additionsWork') or []) if a]
    drop = []
    if adds:
        ad_total = 0
        for i, a in enumerate(adds[:8], start=1):
            amt = num(a.get('amount')) or num(a.get('rate')) * (num(a.get('quantity')) or 1)
            ad_total += amt
            f[f'ad{i}_amt'] = inr(amt)
        for i in range(len(adds) + 1, 9):
            f[f'ad{i}_amt'] = '--'
        f.update({'adTotal': inr(ad_total), 'adTotalOrDrop': inr(ad_total), 'adWordsUpper': apgb.words(ad_total).upper()})
    else:
        drop.append('additions')
        f['adTotalOrDrop'] = D
    images = apgb.geo_and_photos(case, rep, f, temps, 2)
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images, 'drop': drop}



# ---------------------------------------------------------------- OPEN SITE (90% / 80%)
SITE_DEFAULTS = {
    'purpose': 'For Bank Facility', 'mvCertificate': 'Copy Enclosed', 'doorNo': '----,', 'postalAddress': 'As Of The Above',
    'cityTown': 'Town', 'areaResidential': 'Residential Area', 'areaCommercial': 'NA', 'areaIndustrial': 'NA',
    'areaClass': 'Middle', 'areaUrban': 'Urban', 'localBodyType': 'Municipal Corporation Limits', 'govtEnactments': 'NA',
    'agriConversion': 'NA', 'occupancy': 'Owner', 'locality': 'Middle', 'surroundings': 'Residential', 'flooding': 'Nil',
    'civicAmenities': 'At Walkable Distance', 'levelOfLand': 'Level Ground', 'landShape': 'Rectangle',
    'landUse': 'Residential', 'usageRestriction': 'Nil', 'layoutApproved': 'NA', 'cornerPlot': 'Intermittent Plot',
    'roadFacilities': 'Provided', 'roadType': 'CC Road', 'roadWidth': '33’0”  Wide Road', 'landLocked': 'No',
    'water': 'Available', 'sewerage': 'Provided', 'power': 'Provided', 'advantage1': 'Good Residential Area',
    'advantage2': ' ', 'specialRemarks': 'Nil', 'layoutPlanLine': 'NA', 'planLine': 'Na', 'layoutNote': ' ',
    'localBodyName': 'Kadapa Municipal Corporation', 'district': 'Y.S.R', 'place': 'Kadapa', 'wardNo': '--',
}


def extent_yd(c):
    return f'{trunc2(c * SQYD_PER_CENT):.2f}  Sqyds (or) {c:.2f} Cents'


def build_open_site(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, SITE_DEFAULTS)
    bob.owners(f, case, rep)
    survey, plot = f['surveyNo'] or '---', pd.get('plotNo') or '---'
    district = f['district']
    lb = rep.get('localBodyName') or SITE_DEFAULTS['localBodyName']
    local_body = rep.get('localBody') or f'{lb} of {district} (Dt).'
    loc = rep.get('locationText') or rep.get('landmark') or '---'
    village = rep.get('village') or '---'
    deed_c = extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    rate = num(rep.get('marketRatePerCent')) or num(pd.get('landRate')) * SQYD_PER_CENT
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(considered * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=1000, bank={**BANK, 'realizable': 0.90, 'distress': 0.80, 'value_round': 1000})
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    location_line = f'Site Survey No  : {survey}, Plot No : {plot}, {loc} At {local_body}'
    f.update({
        'plotNo': plot, 'locationText': loc, 'localBody': local_body, 'landmark': rep.get('landmark') or '---',
        'villageLine': f'{village} Village Filed', 'wardNo': rep.get('wardNo') or pd.get('wardNo') or '--',
        'bankBranchName': rep.get('bankBranchName') or re.sub(r',?\s*kadapa$', '', case.get('bankBranch') or 'Main Branch', flags=re.I),
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'consideredCents': f'{considered:.2f}',
        'extentDeed': extent_yd(deed_c), 'extentActual': extent_yd(deed_c), 'extentSite': extent_yd(deed_c),
        'netExtentPlan': extent_yd(plan_c), 'extentConsidered': extent_yd(considered),
        'briefDescription': f'This House is Very Suitable for Residential Purpose it is In {location_line}',
        'locationLine': location_line,
        'justificationPlace': f'{loc} ', 'govtValue': inr(apgb.money(guide * considered * SQYD_PER_CENT)) if guide else '---',
        'marketRateLine': f' Rs {inr(rate)}/- Cent', 'guidelineRateLine': f'Rs {inr(guide)}/- Sqyds' if guide else '---',
        'adoptedRateLine': f'{considered:.2f} Cents  X  Rs {inr(rate)}/-Cent', 'landValueLine': f'= Rs {inr(land)}/-',
        'absA': f'Rs {inr(land)}/-', 'absTotal': f'Rs {inr(land)}/-', 'absSayAs': f'Rs {inr(fmv)}/-',
        'declBackground': f'{considered:.2f} Cents of freehold land belonging to the client. The land bearing At {location_line}',
        'declPurpose': f'For collateral security. Bank of India , {case.get("bankBranch") or "---"}, {district} (Dt)',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date : {f["reportDate"]}, ', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 7)
    if 'map1' in images:
        images['gmap1'] = images['gmap2'] = images['map1']
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}



# ---------------------------------------------------------------- AGRICULTURE (90% / 80%)
AGRI_DEFAULTS = {
    'purpose': 'For Bank Facility', 'planLine': 'NA', 'mvCertificate': 'Copy Enclosed', 'tenure': 'Freehold', 'doorNo': 'NA',
    'postalAddress': 'As Of The Above', 'cityTown': 'Rural', 'areaResidential': 'NA', 'areaCommercial': 'NA',
    'areaIndustrial': 'NA', 'areaAgriculture': 'Yes - Agriculture', 'areaClass': 'Middle', 'areaUrban': 'Rural',
    'localBodyType': 'Panchayath', 'govtEnactments': 'NA', 'agriConversion': 'NA', 'occupancy': 'Owner',
    'locality': 'Middle', 'surroundings': 'Agriculture', 'flooding': 'Nil', 'civicAmenities': 'At 5 Km Distance',
    'levelOfLand': 'Level Ground', 'landShape': 'Trapezoidal', 'landUse': 'Agriculture', 'usageRestriction': 'Nil',
    'layoutApproved': 'No, But Boundaries Are Clear', 'cornerPlot': 'Intermittent', 'roadFacilities': 'Provided',
    'roadType': 'Metal Rastha in Fields', 'roadWidth': '15’0” Wide Metal Rastha', 'landLocked': 'No', 'water': 'Available',
    'sewerage': 'NA', 'power': 'Provided', 'advantage1': 'Good Agriculture Area', 'specialRemarks': 'Nil',
    'district': 'Y.S.R', 'place': 'Kadapa',
}


def build_agriculture(case, temps):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, AGRI_DEFAULTS)
    bob.owners(f, case, rep)
    district = f['district']
    survey = f['surveyNo'] or '---'
    village = rep.get('village') or '---'
    panchayat = rep.get('panchayat') or '---'
    mandal = rep.get('mandal') or '---'
    acres = apgb.acres_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    rate = num(rep.get('ratePerAcre')) or num(rep.get('marketRatePerCent')) * 100
    guide = num(rep.get('guidelineRatePerAcre'))
    land = apgb.money(acres * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'agriculture', land, step=1000,
                                 bank={**BANK, 'realizable': 0.90, 'distress': 0.80, 'value_round': 1000})
    ext = f'Ac.{acres:.2f} Cents'
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or ext
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    location = f'{village} Village, {panchayat} Panchayath,  {mandal} Mandal of  {district}  (Dt).'
    f.update({
        'totalAc': f'{acres:.2f}', 'extentLine': ext, 'locationLine': location,
        'villageLine': f'{village} Village,', 'panchayatLine': f'{panchayat} Panchayath,  ',
        'mandalLine': f'{mandal} Mandal of  {district} (Dt).',
        'bankBranchName': rep.get('bankBranchName') or (case.get('bankBranch') or '---'),
        'branchPlace': rep.get('branchPlace') or f'{district} Dt.',
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---',
        'govtValue': inr(apgb.money(guide * acres)) if guide else '---',
        'marketRateLine': f'Rs {inr(rate)}/- Per Acre', 'guidelineRateLine': f'Rs {inr(guide)}/- Acre' if guide else '---',
        'adoptedRateLine': f'AC {acres:.2f} Cents  x Rs {inr(rate)}/- Acre', 'landValueLine': f'=  Rs {inr(land)}/-',
        'absA': f'Rs.  {inr(land)}/-', 'absTotal': f'Rs.  {inr(land)}/-',
        'declBackground': f'{ext} of freehold land belonging to the client. The land bearing At Survey No : {survey}, In {location}',
        'declPurpose': f'For collateral security. Bank of India , {case.get("bankBranch") or "---"} ,{district} (Dt)',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ',
        'declDates2': f'Valuation date : {f["reportDate"]}, ', 'declDates3': f'Date of report : {f["reportDate"]}.',
    })
    images = apgb.geo_and_photos(case, rep, f, temps, 7)
    if 'map1' in images:
        images['gmap1'] = images['gmap2'] = images['map1']
    apgb.apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'house': build_house, 'apartment': build_apartment, 'open_site': build_open_site,
            'agriculture': build_agriculture}
TEMPLATES = {name: f'boi_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Bank of India {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
