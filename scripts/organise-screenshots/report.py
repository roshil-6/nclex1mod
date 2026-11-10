"""Write docs/extraction-report-tables.md from source/screens/inventory.json and groups.json."""
import json, sys
from collections import Counter
inv = json.load(open("source/screens/inventory.json", encoding="utf-8"))
groups = json.load(open("source/screens/groups.json"))
out = []
out.append(f"| Metric | Value |\n|---|---|")
out.append(f"| Screenshots inspected | {len(inv)} |")
z = Counter(i['zip'] for i in inv)
out.append(f"| Per archive (zip1–zip4, in download order) | {', '.join(f'{k}: {v}' for k, v in sorted(z.items()))} |")
out.append(f"| Dimensions | {', '.join(f'{w}×{h}: {n}' for (w, h), n in Counter((i['width'], i['height']) for i in inv).items())} |")
out.append(f"| Exact duplicates (identical bytes) | {sum(1 for i in inv if i['exactDuplicateOf'])} ({', '.join(i['id'] + '=' + i['exactDuplicateOf'] for i in inv if i['exactDuplicateOf'])}) |")
ph = Counter(i['phase'] for i in inv)
out.append(f"| Exam-in-progress screenshots | {ph['exam-in-progress']} (S001–S117) |")
out.append(f"| Answer-review screenshots | {ph['answer-review']} (S118–S230) |")
out.append(f"| Counter not visible (scrolled view) | {sum(1 for i in inv if i['questionNumber'] is None)} |")
out.append(f"| Distinct source question numbers | {len(groups)} of 50 |")
out.append("\n| Source Q | Exam screenshots | Review screenshots |\n|---|---|---|")
for q in sorted(groups, key=int):
    g = groups[q]
    out.append(f"| {q} | {', '.join(g['exam']) or '— (not captured)'} | {', '.join(g['review'])} |")
open("docs/extraction-report-tables.md", "w", encoding="utf-8").write("\n".join(out) + "\n")
print("written")
