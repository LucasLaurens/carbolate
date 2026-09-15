"""Rebuilds the store listing images from a real render of the panel.

Not a mock-up: `panel-*.png` are headless-Chrome screenshots of the built
extension served from `dist/`, with seeded demonstration data — which is also
what keeps real browsing domains off a public listing. Regenerate with:

    npm run build
    python3 -m http.server 5274 --directory dist &
    # render dist/store-shot.html and dist/store-shot-en.html at 2x into the
    # paths below, then:
    python3 scripts/compose-store-assets.py
"""

from PIL import Image, ImageDraw, ImageFont
import pathlib
S = "/private/tmp/claude-501/-Users-lucaslaurens-Documents-projects-carbolate/69f00603-a118-4128-ba55-7611feb0caca/scratchpad"
OUT = pathlib.Path("store-assets")
CREAM, INK, MUTED, GREEN = (254, 250, 240), (28, 25, 23), (120, 113, 108), (21, 128, 61)
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
font = lambda p, s: ImageFont.truetype(p, s)
logo = Image.open("public/assets/icons/icon-128.png").convert("RGBA").resize((72, 72), Image.LANCZOS)

def wrap(draw, text, f, width):
    lines, line = [], ""
    for word in text.split():
        candidate = (line + " " + word).strip()
        if draw.textlength(candidate, font=f) <= width:
            line = candidate
        else:
            lines.append(line); line = word
    return lines + ([line] if line else [])

def compose(panel, title, sub_head, sub_tail, bullets, out):
    canvas = Image.new("RGB", (1280, 800), CREAM)
    draw = ImageDraw.Draw(canvas)
    shot = panel.resize((round(panel.width * 716 / panel.height), 716), Image.LANCZOS)
    px, py = 1280 - shot.width - 96, 42
    draw.rounded_rectangle((px - 16, py - 16, px + shot.width + 16, py + 732), 20, fill=(255, 255, 255))
    canvas.paste(shot, (px, py))
    canvas.paste(logo, (96, 128), logo)
    draw.text((184, 148), "CARBOLATE", font=font(BOLD, 30), fill=INK)

    width = px - 16 - 96 - 40
    title_font = font(BOLD, 50)
    lines = wrap(draw, title, title_font, width)
    if len(lines) > 1:
        title_font = font(BOLD, 42)
        lines = wrap(draw, title, title_font, width)

    y = 268
    for line in lines:
        draw.text((96, y), line, font=title_font, fill=INK)
        y += title_font.size + 10
    y += 22

    f, small = font(REG, 23), font(REG, 15)
    if sub_head:
        draw.text((96, y), sub_head, font=f, fill=MUTED)
        x = 96 + draw.textlength(sub_head, font=f)
        draw.text((x, y + 7), "2", font=small, fill=MUTED)
        x += draw.textlength("2", font=small) + 6
        first, *rest = wrap(draw, sub_tail, f, width - (x - 96))
        draw.text((x, y), first, font=f, fill=MUTED)
        for line in rest:
            y += 31; draw.text((96, y), line, font=f, fill=MUTED)
    else:
        for i, line in enumerate(wrap(draw, sub_tail, f, width)):
            draw.text((96, y + i * 31), line, font=f, fill=MUTED)
            y_last = i
        y += 31 * y_last
    y += 74

    for line in bullets:
        draw.ellipse((98, y + 9, 108, y + 19), fill=GREEN)
        for i, part in enumerate(wrap(draw, line, font(REG, 22), width - 40)):
            draw.text((128, y + i * 30), part, font=font(REG, 22), fill=INK)
        y += 50
    canvas.save(out)

COPY = {
  "en": (("What your browsing costs", "Estimated CO", "for today, counting while you browse.",
          ["Network, machine and screen, in grams",
           "How many requests come from third parties",
           "Nothing ever leaves your browser"]),
         ("Seven days at a glance", "", "Each day graded on its own, never the week as a whole.",
          ["One bar per day, coloured by that day's grade",
           "A day nobody browsed draws no bar",
           "The change against the week before"])),
  "fr": (("Ce que coûte ta navigation", "CO", "estimé du jour, qui monte pendant que tu navigues.",
          ["Réseau, machine et écran, en grammes",
           "Combien de requêtes viennent de tiers",
           "Rien ne sort jamais de ton navigateur"]),
         ("Sept jours d'un coup d'œil", "", "Chaque jour noté pour lui-même, jamais la semaine entière.",
          ["Une barre par jour, à la couleur de sa note",
           "Un jour sans navigation ne dessine rien",
           "L'écart avec la semaine précédente"])),
}

for lang in ("en", "fr"):
    full = Image.open(S + "/panel-" + lang + ".png").convert("RGB")
    p = full.load()
    edge = max(x for x in range(full.width) if p[x, 400] != (255, 255, 255))
    bottom = max(y for y in range(full.height) if any(p[x, y] != (255, 255, 255) for x in range(0, edge, 4)))
    crop = full.crop((0, 0, edge + 1, bottom + 14))
    first, second = COPY[lang]
    compose(crop, *first, OUT / ("screenshot-1-today-" + lang + ".png"))
    compose(crop.crop((0, 1090, crop.width, crop.height - 48)), *second, OUT / ("screenshot-2-week-" + lang + ".png"))

# ── promo tiles ───────────────────────────────────────────────────────────
mark = Image.open("assets/logo-master-1024.png").convert("RGB").crop((136, 114, 925, 904))

def tile(path, tagline_runs, sub):
    canvas = Image.new("RGB", (440, 280), CREAM)
    draw = ImageDraw.Draw(canvas)
    canvas.paste(mark.resize((104, 104), Image.LANCZOS), (40, 40))
    draw.text((164, 58), "CARBOLATE", font=font(BOLD, 34), fill=INK)
    x, y, size = 166, 104, 17
    for text, small in tagline_runs:
        f = font(REG, round(size * 0.68) if small else size)
        draw.text((x, y + (size * 0.28 if small else 0)), text, font=f, fill=GREEN)
        x += draw.textlength(text, font=f) + (3 if small else 0)
    draw.line((40, 168, 400, 168), fill=(231, 229, 228), width=2)
    draw.text((40, 186), sub, font=font(REG, 19), fill=MUTED)
    canvas.save(path)

tile(OUT / "promo-tile-440x280-en.png",
     [("estimated CO", False), ("2", True), (" of your browsing", False)],
     "Network, machine and screen —\ncounted in your browser, and nowhere else.")
tile(OUT / "promo-tile-440x280-fr.png",
     [("le CO", False), ("2", True), (" estimé de ta navigation", False)],
     "Réseau, machine et écran — comptés\ndans ton navigateur, et nulle part ailleurs.")

print("composed")
