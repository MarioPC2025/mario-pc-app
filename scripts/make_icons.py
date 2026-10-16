"""Genera los íconos y la pantalla de inicio de Android a partir de icon-512.png (logo del sitio)."""
import sys, os
from PIL import Image
src = Image.open(sys.argv[1]).convert('RGB')
res = sys.argv[2]
BG = (7, 9, 10)
G = (29, 221, 101)
# Burbuja verde como capa con transparencia (lo oscuro queda transparente y se ve el fondo)
w, h = src.size
bub = Image.new('RGBA', (w, h))
px, out = src.load(), bub.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        t = max(0.0, min(1.0, (g - BG[1]) / (G[1] - BG[1])))
        out[x, y] = (G[0], G[1], G[2], int(round(t * 255)))
bub = bub.crop(bub.getbbox())
def bubble_on(size, frac, bg):
    im = Image.new('RGBA', (size, size), bg)
    bw = int(size * frac); bh = int(bw * bub.height / bub.width)
    b = bub.resize((bw, bh), Image.LANCZOS)
    im.alpha_composite(b, ((size - bw) // 2, (size - bh) // 2 + int(size * 0.02)))
    return im
dens = {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}
for d, k in dens.items():
    p = os.path.join(res, 'mipmap-' + d)
    leg = bubble_on(int(48 * k), 0.62, BG + (255,))
    leg.convert('RGB').save(os.path.join(p, 'ic_launcher.png'))
    # redondo: círculo oscuro con la burbuja
    rnd = bubble_on(int(48 * k), 0.58, BG + (255,))
    mask = Image.new('L', rnd.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((0, 0, rnd.width - 1, rnd.height - 1), fill=255)
    rr = Image.new('RGBA', rnd.size, (0, 0, 0, 0)); rr.paste(rnd, (0, 0), mask)
    rr.save(os.path.join(p, 'ic_launcher_round.png'))
    bubble_on(int(108 * k), 0.50, (0, 0, 0, 0)).save(os.path.join(p, 'ic_launcher_foreground.png'))
# pantallas de inicio
for root, _, files in os.walk(res):
    for f in files:
        if f == 'splash.png':
            fp = os.path.join(root, f)
            sw, sh = Image.open(fp).size
            im = Image.new('RGBA', (sw, sh), BG + (255,))
            s = min(sw, sh)
            bw = int(s * 0.28); bh = int(bw * bub.height / bub.width)
            im.alpha_composite(bub.resize((bw, bh), Image.LANCZOS), ((sw - bw) // 2, (sh - bh) // 2))
            im.convert('RGB').save(fp)
print('ok')
