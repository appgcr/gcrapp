"""
Which banks have their own exact report format installed, and which module builds it.

A bank's format key comes from Settings → Banks (case.reportFormat.bankKey); old cases
without it are matched by name.
"""
import importlib
import re

BANK_MODULES = {
    'apgb': 'apgb',   # Andhra Pradesh Grameena Bank
    'bob': 'bob',     # Bank of Baroda
    'boi': 'boi',     # Bank of India
    'canara': 'canara',  # Canara Bank
    'union': 'union',    # Union Bank of India
    'pnb': 'pnb',        # Punjab National Bank
    'iob': 'iob',        # Indian Overseas Bank
    'cbi': 'cbi',        # Central Bank of India
    'uco': 'uco',        # UCO Bank
    'karnataka': 'karnataka',  # Karnataka Bank
    'indian': 'indian',  # Indian Bank
    'sbi': 'sbi',        # State Bank of India
    'bom': 'bom',        # Bank of Maharashtra
}
NAME_HINTS = [(re.compile(r'grameena|\bapgb\b', re.I), 'apgb'), (re.compile(r'baroda|\bbob\b', re.I), 'bob'),
              (re.compile(r'^bank of india|\bboi\b', re.I), 'boi'),
              (re.compile(r'canara', re.I), 'canara'), (re.compile(r'union bank|\bubi\b', re.I), 'union'),
              (re.compile(r'punjab national|\bpnb\b', re.I), 'pnb'),
              (re.compile(r'indian overseas|\biob\b', re.I), 'iob'),
              (re.compile(r'central bank|\bcbi\b', re.I), 'cbi'),
              (re.compile(r'\buco\b|united commercial', re.I), 'uco'),
              (re.compile(r'karnataka bank|\bkbl\b', re.I), 'karnataka'),
              (re.compile(r'^indian bank', re.I), 'indian'),
              (re.compile(r'state bank of india|\bsbi\b', re.I), 'sbi'),
              (re.compile(r'maharas?h?tra|\bbom\b', re.I), 'bom')]


def bank_key(case):
    key = ((case.get('reportFormat') or {}).get('bankKey') or '').lower()
    if key:
        # The bank's format chosen in Settings → Banks decides (a bank set to 'standard' stays standard)
        return key if key in BANK_MODULES else None
    name = case.get('bankName') or ''
    for rx, k in NAME_HINTS:
        if rx.search(name):
            return k
    return None


def module_for(case):
    key = bank_key(case)
    return importlib.import_module(BANK_MODULES[key]) if key else None
