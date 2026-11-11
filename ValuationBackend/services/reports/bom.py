"""
Bank of Maharashtra report builder (the bank's own formats in bom_source/).

BoM's rules, read from the bank's sample report:
  • Flat: land = UDS Sqyds x rate per Sqyd, building = plinth x rate less depreciation, plus car parking
  • "Say" = rounded down to ₹1,000 (53,04,960 → 53,04,000), unless the engineer types it
  • Realizable / distress = % of the Say (Settings → Banks, 90 / 80), rounded to the nearest ₹5,000
    (→ 47,75,000; the sample's distress 42,40,000 is hand-rounded)
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
BANK = {'label': 'Bank of Maharastra', 'realizable': 0.90, 'distress': 0.80, 'say_step': 1000, 'site_say_step': 1000,
        'value_round': 5000, 'pct_of': 'say', 'defaults': {}}
DEFAULTS = {
    'purpose': 'Purchase Loan', 'mvCertificate': 'Copy enclosed', 'tenure': 'Free Hold', 'cityTown': 'Kadapa City',
    'areaResidential': 'Yes', 'areaCommercial': '--', 'areaIndustrial': '--', 'areaClass': 'Middle', 'areaUrban': 'Urban',
    'localBodyType': 'Corporation Limits', 'govtEnactments': 'No', 'agriConversion': 'NA', 'occupancy': 'Owner',
    'aptNature': 'Residential', 'localityType': 'Residential', 'structure': 'R.C.C. Framed', 'dwellingUnits': '--',
    'quality': 'Good', 'appearance': 'Good', 'maintenance': 'Good', 'facilities': 'Yes', 'lift': 'Yes',
    'protectedWater': 'Yes', 'sewerage': '--', 'carParkingType': 'Open', 'compoundWall': 'Yes', 'pavement': 'Yes',
    'specRoof': 'R.C.C Roof', 'specFlooring': 'Tiles', 'specDoors': 'Yes', 'specWindows': 'Yes', 'specFittings': 'Yes',
    'specFinishing': 'Yes', 'houseTax': 'Yes', 'assessmentNo': '--', 'taxPaidName': '--', 'electricityNo': 'NA',
    'meterName': 'NA', 'flatMaintenance': 'Good', 'flatClass': 'I Class', 'usage': 'Residential', 'occupancy2': 'Owner',
    'monthlyRent': '---', 'marketability': 'Good', 'negatives': 'No',
    'advantages': ' It Is Good Residential Area,  All Civic   \n Amenities Are Very Near To In this Property, Like School, Colleges, Apartments, etc.,',
    'district': 'Y S R', 'place': 'Kadapa',
}


def build_apartment(case, temps, bank=None):
    pd = case.get('propertyDetails') or {}
    rep = pd.get('report') or {}
    f = apgb.common_fields(case, rep, dict(DEFAULTS))
    bob.owners(f, case, rep)
    owner_fields(f, case, rep)
    district = f['district']
    lb = rep.get('localBodyName') or 'Kadapa Municipal Corporation'
    apt = rep.get('aptName') or pd.get('apartmentName') or '---'
    flat = pd.get('flatNo') or rep.get('flatNo') or '---'
    floor = apgb.floor_word(rep.get('floorName') or pd.get('floorNo'))
    survey, door, ward = f['surveyNo'] or '---', f['doorNo'] or '---', rep.get('wardNo') or '---'
    near, village, landmark = rep.get('nearBy'), rep.get('village') or '---', rep.get('landmark') or '---'
    status = rep.get('flatStatus')
    uds_deed_c = apgb.extent_in_cents(rep.get('udsDeedRaw') or pd.get('netExtent'))
    uds_plan_c = apgb.extent_in_cents(rep.get('udsPlanRaw')) or uds_deed_c
    parent_c = apgb.extent_in_cents(rep.get('parentExtentDeedRaw'))
    parent_plan_c = apgb.extent_in_cents(rep.get('parentExtentPlanRaw')) or parent_c
    uds_yd = trunc2(uds_plan_c * SQYD_PER_CENT)
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
    land = apgb.money(round(uds_yd, 2) * rate) if not rep.get('udsSqydValued') else apgb.money(num(rep['udsSqydValued']) * rate)
    val_yd = num(rep.get('udsSqydValued')) or uds_yd
    plinth = apgb.sqft_of(rep.get('plinthArea')) or sum(num(x.get('value')) for x in ((pd.get('siteValue') or {}).get('floors') or []))
    carpet = apgb.sqft_of(rep.get('carpetArea')) or plinth * 0.85
    c_rate = num(rep.get('constructionRate')) or 2000
    age = int(num(pd.get('buildingAge')))
    life = int(num(rep.get('totalLife'), 60)) or 60
    dep_pct = min(age * num(rep.get('depreciationPerYear'), 1.0), 70.0)
    bld = apgb.money(plinth * c_rate)
    dep = apgb.money(bld * dep_pct / 100)
    net = bld - dep
    composite = net + land
    parking = num(rep.get('carParkingValue'))
    total = composite + parking
    fmv, _, _ = bob.final_values(f, case, rep, 'apartment', total, step=1000, bank=BANK)
    builder = rep.get('builderName') or rep.get('firmName')
    partner = rep.get('managingPartner')
    app, app_rel = rep.get('applicantName'), bob.relation(rep.get('applicantRel'))
    loc = (f'Door No : {door}, (Survey No.’s : {survey}), {landmark}, ' + (f' Near {near}, ' if near else '')
           + f'{village} Village Field  At  {lb} of  {dotted(district)} (Dt).')
    kind = f'Residential {status} Building' if status else 'Residential Flat'
    f.update({
        'aptName': apt, 'aptNameQuoted': f'“{apt}” Apartment', 'flatNo': flat, 'floorLine': f'{floor}  Floor',
        'deedDate': apgb.ddmmyyyy(pd.get('deedDate')) or pd.get('deedYear') or '---', 'wardNo': ward, 'landmark': landmark,
        'floorsDesc': rep.get('floorsDesc') or '---', 'floorsShort': rep.get('floorsShort') or rep.get('floorsDesc') or '---',
        'builderUpper': (builder or '---').upper() + ' ', 'partnerLine': f'MANAGING PARTNER :- {partner}' if partner else DROP,
        'ownerLine1': '              ' + f['ownerLine1'].strip(),
        'applicantLabel': 'Applicant :-' if app else DROP,
        'applicantLine': (f'   {app}, {app_rel.rstrip(".")}.' if app_rel else f'   {app}') if app else DROP,
        'applicantAddr': (rep.get('applicantAddr') or ' ') if app else DROP,
        'udsDeedLine': f'{cents_txt(uds_deed_c)} Cents (Out Of {cents_txt(parent_c)} Cents)',
        'udsPlanLine': f'{cents_txt(uds_plan_c)} Cents (Out Of {cents_txt(parent_plan_c)} Cents)',
        'aptTitle': f'{kind} In “{apt} Apartment ” Flat No : {flat},  In  {floor}  Floor, {loc}',
        'fmvWordsCoreUpper': core_words(fmv).upper(), 'localBodyLineUpper': f'{lb.upper()} {dotted(district)} (Dt).',
        'villageLine': f'{village}  Village', 'postalLine': f'In {loc}', 'localBodyName': lb, 'districtDotted': dotted(district),
        'parentLine': f'{trunc2(parent_c * SQM_PER_CENT):.3f} Sqmt (or) {trunc2(parent_c * SQYD_PER_CENT * 9):.2f} Sqfts (or) {cents_txt(parent_c)} Cents',
        'parentPlanLine': f'{trunc2(parent_plan_c * SQM_PER_CENT):.2f} Sqmt (or) {cents_txt(parent_plan_c)} Cents',
        'gpsDecimal': '---', 'udsConsideredLine': f'{uds_yd:.3f} Sqyds (or) {cents_txt(uds_plan_c)} Cents',
        'flatLocation': f' Flat No :- {flat}, ({floor} Floor),  Door No : {door},', 'surveyLine2': f'Survey No :- {survey},',
        'wardVillageLine': f'Ward No :- {ward}, {village}  Village Filed,', 'postalLine2': f'{loc}  ',
        'yearOfConstruction': rep.get('yearOfConstruction') or ('Under Construction' if status else str(apgb.dt.date.today().year - age)),
        'flatNoLine': f'Flat No : {flat},',
        'udsDeedSqydA': f'   {trunc2(uds_deed_c * SQYD_PER_CENT):g} Sqyds (or) {cents_txt(uds_deed_c)}   ',
        'udsPlanA': f' {cents_txt(uds_plan_c)} Cents (Out Of {cents_txt(parent_plan_c)}   ',
        'taxAmountLine': f"Rs. {inr(num(rep.get('taxAmount')))}/-" if rep.get('taxAmount') else '--',
        'deedExecutant': f'Managing Partner : {builder}' if builder else f['owner1Name'], 'deedExecutantRelation': f' “{partner}” ' if partner else ' ',
        'udsAsPerPlan': f' {val_yd:.2f}  Sqyds  (Or)   {cents_txt(uds_plan_c)}   CENTS (As Per Plan)',
        'plinthLine': f'{plinth:.2f} Sqft', 'carpetLine': f'{carpet:.2f} Sqft',
        'buildingCalc': f' Building = {plinth:.2f} Sqft x Rs {c_rate:.2f}  = ', 'buildingCalc2': f'Rs {inr(bld)}/-',
        'landCalc': f'= {val_yd:.2f} Sqyds x Rs {inr(rate)}/- Sqyds       ', 'landCalc2': f'= Rs {inr(land)}/-',
        'replacementLine': f'Rs {inr(bld)}/-', 'ageNum': f'{age:.2f}', 'remainingLifeLine': 'New One' if not age else f'{life - age} Years',
        'lifeNum': str(life), 'deprBuildingLine': f'Rs  {inr(net)}/-', 'landValueLine': f'Rs  {inr(land)}/-',
        'compositeLine': f'Rs  {inr(composite)}/-', 'plinthQty': f'{plinth:.2f}/- Sqft', 'compositeLine2': f' Rs {inr(composite)}/-',
        'carParkingLine': f' Rs {inr(parking)}/-' if parking else '--', 'grandTotalLine': f'Rs {inr(total)}/-',
        'sayLine': f'Say Rs {inr(fmv)}/-',
        'declBackground': f'1) {cents_txt(uds_plan_c)} Cents of freehold land belonging to the client. This House bearing In {loc}',
        'declPurpose': f'For collateral security.  The Manager, Bank of Maharastra, {(case.get("bankBranch") or "---").strip()}, {dotted(district)} (Dt).',
        'declDates1': f'Date of appointment: {f["inspectionDate"]}, ', 'declDates2': f'Valuation date   : {f["reportDate"]}, ',
        'declDates3': f'Date of report    : {f["reportDate"]}.',
    })
    for side in ('North', 'South', 'East', 'West'):
        f[f'dimDeed{side}'] = rep.get(f'dimDeed{side}') or '---'
        f[f'dimActual{side}'] = rep.get(f'dimActual{side}') or f[f'dimDeed{side}']
        f[f'fb{side}'] = rep.get(f'fb{side}') or '---'
    images = apgb.geo_and_photos(case, rep, f, temps, 4)
    if f.get('latitude') not in (None, '---'):
        f['gpsDecimal'] = f'{f["latitude"]},{f["longitude"]}'
    apply_overrides(f, rep)
    return {'fields': f, 'rows': {}, 'images': images}


BUILDERS = {'apartment': build_apartment}
TEMPLATES = {name: f'bom_{name}.docx' for name in BUILDERS}
format_for = apgb.format_for


def build(case, out_path):
    fmt = format_for(case)
    if fmt not in BUILDERS:
        raise NotImplementedError(f'Bank of Maharashtra {fmt} format not built yet')
    temps = []
    job = BUILDERS[fmt](case, temps)
    job['template'] = os.path.join(HERE, 'templates', TEMPLATES[fmt])
    job['out'] = out_path
    return job, temps
