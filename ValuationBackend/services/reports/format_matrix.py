"""Which property types each bank's exact format covers → stdout {"sbi": ["house", "open_site", ...], ...}"""
import importlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import registry  # noqa: E402

out = {}
for key, mod_name in registry.BANK_MODULES.items():
    try:
        mod = importlib.import_module(mod_name)
        out[key] = sorted(getattr(mod, 'BUILDERS', {}).keys())
    except Exception:  # a format that does not load is shown as missing
        out[key] = []
print(json.dumps(out))
