"""Is there an exact bank format for this case (bank + property type)?
stdin: the case JSON (as prepared by bankInfoForReport) → stdout: {"ok": true/false, "format": "open_site"}"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import registry  # noqa: E402

case = json.load(sys.stdin)
mod = registry.module_for(case)
fmt = None
ok = False
if mod is not None:
    fmt = mod.format_for(case)
    ok = fmt in getattr(mod, 'BUILDERS', {})
print(json.dumps({'ok': ok, 'format': fmt, 'bankFormat': getattr(mod, '__name__', None)}))
