from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


OUT = Path("samples/assets/demo-detail-page.png")
WIDTH = 1280
HEIGHT = 1600
BG = (247, 243, 232)
TEXT = (35, 45, 55)
ACCENT = (198, 104, 63)
CARD = (255, 251, 245)
LINE = (222, 205, 190)


def load_font(size: int, bold: bool = False):
  candidates = [
    "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
  ]
  for candidate in candidates:
    path = Path(candidate)
    if path.exists():
      return ImageFont.truetype(str(path), size=size)
  return ImageFont.load_default()


def draw_wrapped(draw, text, xy, font, fill, max_width, line_spacing=10):
  words = text.split()
  lines = []
  current = []

  for word in words:
    trial = " ".join(current + [word])
    bbox = draw.textbbox((0, 0), trial, font=font)
    if bbox[2] - bbox[0] <= max_width or not current:
      current.append(word)
    else:
      lines.append(" ".join(current))
      current = [word]

  if current:
    lines.append(" ".join(current))

  x, y = xy
  for line in lines:
    draw.text((x, y), line, font=font, fill=fill)
    bbox = draw.textbbox((x, y), line, font=font)
    y = bbox[3] + line_spacing
  return y


def main():
  OUT.parent.mkdir(parents=True, exist_ok=True)
  image = Image.new("RGB", (WIDTH, HEIGHT), BG)
  draw = ImageDraw.Draw(image)

  title_font = load_font(56, bold=True)
  section_font = load_font(32, bold=True)
  body_font = load_font(28)
  badge_font = load_font(24, bold=True)

  draw.rounded_rectangle((60, 60, WIDTH - 60, 250), radius=28, fill=CARD, outline=LINE, width=2)
  draw.text((100, 100), "Portable Dog Water Bottle", font=title_font, fill=TEXT)
  draw.text((100, 175), "Leak-proof travel bottle for hiking, commuting, and road trips", font=body_font, fill=TEXT)

  cards = [
    ("100% Leak-Proof Lock", "Silica gel seal ring keeps bags and car seats dry.", "BACKPACK SAFE"),
    ("One-Hand Water Release", "Press with one hand while the other hand holds the leash.", "WALK READY"),
    ("19 oz Travel Capacity", "Best for short hikes, errands, and daily walks.", "SHORT TRIP"),
    ("Wide Trough Design", "Dogs can drink faster without splashing too much.", "EASY DRINK"),
  ]

  y = 320
  for heading, body, badge in cards:
    draw.rounded_rectangle((80, y, WIDTH - 80, y + 230), radius=24, fill=CARD, outline=LINE, width=2)
    draw.rounded_rectangle((110, y + 35, 310, y + 88), radius=18, fill=ACCENT)
    draw.text((132, y + 48), badge, font=badge_font, fill=(255, 250, 244))
    draw.text((110, y + 112), heading, font=section_font, fill=TEXT)
    draw_wrapped(draw, body, (110, y + 162), body_font, TEXT, max_width=900)
    y += 260

  draw.rounded_rectangle((80, 1380, WIDTH - 80, 1510), radius=24, fill=CARD, outline=LINE, width=2)
  draw.text((110, 1425), "Large dogs may need refills on long hikes.", font=section_font, fill=TEXT)

  image.save(OUT)
  print(OUT.resolve())


if __name__ == "__main__":
  main()
