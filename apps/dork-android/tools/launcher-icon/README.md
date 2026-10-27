# Launcher icon assets

`generate.py` derives every icon in `app/src/main/res/` from the supplied
artwork (`source.jpg`) — it is checked in so the icon can be re-cut when the
brand mark changes, rather than someone hand-exporting ten files.

```bash
cd apps/dork-android/tools/launcher-icon
python3 generate.py        # writes ./out/
```

![Launcher icon at 144 / 144 round / 72 / 48 px](preview.png)

What it produces:

- `drawable-xxxhdpi/ic_launcher_background.png` — the gradient with the mark
  healed out of it (row-wise interpolation across the glyph, then a local blur)
- `drawable-xxxhdpi/ic_launcher_foreground.png` — the mark on transparency,
  sized to sit inside the 66dp adaptive-icon safe circle
- `mipmap-{mdpi..xxxhdpi}/ic_launcher.webp` and `ic_launcher_round.webp` — the
  composed legacy icons for launchers that ignore adaptive icons

Copy `out/` into `app/src/main/res/` to apply. Requires Pillow and numpy.
