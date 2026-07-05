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
        "ink": (43, 33, 56),
        "ink_soft": (95, 83, 112),
        "parchment": (255, 248, 232),
        "sand": (242, 212, 145),
        "moss": (116, 169, 76),
        "moss_dark": (89, 121, 60),
        "sea": (47, 126, 166),
        "sea_dark": (22, 69, 96),
        "coin": (255, 201, 60),
        "coral": (209, 75, 61),
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
            r = int(102 + mix * (255 - 102))
            g = int(179 + mix * (217 - 179))
            b = int(232 + mix * (138 - 232))
        else:
            mix = (t - 0.55) / 0.45
            r = int(47 + mix * (22 - 47))
            g = int(126 + mix * (69 - 126))
            b = int(166 + mix * (96 - 166))
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

    # Pixel-art island vignette. Mirrors web/js/pixel-sprites.js
    # postcardScene(): a character grid painted as square cells.
    PIXEL_SCENE = [
        "............................................",
        "...CCC..........................G.G.G......",
        "..CCCCCC........................gggg.......",
        ".CCCCCCCCC.....................Gggggg......",
        "................CCC.............gggg.......",
        "...............CCCCC............G.G.G......",
        "............................................",
        "............................................",
        "............................................",
        "..................RRRR......TT.TT...........",
        ".................RRRRRR......TTT............",
        ".................kWkkWk.......K.............",
        ".................kkddkk.......K.............",
        "..........ssssssssssssssssss................",
        ".......ssssssssssssssssssssssss.............",
        ".....ssssTTTTTTTTTTTTTTTTssssss.............",
        "....ssssTTTTTTTTTTTTTTTTTTssss..............",
        "....ssssTTTTTTTTTTTTTTTTTTsssss.............",
        ".....ssssTTTTTTTTTTTTTTssss.................",
        ".......ssssssssssssssss.....................",
        "............................................",
        "....ww.ww.ww................................",
        "..........................ww.ww............",
        "............................................",
    ]
    PIXEL_COLORS = {
        "C": (255, 248, 232),
        "G": (255, 201, 60),
        "g": (255, 221, 107),
        "s": (242, 212, 145),
        "T": (116, 169, 76),
        "R": (192, 71, 47),
        "k": (198, 141, 82),
        "W": (253, 243, 216),
        "d": (61, 46, 74),
        "K": (123, 86, 53),
        "w": (255, 248, 232),
    }

    def draw_island(cx, cy, scale=1.0):
        cell = int(15 * scale)
        cols = len(PIXEL_SCENE[0])
        rows_n = len(PIXEL_SCENE)
        left = cx - (cols * cell) // 2
        top = cy - (rows_n * cell) // 2
        for j, row in enumerate(PIXEL_SCENE):
            for i, ch in enumerate(row):
                color = PIXEL_COLORS.get(ch)
                if not color:
                    continue
                x0 = left + i * cell
                y0 = top + j * cell
                draw.rectangle([x0, y0, x0 + cell, y0 + cell], fill=color)

    # Sea motion lines.
    for offset in (760, 920, 1120, 1350, 1540):
        line(
            [(70, offset), (230, offset - 24), (390, offset + 18), (570, offset - 10), (820, offset + 20), (1010, offset - 8)],
            (255, 248, 232),
            5,
        )

    # Postcard face.
    card = [72, 92, W - 72, H - 92]
    rect([card[0] + 18, card[1] + 22, card[2] + 18, card[3] + 22], (43, 33, 56), None, 0)
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

    # Four rows fit between the section title and the footer rule; five
    # collided with the "Most used" line and footer text.
    top_apps = daily[:4]
    if top_apps:
        max_min = top_apps[0]["minutes"]
        bar_colors = [
            palette["moss"],
            palette["sea"],
            palette["coral"],
            palette["coin"],
        ]
        for i, app in enumerate(top_apps):
            color = bar_colors[i % len(bar_colors)]
            app_name = fit_text(draw, app["app_name"], font_small, W - 380)
            draw.text((132, y_pos), app_name, fill=palette["ink"], font=font_small, anchor="lt")
            draw.text((W - 132, y_pos), format_time(app["minutes"]), fill=palette["ink_soft"], font=font_small, anchor="rt")
            y_pos += 36
            rect([132, y_pos, W - 132, y_pos + 16], palette["sand"], palette["ink"], 2)
            bar_width = int((app["minutes"] / max_min) * (W - 264)) if max_min > 0 else 0
            rect([132, y_pos, 132 + bar_width, y_pos + 16], color, None, 0)
            y_pos += 40
    else:
        centered_text(W // 2, y_pos + 40, "No tracked app time on this date", font_small, palette["ink_soft"], W - 260)

    # Most used app highlight
    if stats.get("most_used_app"):
        y_pos = min(y_pos + 6, H - 272)
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
