"""
Bank-report figures without building the document (fast — no maps, photos or Word file).

Usage: python3 values.py case.json   ->  {"fmv": 5304000, "realizable": 4508000, "distress": 3978000}
The app stores these on the case, so cards, dashboards and approvals show exactly the
numbers printed in the bank's report.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import apgb  # noqa: E402  (shared number helpers)
import registry  # noqa: E402


def main(path):
    with open(path, encoding='utf-8') as f:
        case = json.load(f)
    case['_valuesOnly'] = True
    mod = registry.module_for(case)
    if mod is None:
        print('{}')
        return
    fmt = mod.format_for(case)
    if fmt not in mod.BUILDERS:
        print('{}')
        return
    job = mod.BUILDERS[fmt](case, [])
    f = job['fields']
    n = lambda k: int(apgb.num(f.get(k)))
    out = {'format': fmt, 'fmv': n('fmv'), 'realizable': n('realizable'), 'distress': n('distress')}
    out.update(breakdown(f))
    print(json.dumps(out))


AMOUNT = re.compile(r'(\d{1,3}(?:,\d{2})*(?:,\d{3})|\d+)(?:\.\d+)?')


def _amount(text):
    """The rupee amount on a report line ('= Rs 22,00,000/-' → 2200000); the last one if several."""
    if not isinstance(text, str):
        return None
    t = text.split('Rs')[-1] if 'Rs' in text else text
    found = AMOUNT.findall(t)
    return int(found[-1].replace(',', '')) if found else None


def _first(f, keys):
    for k in keys:
        v = _amount(f.get(k))
        if v is not None:
            return v
    return None


def breakdown(f):
    """Land / building / extras exactly as the bank's report prints them (they add up to its total before the 'Say')."""
    land = _first(f, ['absA', 'pmrLand', 'landValueLine', 'landCalc2', 'landCalcLine'])
    total = _first(f, ['absTotal', 'pmrTotal', 'totalCalc2', 'grandTotalLine', 'compositeLine', 'totalLine'])
    extras = sum(_amount(f.get(k)) or 0 for k in ('absC', 'absD', 'absE', 'absF', 'pmrAmenities', 'pmrServices', 'pmrExtras'))
    if land is None:
        return {}
    if total is None:
        total = land + extras   # open land: the land line is the total
    building = max(total - land - extras, 0)
    return {'land': land, 'building': building, 'extras': extras, 'total': total}


if __name__ == '__main__':
    main(sys.argv[1])
