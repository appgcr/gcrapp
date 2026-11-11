"""
Bank-report figures without building the document (fast — no maps, photos or Word file).

Usage: python3 values.py case.json   ->  {"fmv": 5304000, "realizable": 4508000, "distress": 3978000}
The app stores these on the case, so cards, dashboards and approvals show exactly the
numbers printed in the bank's report.
"""
import json
import os
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
    print(json.dumps({'format': fmt, 'fmv': n('fmv'), 'realizable': n('realizable'), 'distress': n('distress')}))


if __name__ == '__main__':
    main(sys.argv[1])
