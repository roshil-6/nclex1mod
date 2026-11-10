import sys, os, json
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
inv = json.load(open(os.path.join(src, "inventory.json")))
W, H, C, R = 250, 400, 6, 2
for s in range(0, len(inv), C*R):
    sheet = Image.new("RGB", (W*C, H*R), "white")
    d = ImageDraw.Draw(sheet)
    for k, it in enumerate(inv[s:s+C*R]):
        im = Image.open(it["path"]).crop((0, 160, 1000, 1500)).resize((W, H))
        x, y = (k % C)*W, (k//C)*H
        sheet.paste(im, (x, y)); d.rectangle([x, y, x+60, y+16], fill="yellow"); d.text((x+2, y+2), it["id"], fill="black")
    sheet.save(os.path.join(out, f"sheet_{s//(C*R):02d}.jpg"), quality=80)
