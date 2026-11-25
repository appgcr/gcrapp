"""
Indian Bank report builder (the bank's own formats in indian_source/).

Indian Bank's rules, read from the bank's sample report:
  • Land = net extent (Sqyds) x market rate per Sqyd (93.78 x 28,925 = 27,15,586)
  • "Say" = rounded down to ₹1,000 (→ 27,15,000), unless the engineer types it
  • Realizable / forced-sale = % of the Say (Settings → Banks, 90 / 80), rounded to the nearest ₹10,000
    (→ 24,40,000; the sample's forced-sale 21,72,000 is the exact 80%)
"""
import os
import re

import apgb
import bob
from apgb import inr, num, words, trunc2, SQYD_PER_CENT, SQM_PER_CENT, apply_overrides
from union import core_words, dotted, cents_txt
from pnb import owner_fields

HERE = os.path.dirname(os.path.abspath(__file__))
DROP = bob.DROP
BANK = {'label': 'INDIAN BANK', 'realizable': 0.90, 'distress': 0.80, 'say_step': 1000, 'site_say_step': 1000,
        'value_round': 10000, 'pct_of': 'say', 'defaults': {}}


def build_open_site(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {'district': 'Y.S.R', 'place': 'Kadapa', 'landType': 'Residential'})
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    survey, door, plot = f['surveyNo'] or '---', f['doorNo'] or '---', f['plotNo'] or '---'
    deed_c = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or deed_c
    considered = min(x for x in (deed_c, plan_c) if x) if (deed_c or plan_c) else 0
    deed_yd = bob.sqyd_of(rep.get('extentDeedRaw') or pd.get('netExtent'))
    plan_yd = bob.sqyd_of(rep.get('netExtentPlanRaw')) or deed_yd
    yd = min(x for x in (deed_yd, plan_yd) if x) if (deed_yd or plan_yd) else 0     # Sqyds kept as typed (93.78)
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate')) or round(num(rep.get('marketRatePerCent')) / 48.4)
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(yd * rate)
    fmv, _, _ = bob.final_values(f, case, rep, 'openSite', land, step=1000, bank=BANK)
    app, app_rel = rep.get('applicantName'), bob.relation(rep.get('applicantRel'))
    app_line = (f'{app}, {app_rel.rstrip(".")}.' if app_rel else app) if app else None
    loc = (f'In Site Survey No: {survey}, Plot No : {plot}, Door No : {door}, In Ward No;- {rep.get("wardNo") or "---"}, '
           f'{rep.get("landmark") or "---"},' + (f' Near {rep["nearBy"]},' if rep.get('nearBy') else '')
           + f' {rep.get("village") or "---"} Village Field At  {lb} of  {dotted(district)}. (Dt).')
    def full(c):
        return (f'{trunc2(c * SQYD_PER_CENT * 9):.2f} Sqft (or) {trunc2(c * SQM_PER_CENT):.2f} Sqmt (or)   '
                f'{trunc2(c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(c)} Cents')
    deed2 = rep.get('deed2No')
    f.update({
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'planNo': f['planNo'] or 'Tentative Plan',
        'applicantLabel': 'Applicant  :' if app else DROP, 'applicantLine': app_line or DROP,
        'applicantAddr': (rep.get('applicantAddr') or ' ') if app else DROP,
        'applicantLine2': (app_line or f['ownerLine1'].strip()).rstrip('.') + ',',
        'tableOwnerLine': (app_line or f['ownerLine1'].strip()), 'tableOwnerAddr': (rep.get('applicantAddr') if app else f['owner1Addr']) or ' ',
        'netSqyd': f'{yd:.2f}',
        'deed2PlotLine': (f'                      Will  Deed No    :   {deed2}           Plot  No      :   {plot}' if deed2
                          else f'                      Plot  No      :   {plot}'),
        'siteTitle': f'{rep.get("siteType") or "Residential Vacant Site"} {loc}',
        'fmvWordsCoreUpper': core_words(fmv).upper(), 'localBodyLine': f'{lb} of {dotted(district)} (Dt).  ',
        'bankBranchLine': f'Indian Bank, {(case.get("bankBranch") or "---").strip()}, {dotted(district)}.(Dt).',
        'bankBranchLine2': f'{(case.get("bankBranch") or "---").strip()}, {dotted(district)} (Dt),',
        'locationLine': loc, 'bankOfficial': rep.get('bankOfficial') or 'Branch Manager',
        'deedXerox1': f'Deed Xerox :  {pd.get("deedNo") or "---"},  Dated: {apgb.ddmmyyyy(pd.get("deedDate")) or "---"}',
        'deedXerox2': f'Will Deed Xerox :  {deed2},  Dated: {rep.get("deed2Date") or "---"}' if deed2 else DROP,
        'roLine': rep.get('registrarOffice') or 'Kadapa RO ',
        'extentDeedLine': full(deed_c).split('Sqft (or) ')[1].replace('   ', ''), 'extentPlanLine': f'{trunc2(plan_c * SQM_PER_CENT):.2f} Sqmt (or) {trunc2(plan_c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(plan_c)} Cents',
        'extentFull': full(deed_c), 'extentDeedYdC': f'{trunc2(deed_c * SQYD_PER_CENT):.2f} Sqyds (or) {cents_txt(deed_c)} Cents',
        'buyerLines': rep.get('buyerLines') or f['ownerLine1'].strip(), 'sellerLines': rep.get('sellerLines') or '---',
        'registeredFor': f"Rs {inr(num(rep.get('purchasePrice')))}/-" if rep.get('purchasePrice') else '---',
        'registrationDates': rep.get('registrationDates') or (apgb.ddmmyyyy(pd.get('deedDate')) or '---'),
        'inspectionLine': f['inspectionDate'] + '\nNot Applicable',
        'guidelineRateLine': f'Rs  {inr(guide)}/- Sqyds' if guide else '---', 'marketRateLine': f'Rs  {inr(rate)}/-  Sqyd',
        'landCalc': f'{yd:.2f} Sqyds x Rs {inr(rate)}/-Sqyd', 'landCalc2': f' = Rs {inr(land)}/- ',
        'sayLine': f'Say = Rs {inr(fmv)}/-', 'fmvRs': f'Rs {inr(fmv)}/-', 'realizableRs': f'Rs {f["realizable"]}/-',
        'distressRs': f'Rs {f["distress"]}/-',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
    f['districtDotted'] = dotted(district)
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- HOUSE
# Read from the bank's house sample:
#   • Land = net extent (Sqyds) x market rate per Sqyd, "Say" rounded down to ₹1,000
#   • Building = Σ floor area x rate, less 1% depreciation per year of age (6 years → 6%)
#   • Total = land Say + building, "Say" rounded down to ₹1,000
#   • Realizable / forced sale = 95% / 90% of the Say, rounded down to ₹1,000 (Settings → Banks can change the %)
#   • Building forced-sale line = 90% of the building value
HOUSE_PCT = (0.95, 0.90)


def floor_1000(x):
    return int(x // 1000) * 1000


def build_house(case, temps, bank=None):
    """The bank's Rajiv Park house layout (sample 2509071): up to two deeds side by side, up to two owners.
    Land = considered extent x market rate (per cent when report.marketRatePerCent is given, as in the sample:
    12.95 x 9,00,000; otherwise Sqyds x the case's rate per Sqyd); building = floors x rate less 1%/year;
    total Say ↓₹1,000; realizable / forced 95% / 90% ↓₹1,000; building forced-sale line = 90%."""
    import datetime as dt
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {'district': 'Y.S.R', 'place': 'Kadapa', 'landType': 'Residential,'})
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    survey, door, plot = f['surveyNo'] or '---', f['doorNo'] or '---', f['plotNo'] or '---'
    ward = rep.get('wardNo') or pd.get('wardNo') or '---'
    landmark, village = rep.get('landmark') or '---', rep.get('village') or pd.get('village') or '---'
    near = rep.get('nearBy')
    branch = (case.get('bankBranch') or '---').strip()

    # Land: one or two deeds
    d1, d1_dt = pd.get('deedNo') or '---', apgb.ddmmyyyy(pd.get('deedDate')) or '---'
    d2, d2_dt = rep.get('deed2No'), apgb.ddmmyyyy(rep.get('deed2Date')) or rep.get('deed2Date') or '---'
    c1 = apgb.extent_in_cents(rep.get('extentDeedRaw') or pd.get('netExtent'))
    c2 = apgb.extent_in_cents(rep.get('extent2Raw')) if d2 else 0
    total_c = c1 + c2
    plan_c = apgb.extent_in_cents(rep.get('netExtentPlanRaw')) or total_c
    cons_c = min(x for x in (total_c, plan_c) if x) if (total_c or plan_c) else 0
    yd = lambda c: trunc2(c * SQYD_PER_CENT)  # noqa: E731
    sqm = lambda c: trunc2(c * SQM_PER_CENT)  # noqa: E731
    full = lambda c: f'{trunc2(c * SQYD_PER_CENT * 9):.2f} Sqfts (or) {sqm(c):.2f} Sqmts (or) {yd(c):.2f} Sqyds (or) {cents_txt(c)} Cents'  # noqa: E731
    per_cent = num(rep.get('marketRatePerCent'))
    rate_yd = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    if per_cent:
        land = apgb.money(cons_c * per_cent)
        land_calc = f'{cents_txt(cons_c)} x {inr(per_cent)}/- cent'
        rate_line = f'Rs {inr(per_cent)}/-'
    else:
        land = apgb.money(yd(cons_c) * rate_yd)
        land_calc = f'{yd(cons_c):.2f} Sqyd x {inr(rate_yd)}/- Sqyd'
        rate_line = f'Rs {inr(rate_yd)}/- Sqyd'
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))

    # Building: one line per floor
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = apgb.dep_percent(age, rep.get('depreciationPerYear'))
    c_rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2800
    codes, plinth, repl_lines, repl_total = [], [], [], 0
    for fl in (pd.get('siteValue') or {}).get('floors') or []:
        area = num(fl.get('value'))
        if not area:
            continue
        label = re.sub(r'\s*\(.*?\)', '', fl.get('label') or 'Floor').strip()
        code = next((v for k, v in bob.FLOOR_CODES.items() if k in label.lower()), label)
        fr = num(fl.get('rate')) or c_rate
        repl = apgb.money(area * fr)
        repl_total += repl
        codes.append(code)
        plinth.append(f'{code}  = {trunc2(area / 10.7639):.2f} Sqmts (or) {area:.2f}  Sqfts')
        repl_lines += [f'{code} = {area:.2f} Sqft X Rs {int(fr)}/- sqft', f'     = Rs {inr(repl)}/- ']
    dep = apgb.money(repl_total * dep_pct / 100)
    building = repl_total - dep
    total = land + building
    fmv = floor_1000(total)
    r_pct, d_pct = bob.rates_for(case, 'house', *HOUSE_PCT)
    realizable, distress = floor_1000(fmv * r_pct), floor_1000(fmv * d_pct)
    floors = '+'.join(codes) or 'GF'

    loc = (f'Site Survey No’s : {survey}, Door No’s : {door}, Ward No: {ward}, In {landmark},'
           + (f' Near {near},' if near else '') + f' {village} Village At {lb} of  {dotted(district)} (Dt).')
    plan_no, plan_dt = f.get('planNo') or '', f.get('planDate') or ''
    has_plan = plan_no and plan_no not in ('NA', '---')
    o1 = ' '.join(x for x in (f.get('owner1NameLine', '').strip(), (f.get('owner1RelLine') or '').strip()) if x and x != DROP)
    o2_name, o2_rel = rep.get('owner2Name'), bob.relation(rep.get('owner2Rel'))
    o2 = (f'{apgb.title_for(o2_name, rep.get("owner2Rel"))} ,{o2_rel}.' if o2_rel else apgb.title_for(o2_name, '')) if o2_name else None
    seller = rep.get('sellerLines') or '\n'.join(x for x in (rep.get('deedExecutant'), bob.relation(rep.get('deedExecutantRelation'))) if x) or '---'
    words_core = core_words(fmv).replace('Crores', 'Crore').upper()
    f.update({
        'districtDotted': dotted(district), 'deed1No': d1, 'deed1Cents': cents_txt(c1), 'deed1Label': ' ',
        'deed2Front': (f'  Deed No    :  {d2}                                             Extent      :   {cents_txt(c2)} Cents'
                       if d2 else DROP),
        'totalCents': cents_txt(total_c), 'dropLine': DROP,
        'planHeadLine': f' Plan Approved Under B.A. No : {plan_no}. Dt: {plan_dt}.' if has_plan else ' Plan Approved Under : NA',
        'houseTitle': f'Residential Building ({floors}) In {loc}', 'fmv': inr(fmv), 'fmvWordsCoreUpper': words_core,
        'realizable': inr(realizable), 'distress': inr(distress), 'localBodyLine': f'{lb} Of {dotted(district)} (Dt).',
        'bankBranchLine': f'Indian Bank, {branch}.', 'bankBranchLine2': f'{branch}, {dotted(district)}.Dt.',
        'locationLine': loc, 'ownersAnd': o1 + (f' &  {o2}' if o2 else ''),
        'deedXerox1': f'Sale Deed Xerox, Deed No : {d1},   Dt : {d1_dt}. ',
        'deedXerox2': f' Deed No : {d2}  Dt : {d2_dt}' if d2 else DROP,
        'planXeroxLine': f'Xerox Copy Of Plan Approval: B.A. No : {plan_no}.  Dt : {plan_dt}.' if has_plan else DROP,
        'bankOfficial': rep.get('bankOfficial') or 'Branch Manager',
        'tOwner1': o1 + ('  &  ' if o2 else ''), 'tOwner2': f' {o2}' if o2 else DROP,
        'deedLine1': f'Deed No : {d1}', 'deedLine2': f'Deed No : {d2}' if d2 else DROP,
        'roLine': rep.get('registrarOffice') or 'Kadapa S.R.O', 'surveyLineC': f'Survey No : {survey}',
        'asPerDeedLine': f'AS PER DEED = {cents_txt(total_c)} Cents', 'asPerPlanLine': f'AS PER PLAN = {cents_txt(plan_c)} CENTS',
        'deed2Head': f'As Per Deed ( {d2})' if d2 else 'As Per Actual',
        'deed2HeadB': f'As Per Deed ({d2})' if d2 else 'As Per Actual',
        'extent1Full': full(c1), 'extent2Full': full(c2) if d2 else full(c1),
        'planExtA': f'{sqm(c1):.2f} Sqmts (or)  {cents_txt(c1)} CENTS',
        'planExtB': f'+ Remainig Site = {sqm(c2):.2f} Sqmt (or) ' if d2 else ' ',
        'planExtC': f'{cents_txt(c2)} Cents = {cents_txt(total_c)} Cents' if d2 else ' ',
        'planExtBC': (f'+ Remainig Site = {sqm(c2):.2f} Sqmt (or) {cents_txt(c2)} Cents = {cents_txt(total_c)} Cents' if d2 else ' '),
        'buyerLines': '\n'.join(x for x in (f.get('owner1NameLine', '').strip(), (f.get('owner1RelLine') or '').strip()) if x and x != DROP) or '---',
        'sellerLines': seller,
        'extentYdLines': f' {yd(c1):.2f} Sqyds (or) {cents_txt(c1)} Cents' + (f'\n {yd(c2):.2f} Sqyds (or) {cents_txt(c2)} Cent' if d2 else ''),
        'registeredFor': rep.get('registeredFor') or (f"Rs {inr(num(rep.get('purchasePrice')))}/-" if rep.get('purchasePrice') else '---'),
        'registrationDates': d1_dt + (f' & {d2_dt}' if d2 else ''),
        'surfaceComm': rep.get('surfaceComm') or 'Road abutting',
        'assessmentLine': f'Assessment no : {pd.get("assessmentNo") or "---"}',
        'taxPaidLine': f'Rs {rep.get("taxAmount")}/-' if rep.get('taxAmount') else ' ', 'taxPaidName': rep.get('taxPaidName') or ' ',
        'guidelineRateLine': f'Rs {inr(guide)} /- Per Sqyd' if guide else '---',
        'marketRateLine': f'{rate_line} (Prevailing)', 'adoptedRateLine': f'{rate_line} (Adopted)',
        'landCalc': land_calc, 'landCalc2': f'= Rs {inr(land)}/- ',
        'landMarketRs': f'   Rs  {inr(land)}/-', 'landRealizableRs': f'   Rs  {inr(floor_1000(land * r_pct))}/-',
        'landDistressRs': f'   Rs  {inr(floor_1000(land * d_pct))}/-',
        'totalYdCLine': f'{yd(total_c):.2f} Sqyds (or) {cents_txt(total_c)} Cent',
        'tenancy': rep.get('tenancy') or 'OWN, ', 'planBuilt': 'Yes' if has_plan else 'No',
        'planNoLine': f'B.A. No : {plan_no}.  ' if has_plan else ' ', 'planDateLine': f'   Dt : {plan_dt}.' if has_plan else ' ',
        'deviations': rep.get('deviations') or 'No',
        'ageLine': rep.get('ageLine') or (f'{age} Years' if age else 'New'), 'lifeLine': f'{max(life - age, 0)} Years',
        'taxAmountLine': f'Tax Amount : Rs {rep.get("taxAmount")}/-' if rep.get('taxAmount') else '---',
        'buildingUse': rep.get('buildingUse') or 'Residential', 'occupancy': rep.get('occupancy') or 'Own',
        'rentLine': rep.get('rentLine') or '---',
        'plinthActual': '\n'.join(plinth) or '---', 'plinthPlan': rep.get('plinthPlanRaw') or '\n'.join(plinth) or '---',
        'plinthNote': rep.get('plinthNote') or ' ',
        'yearOfConstruction': rep.get('yearOfConstruction') or (str(dt.date.today().year - age) if age else '---'),
        'structureType': pd.get('structureType') or rep.get('structureType') or 'R.C.C. Framed Structure',
        'roofType': rep.get('roofType') or 'R.C.C', 'floorType': pd.get('flooringType') or rep.get('flooringType') or '---',
        'replacementLines': '\n'.join(repl_lines) or '---',
        'replacementTotal': f'Total ({floors.replace("+", " + ")}) = Rs {inr(repl_total)}/-',
        'depPctNum': f'{dep_pct:g}', 'depLine': f'{floors.replace("+", "  & ")} (-) Rs  {inr(dep) if dep else "0.00"}/-',
        'buildingValue': f'Rs  {inr(building)}/-', 'buildingDistress': f'Rs  {inr(round(building * d_pct))}/-',
        'busStop': rep.get('busStop') or '---', 'railwayStation': rep.get('railwayStation') or '---',
        'floorCodes': floors,
        'absLand': f'         Land :   Rs    {inr(land)}/-', 'absBuilding': f'  Building  :   Rs    {inr(building)}/-',
        'absTotal': f'       Total   =   Rs   {inr(total)}/-', 'absSay': f'          Say Rs {inr(fmv)}/-',
        'fmvRs': f'Rs   {inr(fmv)}/-', 'realizableRs': f'Rs   {inr(realizable)}/-', 'distressRs': f'Rs   {inr(distress)}/-',
    })
    bd2 = rep.get('boundaries2') or {}
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dim2{side}'] = rep.get(f'dim2{side}') or (f[f'dimDeed{side}'] if not d2 else '---')
        f[f'bd2{side}'] = bd2.get(side.lower()) or (f.get(f'bdDeed{side}') or '---' if not d2 else '---')
    images = apgb.geo_and_photos(case, rep, f, temps, 8)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


