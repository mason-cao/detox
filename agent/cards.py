"""Generate shareable screen time cards as PNG images."""

import os
import time
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from agent.config import CARDS_DIR
from agent import database as db


def get_font(size, bold=False):
    """Try to load a system font, fall back to default."""
    font_paths = [
        "/System/Library/Fonts/SFPro-Bold.otf" if bold else "/System/Library/Fonts/SFPro-Regular.otf",
        "/System/Library/Fonts/SF-Pro-Display-Bold.otf" if bold else "/System/Library/Fonts/SF-Pro-Display-Regular.otf",
        "/System/Library/Fonts/SFNSDisplay-Bold.otf" if bold else "/System/Library/Fonts/SFNSDisplay.otf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def format_time(minutes):
    if minutes <= 0:
        return "0m"
    h = int(minutes // 60)
    m = int(minutes % 60)
    if h == 0:
        return f"{m}m"
    if m == 0:
        return f"{h}h"
    return f"{h}h {m}m"


def fit_text(draw, text, font, max_width):
    """Truncate text to fit within max_width pixels."""
    text = str(text)
    if draw.textlength(text, font=font) <= max_width:
        return text

    ellipsis = "..."
    while text and draw.textlength(text + ellipsis, font=font) > max_width:
        text = text[:-1]
    return text + ellipsis if text else ellipsis


def generate_card(date):
    """Generate a shareable card PNG for the given date."""
    # Get data
    try:
        daily = db.get_daily_usage(date)
        stats = db.get_daily_stats(date)
    except Exception:
        daily = []
        stats = {}
    total = stats.get("total_minutes", 0)

    # Card dimensions (Instagram story: 1080x1920)
    W, H = 1080, 1920
    palette = {
        "ink": (42, 30, 42),
        "ink_soft": (91, 70, 70),
        "parchment": (255, 244, 214),
        "sand": (246, 211, 155),
        "moss": (107, 142, 78),
        "moss_dark": (74, 107, 58),
        "sea": (63, 143, 186),
        "sea_dark": (36, 112, 158),
        "coin": (255, 208, 74),
        "coral": (196, 69, 58),
        "wood": (123, 86, 53),
        "cream": (255, 250, 232),
    }
    img = Image.new("RGB", (W, H), palette["sea"])
    draw = ImageDraw.Draw(img)

    # Dawn Cove background.
    for y in range(H):
        t = y / H
        if t < 0.55:
            mix = t / 0.55
            r = int(123 + mix * (255 - 123))
            g = int(184 + mix * (217 - 184))
            b = int(232 + mix * (138 - 232))
        else:
            mix = (t - 0.55) / 0.45
            r = int(63 + mix * (36 - 63))
            g = int(143 + mix * (112 - 143))
            b = int(186 + mix * (158 - 186))
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Fonts
    font_huge = get_font(96, bold=True)
    font_title = get_font(54, bold=True)
    font_large = get_font(46, bold=True)
    font_medium = get_font(34, bold=True)
    font_small = get_font(28, bold=False)
    font_tiny = get_font(22, bold=False)

    def rect(box, fill, outline=None, width=3):
        draw.rectangle(box, fill=fill, outline=outline, width=width)

    def centered_text(x, y, text, font, fill, max_width=None):
        value = fit_text(draw, text, font, max_width) if max_width else text
        draw.text((x, y), value, fill=fill, font=font, anchor="mt")

    def left_text(x, y, text, font, fill, max_width=None):
        value = fit_text(draw, text, font, max_width) if max_width else text
        draw.text((x, y), value, fill=fill, font=font, anchor="lt")

    def line(points, fill, width=4):
        draw.line(points, fill=fill, width=width, joint="curve")

    def draw_island(cx, cy, scale=1.0):
        sand = [
            (cx - 220 * scale, cy + 58 * scale),
            (cx - 156 * scale, cy - 78 * scale),
            (cx + 62 * scale, cy - 118 * scale),
            (cx + 218 * scale, cy - 16 * scale),
            (cx + 156 * scale, cy + 110 * scale),
            (cx - 54 * scale, cy + 134 * scale),
        ]
        grass = [
            (cx - 116 * scale, cy + 24 * scale),
            (cx - 14 * scale, cy - 70 * scale),
            (cx + 126 * scale, cy + 12 * scale),
            (cx + 28 * scale, cy + 94 * scale),
        ]
        draw.polygon(sand, fill=palette["sand"], outline=palette["ink"])
        line(sand + [sand[0]], palette["ink"], int(5 * scale))
        draw.polygon(grass, fill=palette["moss"], outline=palette["ink"])
        line(grass + [grass[0]], palette["ink"], int(4 * scale))
        line(
            [
                (cx - 72 * scale, cy + 38 * scale),
                (cx - 8 * scale, cy - 6 * scale),
                (cx + 72 * scale, cy + 20 * scale),
            ],
            palette["cream"],
            int(11 * scale),
        )
        rect(
            [
                cx + 72 * scale,
                cy - 54 * scale,
                cx + 128 * scale,
                cy + 18 * scale,
            ],
            palette["wood"],
            palette["ink"],
            int(4 * scale),
        )
        roof = [
            (cx + 54 * scale, cy - 52 * scale),
            (cx + 100 * scale, cy - 94 * scale),
            (cx + 146 * scale, cy - 52 * scale),
        ]
        draw.polygon(roof, fill=palette["coral"], outline=palette["ink"])
        line(roof + [roof[0]], palette["ink"], int(4 * scale))
        rect(
            [
                cx - 94 * scale,
                cy - 28 * scale,
                cx - 48 * scale,
                cy + 24 * scale,
            ],
            palette["parchment"],
            palette["ink"],
            int(3 * scale),
        )
        draw.ellipse(
            [
                cx - 12 * scale,
                cy - 132 * scale,
                cx + 42 * scale,
                cy - 78 * scale,
            ],
            fill=palette["coin"],
            outline=palette["ink"],
            width=int(4 * scale),
        )

    # Sea motion lines.
    for offset in (760, 920, 1120, 1350, 1540):
        line(
            [(70, offset), (230, offset - 24), (390, offset + 18), (570, offset - 10), (820, offset + 20), (1010, offset - 8)],
            (255, 244, 214),
            5,
        )

    # Postcard face.
    card = [72, 92, W - 72, H - 92]
    rect([card[0] + 18, card[1] + 22, card[2] + 18, card[3] + 22], (42, 30, 42), None, 0)
    rect(card, palette["parchment"], palette["ink"], 8)
    rect([104, 126, W - 104, H - 126], palette["cream"], palette["ink"], 3)

    # Header + stamp.
    display_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    left_text(160, 172, "DETOX ISLE", font_title, palette["ink"], 570)
    left_text(164, 248, f"Postcard - {display_date}", font_small, palette["ink_soft"], 560)
    rect([780, 156, 940, 268], palette["sand"], palette["coral"], 5)
    draw.ellipse([815, 178, 905, 250], fill=palette["coin"], outline=palette["ink"], width=4)
    centered_text(860, 198, "D", font_large, palette["ink"])

    draw_island(W // 2, 520, 1.05)

    # Main total panel.
    rect([160, 760, W - 160, 1010], palette["sand"], palette["ink"], 6)
    centered_text(W // 2, 808, format_time(total), font_huge, palette["ink"], W - 360)
    centered_text(W // 2, 930, "total screen time", font_small, palette["ink_soft"], W - 360)

    # Stats row.
    stat_items = [
        ("Pickups", str(stats.get("pickups_count", 0))),
        ("Longest Detox", format_time(stats.get("longest_detox_minutes", 0))),
        ("Longest Session", format_time(stats.get("continuous_use_minutes", 0))),
    ]

    y_pos = 1075
    col_w = (W - 200) // len(stat_items)
    for i, (label, value) in enumerate(stat_items):
        x1 = 120 + col_w * i
        x2 = x1 + col_w - 22
        rect([x1, y_pos, x2, y_pos + 132], palette["parchment"], palette["ink"], 4)
        centered_text((x1 + x2) // 2, y_pos + 26, value, font_medium, palette["ink"], col_w - 42)
        centered_text((x1 + x2) // 2, y_pos + 82, label, font_tiny, palette["ink_soft"], col_w - 42)

    # Top apps.
    y_pos = 1274
    draw.text((132, y_pos), "Top Apps", fill=palette["ink"], font=font_medium, anchor="lt")
    y_pos += 64

    top_apps = daily[:5]
    if top_apps:
        max_min = top_apps[0]["minutes"]
        bar_colors = [
            palette["moss"],
            palette["sea"],
            palette["coral"],
            palette["coin"],
            palette["wood"],
        ]
        for i, app in enumerate(top_apps):
            color = bar_colors[i % len(bar_colors)]
            app_name = fit_text(draw, app["app_name"], font_small, W - 380)
            draw.text((132, y_pos), app_name, fill=palette["ink"], font=font_small, anchor="lt")
            draw.text((W - 132, y_pos), format_time(app["minutes"]), fill=palette["ink_soft"], font=font_small, anchor="rt")
            y_pos += 42
            rect([132, y_pos, W - 132, y_pos + 20], palette["sand"], palette["ink"], 2)
            bar_width = int((app["minutes"] / max_min) * (W - 264)) if max_min > 0 else 0
            rect([132, y_pos, 132 + bar_width, y_pos + 20], color, None, 0)
            y_pos += 50
    else:
        centered_text(W // 2, y_pos + 40, "No tracked app time on this date", font_small, palette["ink_soft"], W - 260)

    # Most used app highlight
    if stats.get("most_used_app"):
        y_pos = min(y_pos + 34, H - 310)
        centered_text(
            W // 2,
            y_pos,
            f"Most used: {stats['most_used_app']}",
            font_small,
            palette["coral"],
            W - 240,
        )

    # Footer
    line([(160, H - 232), (W - 160, H - 232)], palette["ink"], 3)
    centered_text(W // 2, H - 202, "Stamped by Detox", font_tiny, palette["ink_soft"], W - 260)
    centered_text(W // 2, H - 162, "Take control of your screen time", font_tiny, palette["ink_soft"], W - 260)

    # Save
    filename = f"detox-card-{date}-{int(time.time())}.png"
    filepath = os.path.join(CARDS_DIR, filename)
    img.save(filepath, "PNG", quality=95)
    return filename
