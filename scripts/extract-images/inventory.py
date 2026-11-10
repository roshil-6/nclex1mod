"""Inventory extracted screenshots: stable IDs, dimensions, perceptual hashes, near-duplicates.
Usage: python -I scripts/extract-images/inventory.py <raw_dir> <out_dir>
"""
import os, re, sys, json, shutil, hashlib
from PIL import Image
import imagehash

raw, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
rx = re.compile(r"at (\d+)\.(\d+)\.(\d+) (AM|PM)(?: \((\d+)\))?")
items = []
for zdir in sorted(os.listdir(raw)):
    for fn in os.listdir(os.path.join(raw, zdir)):
        m = rx.search(fn)
        h, mi, s, ap, n = m.groups()
        h = int(h) % 12 + (12 if ap == "PM" else 0)
        items.append(((h, int(mi), int(s), int(n or 0)), zdir, fn))
items.sort()
inv = []
for idx, (key, zdir, fn) in enumerate(items, 1):
    src = os.path.join(raw, zdir, fn)
    sid = f"S{idx:03d}"
    dst = os.path.join(out, sid + ".jpg")
    shutil.copyfile(src, dst)
    im = Image.open(src)
    inv.append({
        "id": sid, "zip": zdir, "originalFilename": fn,
        "width": im.width, "height": im.height,
        "bytes": os.path.getsize(src),
        "sha1": hashlib.sha1(open(src, "rb").read()).hexdigest(),
        "phash": str(imagehash.phash(im)), "dhash": str(imagehash.dhash(im)),
        "path": dst.replace("\\", "/"),
    })
# near-duplicate detection
for a in inv:
    a["exactDuplicateOf"] = None
    a["nearDuplicates"] = []
for i, a in enumerate(inv):
    for b in inv[:i]:
        if a["sha1"] == b["sha1"] and not a["exactDuplicateOf"]:
            a["exactDuplicateOf"] = b["id"]
        d = imagehash.hex_to_hash(a["phash"]) - imagehash.hex_to_hash(b["phash"])
        if d <= 6:
            a["nearDuplicates"].append({"id": b["id"], "distance": int(d)})
json.dump(inv, open(os.path.join(out, "inventory.json"), "w"), indent=1)
print(len(inv), "images")
print("exact dups:", sum(1 for x in inv if x["exactDuplicateOf"]))
print("near dups:", [(x["id"], x["nearDuplicates"]) for x in inv if x["nearDuplicates"]])
from collections import Counter
print(Counter((x["width"], x["height"]) for x in inv))
