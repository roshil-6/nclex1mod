"""Attach question-number grouping (read visually from the on-screen 'N / 50' counter) to the inventory.
Usage: python -E -P scripts/organise-screenshots/group.py source/screens/inventory.json
"""
import json, sys
from collections import defaultdict
# Counter values read from source/contact/counters.png, in S001..S230 order. None = counter not visible (scrolled page).
C = [45,46,47,47,47,47,47,47,47,47, 47,48,49,49,50,50,50,1,1,1, 1,1,2,3,4,4,5,6,7,7,
     7,8,8,9,9,9,10,10,10,11, 11,11,12,12,12,13,14,15,15,15, 16,17,18,18,18,18,18,18,18,18,
     18,18,19,20,21,22,22,22,22,22, 22,24,25,26,27,27,28,29,29,29, 29,29,30,30,30,30,31,32,33,33,
     33,33,33,34,34,34,34,34,34,34, 34,35,36,36,36,37,38,40,40,41, 41,41,42,43,43,43,44,1,1,1,
     2,2,3,3,4,4,5,5,6,6, 7,7,8,8,9,9,10,10,11,11, 12,12,13,13,14,14,15,15,16,16,
     17,17,18,18,19,19,None,20,21,21, 21,22,22,23,23,24,24,25,25,25, 25,26,26,27,27,28,28,29,29,30,
     30,31,31,32,None,32,33,33,34,34, 35,35,36,36,36,36,37,38,38,39, 40,40,40,41,41,42,42,43,43,44,
     44,None,45,46,47,None,None,None,None,None, 46,47,47,48,48,48,49,49,50,50]
assert len(C) == 230
p = sys.argv[1]
inv = json.load(open(p))
groups = defaultdict(lambda: {"exam": [], "review": []})
for i, it in enumerate(inv):
    n = C[i]
    it["phase"] = "exam-in-progress" if i < 117 else "answer-review"
    it["questionNumber"] = n
    it["groupingConfidence"] = "high" if n is not None and not (211 <= i + 1 <= 222) else "low"
    if it["exactDuplicateOf"]:
        it["groupingConfidence"] = "duplicate"
    if n is not None:
        groups[n]["exam" if i < 117 else "review"].append(it["id"])
json.dump(inv, open(p, "w"), indent=1)
json.dump({str(k): groups[k] for k in sorted(groups)}, open(p.replace("inventory.json", "groups.json"), "w"), indent=1)
missing_exam = [q for q in range(1, 51) if not groups[q]["exam"]]
missing_rev = [q for q in range(1, 51) if not groups[q]["review"]]
print("questions seen:", len(groups), "no exam screen:", missing_exam, "no review screen:", missing_rev)
