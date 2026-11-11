"""Lists text in a built template that still contains the sample's own values (should be none)."""
import sys, re, docx
sys.path.insert(0, '.')
from docx_tools import all_paragraphs
doc = docx.Document(sys.argv[1])
pat = re.compile(sys.argv[2], re.I)
seen = set()
for p in all_paragraphs(doc):
    tx = p.text.strip()
    if tx and pat.search(tx) and tx not in seen:
        seen.add(tx)
        print('LEFT:', tx[:150])