# ---------------------------------------------------------------- APARTMENT
# Same rules as the house (read from the bank's apartment sample):
#   land = undivided share (Sqyds) x rate, Say ↓₹1,000; building = built-up Sqft x rate less 1%/year;
#   total Say ↓₹1,000; realizable / forced sale 95% / 90% ↓₹1,000; building forced-sale line = 90%.
FLOOR_NAMES = {'0': 'Ground Floor', 'g': 'Ground Floor', '1': 'First Floor', '2': 'Second Floor', '3': 'Third Floor',
               '4': 'Fourth Floor', '5': 'Fifth Floor', '6': 'Sixth Floor'}


def floor_name(raw):
    t = str(raw or '').strip()
    if not t:
        return '---'
    if re.search(r'floor', t, re.I):
        return t.title()
    return FLOOR_NAMES.get(t.lower()[:1] if not t[:1].isdigit() else t[:1], t)


def build_apartment(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, {'district': 'Y.S.R', 'place': 'Kadapa', 'landType': 'Residential'})
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    survey, door = f['surveyNo'] or '---', f['doorNo'] or '---'
    landmark, village = rep.get('landmark') or '---', rep.get('village') or pd.get('village') or '---'
    near = rep.get('nearBy')
    branch = (case.get('bankBranch') or '---').strip()
    apt = (rep.get('aptName') or pd.get('builderName') or 'Apartments').strip()
    flat_no = pd.get('flatNo') or '---'
    fl_name = floor_name(pd.get('floorNo'))

    uds = bob.sqyd_of(rep.get('udsPlanRaw') or rep.get('udsDeedRaw') or pd.get('netExtent'))
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate')) or round(num(rep.get('marketRatePerCent')) / 48.4)
    guide = num(rep.get('guidelineRatePerSqyd')) or num(pd.get('guidelineRate'))
    land = apgb.money(uds * rate)
    land_say = floor_1000(land)

    sv = pd.get('siteValue') or {}
    area = num(rep.get('plinthArea')) or num(sv.get('plinthArea')) or sum(num(x.get('value')) for x in sv.get('floors') or [])
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = apgb.dep_percent(age, rep.get('depreciationPerYear'))
    c_rate = num(rep.get('constructionRate')) or num((case.get('valuation') or {}).get('constructionRate')) or 2800
    repl = apgb.money(area * c_rate)
    dep = apgb.money(repl * dep_pct / 100)
    building = repl - dep
    total = land_say + building
    fmv = floor_1000(total)
    r_pct, d_pct = bob.rates_for(case, 'apartment', *HOUSE_PCT)
    realizable, distress = floor_1000(fmv * r_pct), floor_1000(fmv * d_pct)

    place_txt = (f'In Survey No : {survey}, Door No:- {door}, In {landmark},' + (f' Near {near},' if near else '')
                 + f' {village} Village field At {lb} of  {dotted(district)} (Dt).')
    flat_txt = f'Flat No: {flat_no} ({fl_name}), {place_txt}'
    deed2, deed2_dt = rep.get('deed2No'), apgb.ddmmyyyy(rep.get('deed2Date')) or rep.get('deed2Date') or '---'
    deed1, deed1_dt = pd.get('deedNo') or '---', apgb.ddmmyyyy(pd.get('deedDate')) or '---'
    plan_no, plan_dt = f.get('planNo') or '', f.get('planDate') or ''
    has_plan = plan_no and plan_no not in ('NA', '---')
    name_rel = [x for x in (f.get('owner1NameLine', '').strip(), (f.get('owner1RelLine') or '').strip()) if x and x != DROP]
    seller = rep.get('sellerLines') or '\n'.join(x for x in (rep.get('deedExecutant'), bob.relation(rep.get('deedExecutantRelation'))) if x) or '---'
    flat2 = rep.get('flat2') or {}
    words_core = core_words(fmv).replace('Crores', 'Crore')
    site_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw') or rep.get('parentExtentPlanRaw'))
    f.update({
        'districtDotted': dotted(district), 'bankBranchUpper': branch.upper() + '.', 'aptNameUpper': apt.upper(),
        'aptFloorsLine': rep.get('floorsDesc') or 'Ground Floor + Upper Floors',
        'udsSqyd': f'{uds:.2f}', 'udsSqydLine': f'{uds:.2f} Sqyds ',
        'deed2Front': f'DEED NO   :   {deed2}' if deed2 else DROP,
        'flatLine': f'{flat_no}  ({fl_name})', 'flat1No': flat_no, 'floorName': fl_name,
        'planHeadLine': f'PLAN APPROVED UNDER B.P.S. NO : {plan_no},   Dt : {plan_dt}. ' if has_plan else 'PLAN APPROVED UNDER : NA',
        'aptTitle': f'Residential Flats  {apt} In {flat_txt}', 'aptLocationLine': f'Residential Flats {flat_txt}',
        'aptLocationLine2': f'In “{apt}” Apartments, {flat_txt}', 'flatLocationLine': flat_txt,
        'fmv': inr(fmv), 'fmvWordsCoreUpper': words_core.upper(), 'fmvWordsCore': words_core,
        'realizable': inr(realizable), 'distress': inr(distress),
        'bankBranchLine': f'Indian Bank, {branch}.', 'bankBranchLine2': f'{branch.upper()}, {dotted(district)}. (Dt).',
        'applicantLine2': ' '.join(name_rel) or f['ownerLine1'].strip(),
        'deedXerox1': f'Sale Deed Xerox \t        :  {deed1}   Dt : {deed1_dt}',
        'deedXerox2': f'Sale Deed Xerox \t        :  {deed2}   Dt : {deed2_dt}' if deed2 else DROP,
        'planXeroxLine': f'           3. Xerox Copy Of Plan Approval No :  B.A.NO : {plan_no},   Dt : {plan_dt}.' if has_plan else DROP,
        'bankOfficial': rep.get('bankOfficial') or 'Branch Manager',
        'deedLine1': f'Deed No : {deed1}   Dt : {deed1_dt}', 'deedLine2': f'Deed No : {deed2}   Dt : {deed2_dt}' if deed2 else DROP,
        'roLine': rep.get('registrarOffice') or 'Kadapa S.R.O', 'surveyLineC': f'Survey No : {survey}',
        'fb2Head': f'Flat Boundaries (Flat No : {flat2.get("no")}):-' if flat2.get('no') else ' ',
        'fb2HeadB': f'Flat Boundaries Flat No : {flat2.get("no")}' if flat2.get('no') else ' ',
        'siteExtentLine': f'{trunc2(site_c * SQYD_PER_CENT * 9):.2f} Sqfts (or) {cents_txt(site_c)} Cents' if site_c else '---',
        'firstPartyLines': seller, 'secondPartyLines': '\n'.join(name_rel) or '---',
        'registeredFor': f"Rs {inr(num(rep.get('purchasePrice')))}/-" if rep.get('purchasePrice') else '---',
        'registrationDates': deed1_dt + (f'  &  {deed2_dt}' if deed2 else ''),
        'surfaceComm': rep.get('surfaceComm') or 'Road abutting',
        'assessmentLine': f'Assessment No : {pd.get("assessmentNo") or "---"},',
        'taxAmountLine': f'Amount Rs {rep.get("taxAmount")} /-' if rep.get('taxAmount') else '---',
        'guidelineRateLine': f'Rs {inr(guide)}/- Sqyd' if guide else 'Copy Enclosed',
        'marketRateLine': f'Rs {inr(rate)}/- Sqyd (Prevailing)', 'adoptedRateLine': f'Rs {inr(rate)}/- Sqyd (Adopted)',
        'landCalc': f'{uds:.2f} Sqyd x Rs {inr(rate)}/- Sqyd', 'landCalc2': f' = Rs {inr(land)}/-  ',
        'landSayLine': f'   Say Rs {inr(land_say)}/-', 'landMarketRs': f'   Rs  {inr(land_say)}/-',
        'landRealizableRs': f'   Rs  {inr(floor_1000(land_say * r_pct))}/-', 'landDistressRs': f'   Rs  {inr(floor_1000(land_say * d_pct))}/-',
        'tenancy': rep.get('tenancy') or 'Own', 'planBuilt': 'Yes' if has_plan else 'No',
        'planNoLine': f'B.A.NO : {plan_no}, ' if has_plan else ' ', 'planDateLine': f'  Dt : {plan_dt}' if has_plan else ' ',
        'deviations': rep.get('deviations') or 'No',
        'ageLine': (f'{age} years ( Y-C = {rep.get("yearOfConstruction") or __import__("datetime").date.today().year - age})' if age else 'New'),
        'lifeLine': f'{max(life - age, 0)} Years', 'buildingUse': rep.get('buildingUse') or 'Residential Flats',
        'occupancy': rep.get('occupancy') or 'Owner', 'rentLine': rep.get('rentLine') or '---',
        'builtUpLine': f'{area:.2f} Sqft', 'landType': 'Residential',
        'yearOfConstruction': rep.get('yearOfConstruction') or (str(__import__('datetime').date.today().year - age) if age else '---'),
        'structureType': pd.get('structureType') or rep.get('structureType') or 'R.C.C. Framed',
        'roofType': rep.get('roofType') or 'R.C.C',
        'replCalc': f'{area:.2f} Sqft X Rs {c_rate:.2f}/- ', 'replCalc2': f'= Rs {inr(repl)}/-  ',
        'replacementTotal': f'Rs {inr(repl)}/-', 'depPctNum': f'{dep_pct:g}', 'depLine': f'(-) Rs {inr(dep)} /-',
        'buildingValue': f'Rs  {inr(building)}/-', 'buildingDistress': f'Rs {inr(round(building * d_pct))}/-',
        'railwayStation': rep.get('railwayStation') or '---',
        'totalCalc': f'Rs {inr(land_say)}/-  + Rs {inr(building)}/-  ', 'totalSay': f'= Rs {inr(total)}/- Say Rs {inr(fmv)}/-',
        'fmvRs': f'Rs  {inr(fmv)}/-', 'realizableRs': f'Rs  {inr(realizable)}/-', 'distressRs': f'Rs  {inr(distress)}/-',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
        f[f'fb1{side}'] = rep.get(f'fb{side}') or '---'
        f[f'fb2{side}'] = flat2.get(side.lower()) or ' '
    images = apgb.geo_and_photos(case, rep, f, temps, 8)
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'open_site': build_open_site, 'house': build_house, 'apartment': build_apartment}
TEMPLATES = {name: f'indian_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Indian Bank {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
