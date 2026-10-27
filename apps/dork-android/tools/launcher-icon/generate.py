from PIL import Image, ImageFilter, ImageDraw
import numpy as np, os

SRC = 'source.jpg'
OUT = 'out'
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32) / 255.0
h, w, _ = a.shape

mx = a.max(axis=2); mn = a.min(axis=2)
v = mx
s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)

# The mark is pure white on blue. Restrict to the area it actually occupies so
# the artwork's white bloom at the top-left is not mistaken for glyph.
crop = np.zeros(v.shape, bool)
crop[150:800, 250:950] = True
core = crop & (v > 0.90) & (s < 0.10)
ys, xs = np.nonzero(core)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
print('mark bbox', x0, x1, y0, y1, 'size', x1 - x0, y1 - y0)

# Soft alpha: bright and colourless. Feathered so the anti-aliased edge survives.
alpha = np.clip((v - 0.88) / 0.08, 0, 1) * np.clip((0.14 - s) / 0.10, 0, 1)
alpha[~crop] = 0
pad = 6
ax0, ax1, ay0, ay1 = x0 - pad, x1 + pad, y0 - pad, y1 + pad
glyph = np.zeros((h, w, 4), np.float32)
glyph[..., :3] = 1.0  # the mark itself is white
glyph[..., 3] = alpha
glyph_img = Image.fromarray((glyph * 255).astype(np.uint8), 'RGBA').crop((ax0, ay0, ax1 + 1, ay1 + 1))
print('glyph crop', glyph_img.size)

# ---- background: the same field with the mark removed -----------------------
bg = a.copy()
bx0, bx1 = max(ax0 - 10, 0), min(ax1 + 10, w - 1)
by0, by1 = max(ay0 - 10, 0), min(ay1 + 10, h - 1)
for y in range(by0, by1 + 1):
    left = bg[y, bx0 - 1].copy()
    right = bg[y, min(bx1 + 1, w - 1)].copy()
    n = bx1 - bx0 + 1
    t = np.linspace(0, 1, n)[:, None]
    bg[y, bx0:bx1 + 1] = left * (1 - t) + right * t
bg_img = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8))
# Blur only the healed band so the rest of the original texture is untouched.
band = bg_img.crop((bx0, by0, bx1 + 1, by1 + 1)).filter(ImageFilter.GaussianBlur(18))
bg_img.paste(band, (bx0, by0))

# Square crop centred on the mark, then the adaptive-icon canvas.
cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
side = min(h, w)
sq_x0 = min(max(cx - side // 2, 0), w - side)
sq_y0 = min(max(cy - side // 2, 0), h - side)
square = bg_img.crop((sq_x0, sq_y0, sq_x0 + side, sq_y0 + side))
print('square crop', square.size)

CANVAS = 432          # 108dp at xxxhdpi
SAFE = 228            # glyph max dimension, inside the 264px safe circle
background = square.resize((CANVAS, CANVAS), Image.LANCZOS)

# The artwork's right edge is almost neutral grey, which makes the white dot
# sitting on it disappear at launcher size. A small saturation lift keeps the
# gradient the designer drew while holding the mark's contrast.
arr = np.asarray(background).astype(np.float32) / 255.0
bmax, bmin = arr.max(axis=2), arr.min(axis=2)
bs = np.where(bmax > 0, (bmax - bmin) / np.maximum(bmax, 1e-6), 0)
bv = bmax
bs2 = np.clip(bs * 1.25, 0, 1)
bv2 = np.clip(bv * (1.0 - 0.06 * (bv > 0.80)), 0, 1)
arr = np.clip(
    (arr - bmin[..., None]) * (bs2 / np.maximum(bs, 1e-6))[..., None]
    + bmin[..., None] * (bv2 / np.maximum(bv, 1e-6))[..., None],
    0, 1,
)
background = Image.fromarray((arr * 255).astype(np.uint8))
background.save(f'{OUT}/ic_launcher_background.png')

scale = SAFE / max(glyph_img.size)
glyph_scaled = glyph_img.resize(
    (max(1, round(glyph_img.width * scale)), max(1, round(glyph_img.height * scale))),
    Image.LANCZOS,
)
foreground = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
foreground.paste(
    glyph_scaled,
    ((CANVAS - glyph_scaled.width) // 2, (CANVAS - glyph_scaled.height) // 2),
    glyph_scaled,
)
foreground.save(f'{OUT}/ic_launcher_foreground.png')

# ---- legacy launcher icons --------------------------------------------------
DENSITIES = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
for name, size in DENSITIES.items():
    os.makedirs(f'{OUT}/mipmap-{name}', exist_ok=True)

    # Square: gradient, with the mark at 62% of the icon.
    square_icon = background.resize((size, size), Image.LANCZOS).convert('RGBA')
    g = glyph_img.resize(
        (round(glyph_img.width * (size * 0.62) / max(glyph_img.size)),
         round(glyph_img.height * (size * 0.62) / max(glyph_img.size))),
        Image.LANCZOS,
    )
    square_icon.alpha_composite(g, ((size - g.width) // 2, (size - g.height) // 2))
    square_icon.convert('RGB').save(f'{OUT}/mipmap-{name}/ic_launcher.webp', 'WEBP', quality=95, method=6)

    # Round: same composition, circular mask with a soft edge.
    round_icon = square_icon.copy()
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    round_icon.putalpha(mask)
    round_icon.save(f'{OUT}/mipmap-{name}/ic_launcher_round.webp', 'WEBP', quality=95, method=6)

# ---- preview sheet ----------------------------------------------------------
preview = Image.new('RGB', (1000, 380), (247, 250, 255))
preview.paste(background.resize((192, 192), Image.LANCZOS), (40, 60))
mask = Image.new('L', (192, 192), 0)
ImageDraw.Draw(mask).ellipse((0, 0, 191, 191), fill=255)
r = Image.new('RGB', (192, 192), (247, 250, 255))
r.paste(Image.open(f'{OUT}/mipmap-xxxhdpi/ic_launcher_round.webp').convert('RGBA'), (0, 0), Image.open(f'{OUT}/mipmap-xxxhdpi/ic_launcher_round.webp').convert('RGBA'))
preview.paste(r, (250, 60))
fg_view = Image.new('RGB', (192, 192), (40, 90, 200))
fg = foreground.resize((192, 192), Image.LANCZOS)
fg_view.paste(fg, (0, 0), fg)
preview.paste(fg_view, (460, 60))
preview.paste(Image.open(f'{OUT}/mipmap-mdpi/ic_launcher.webp').resize((48, 48), Image.NEAREST), (700, 60))
preview.paste(Image.open(f'{OUT}/mipmap-xxxhdpi/ic_launcher.webp').resize((192, 192), Image.LANCZOS), (780, 60))
preview.save(f'{OUT}/preview.png')
print('done')
