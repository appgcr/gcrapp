"""
Indian Bank report builder (the bank's own formats in indian_source/).

Indian Bank's rules, read from the bank's sample report:
  • Land = net extent (Sqyds) x market rate per Sqyd (93.78 x 28,925 = 27,15,586)
  • "Say" = rounded down to ₹1,000 (→ 27,15,000), unless the engineer types it
  • Realizable / forced-sale = % of the Say (Settings → Banks, 90 / 80), rounded to the nearest ₹10,000
    (→ 24,40,000; the sample's forced-sale 21,72,000 is the exact 80%)
"""
import os

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
    rate = num(rep.get('landRatePerSqyd')) or num(pd.get('landRate'))
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


BUILDERS = {'open_site': build_open_site}
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
