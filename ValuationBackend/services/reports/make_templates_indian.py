"""
Indian Bank: fill-in templates from the bank's own sample reports (indian_source/*.docx).

Run:  python3 make_templates.py indian [open_site]
Only the sample values are swapped for {{tags}}; the letterhead, tables, fonts, colours and
fixed wording stay exactly as the bank's file. (House and apartment samples are old .doc files —
they are added once the bank's files are re-saved as .docx.)
"""
from make_templates import (T, span, span_re, whole, cell, mark_images, replace_all_body)
from make_templates_bob import places
from make_templates_union import location_map
from make_templates_karnataka import signature_before


# --------------------------------------------------------------------------- OPEN SITE
def open_site(doc):
    t = doc.tables
    replace_all_body(doc, '2604045', 'fileNo')
    span(doc, 'District   :', 'Y.S.R', 'districtDotted')
    span(doc, 'Branch   :', 'RAJIV PARK BARNCH, KADAPA', 'bankBranchUpper')
    whole(doc, 'Chennarayudu, S/o', T('ownerLine1'))
    whole(doc, 'Khajipeta Village', T('owner1Addr'))
    whole(doc, 'Applicant  :', T('applicantLabel'))
    whole(doc, 'Govardhan, S/o. Sri  V . Narasimhulu.', T('applicantLine'))
    whole(doc, 'Velagacherla Village, Pengaluru Mandal, Y.S.R (Dt).', T('applicantAddr'))
    span(doc, 'Deed No    :', '1323/1979', 'deedNo')
    span(doc, 'Net Extent', '93.78', 'netSqyd')
    whole(doc, 'Will  Deed No', T('deed2PlotLine'))
    span(doc, 'East Side Door No', '57/512-1', 'doorNo')
    span(doc, 'East Side Door No', '40', 'surveyNo')
    span(doc, 'PLAN APPROVED NO', 'Tentative Plan', 'planNo')
    span_re(doc, 'Valuation Report Of', r'Residential Vacant Site In .*', 'siteTitle')
    span(doc, 'Valuation Rs', '27,15,000', 'fmv')
    span(doc, '(Rupees', 'TWENTY SEVEN LAKHS FIFTEEN THOUSAND', 'fmvWordsCoreUpper')
    whole(doc, 'Kadapa Municipal Corporation of Y.S.R (Dt).', T('localBodyLine'))
    span(doc, 'Realizable Value: Rs', '24,40,000', 'realizable')
    span_re(doc, 'Pursuant to the request', r'(?<=The Manager, ).*?(?= The Property)', 'bankBranchLine')
    span_re(doc, 'Pursuant to the request', r'(?<=The Property is at ).*?(?= Which is)', 'locationLine')
    span_re(doc, 'Pursuant to the request', r'(?<=Applicant by  ).*?(?= was inspected)', 'applicantLine2')
    span(doc, 'Pursuant to the request', '13-04-2026', 'inspectionDate')
    whole(doc, 'Deed Xerox :  1323/1979', T('deedXerox1'))
    whole(doc, 'Will Deed Xerox', T('deedXerox2'))
    span(doc, 'Xerox Copy Of Plan Approval', 'Tentative Plan', 'planNo')
    span(doc, 'fair market value of the property', '27,15,000', 'fmv')
    span(doc, 'comparable sale value', '24,40,000', 'realizable')
    span(doc, 'Forced sale value', '21,72,000', 'distress')
    span(doc, 'I have inspected the property on', '13-04-2026', 'inspectionDate')
    span(doc, 'I have inspected the property on', 'Sri T. Ramalingaiah', 'bankOfficial')
    span_re(doc, 'Branch      ', r'Rajiv Park Branch, Kadapa, Y\.S\.R \(Dt\),', 'bankBranchLine2')
    span_re(doc, 'Customer           :', r'Sri V \. Govardhan.*', 'applicantLine2')

    a = t[0]
    cell(a, 0, 2, '=Belongs to :-', 'tableOwnerLine', 'tableOwnerAddr')
    cell(a, 1, 2, '=Deed No : ' + T('deedNo'), 'roLine', '=Verified', '=S. No’s : ' + T('surveyNo') + ',',
         'extentDeedLine', 'extentPlanLine', 'planNo')
    for r, side in ((3, 'East'), (4, 'West'), (5, 'North'), (6, 'South')):
        cell(a, r, 3, f'dimDeed{side}')
    for r, side in ((9, 'East'), (10, 'West'), (11, 'North'), (12, 'South')):
        cell(a, r, 3, f'dimActual{side}')
    cell(a, 7, 3, 'extentFull')
    cell(a, 13, 3, 'extentFull')
    cell(a, 14, 3, 'extentPlanLine')
    cell(a, 15, 3, 'landType')
    cell(a, 16, 3, 'locationLine')
    for r, side in ((19, 'East'), (20, 'West'), (21, 'North'), (22, 'South')):
        cell(a, r, 3, f'bdDeed{side}')
    for r, side in ((24, 'East'), (25, 'West'), (26, 'North'), (27, 'South')):
        cell(a, r, 3, f'bdActual{side}')
    cell(a, 29, 3, 'buyerLines')
    cell(a, 30, 3, 'sellerLines')
    for r, key in ((31, 'extentDeedYdC'), (32, 'registeredFor'), (33, 'registrationDates'), (44, 'inspectionLine'),
                   (47, 'guidelineRateLine'), (48, 'marketRateLine')):
        cell(a, r, 3, key)
    cell(a, 49, 3, 'landCalc', 'landCalc2', 'sayLine', 'fmvRs', 'realizableRs', 'distressRs')

    signature_before(doc, 'Signature (with seal)')
    replace_all_body(doc, '15-04-2026', 'reportDate')
    places(doc)
    location_map(doc, 'LOCATION – MAP', 'Photo’s', close_up=False)
    mark_images(doc, 'Photo’s', 'photo', stop_text='Google – Map')
    mark_images(doc, 'Google – Map', 'map')


FORMATS = {'open_site': open_site}
