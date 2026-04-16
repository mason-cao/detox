"""Generate shareable screen time cards as PNG images."""

import os
import time
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont
from backend.config import CARDS_DIR
from backend import database as db


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
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)

    # Background gradient (dark purple to dark blue)
    for y in range(H):
        r = int(10 + (y / H) * 5)
        g = int(10 + (y / H) * 5)
        b = int(15 + (y / H) * 20)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Fonts
    font_huge = get_font(96, bold=True)
    font_large = get_font(48, bold=True)
    font_medium = get_font(36, bold=False)
    font_small = get_font(28, bold=False)
    font_tiny = get_font(22, bold=False)

    # Header
    y_pos = 120
    draw.text((W // 2, y_pos), "DETOX", fill=(99, 102, 241), font=font_large, anchor="mt")
    y_pos += 60
    draw.text((W // 2, y_pos), "Screen Time Report", fill=(148, 163, 184), font=font_small, anchor="mt")

    # Date
    y_pos += 50
    display_date = datetime.strptime(date, "%Y-%m-%d").strftime("%B %d, %Y")
    draw.text((W // 2, y_pos), display_date, fill=(100, 116, 139), font=font_tiny, anchor="mt")

    # Total screen time (big number)
    y_pos += 100
    # Accent circle background
    draw.ellipse(
        [W // 2 - 180, y_pos - 20, W // 2 + 180, y_pos + 220],
        fill=(99, 102, 241, 30),
        outline=(99, 102, 241),
        width=3,
    )
    draw.text((W // 2, y_pos + 60), format_time(total), fill=(255, 255, 255), font=font_huge, anchor="mt")
    draw.text((W // 2, y_pos + 170), "total screen time", fill=(148, 163, 184), font=font_tiny, anchor="mt")

    # Stats row
    y_pos += 300
    stat_items = [
        ("Pickups", str(stats.get("pickups_count", 0))),
        ("Longest Detox", format_time(stats.get("longest_detox_minutes", 0))),
        ("Longest Session", format_time(stats.get("continuous_use_minutes", 0))),
    ]

    col_w = W // len(stat_items)
    for i, (label, value) in enumerate(stat_items):
        cx = col_w * i + col_w // 2
        draw.text((cx, y_pos), value, fill=(255, 255, 255), font=font_large, anchor="mt")
        draw.text((cx, y_pos + 55), label, fill=(100, 116, 139), font=font_tiny, anchor="mt")

    # Divider
    y_pos += 120
    draw.line([(100, y_pos), (W - 100, y_pos)], fill=(42, 42, 62), width=2)

    # Top 5 apps
    y_pos += 40
    draw.text((100, y_pos), "Top Apps", fill=(148, 163, 184), font=font_medium, anchor="lt")
    y_pos += 60

    top_apps = daily[:5]
    if top_apps:
        max_min = top_apps[0]["minutes"]
        bar_colors = [
            (99, 102, 241),
            (139, 92, 246),
            (236, 72, 153),
            (245, 158, 11),
            (34, 197, 94),
        ]
        for i, app in enumerate(top_apps):
            color = bar_colors[i % len(bar_colors)]
            app_name = fit_text(draw, app["app_name"], font_small, W - 360)
            # App name
            draw.text((100, y_pos), app_name, fill=(226, 232, 240), font=font_small, anchor="lt")
            # Time
            draw.text((W - 100, y_pos), format_time(app["minutes"]), fill=(148, 163, 184), font=font_small, anchor="rt")
            # Bar
            y_pos += 42
            bar_width = int((app["minutes"] / max_min) * (W - 200)) if max_min > 0 else 0
            draw.rounded_rectangle(
                [100, y_pos, 100 + bar_width, y_pos + 16],
                radius=8,
                fill=color,
            )
            # Bar background
            draw.rounded_rectangle(
                [100 + bar_width, y_pos, W - 100, y_pos + 16],
                radius=8,
                fill=(30, 30, 46),
            )
            y_pos += 50

    # Most used app highlight
    if stats.get("most_used_app"):
        y_pos += 30
        draw.text(
            (W // 2, y_pos),
            fit_text(draw, f"Most used: {stats['most_used_app']}", font_medium, W - 200),
            fill=(99, 102, 241),
            font=font_medium,
            anchor="mt",
        )

    # Footer
    draw.text(
        (W // 2, H - 100),
        "Generated by Detox",
        fill=(64, 74, 91),
        font=font_tiny,
        anchor="mt",
    )
    draw.text(
        (W // 2, H - 60),
        "Take control of your screen time",
        fill=(50, 58, 70),
        font=font_tiny,
        anchor="mt",
    )

    # Save
    filename = f"detox-card-{date}-{int(time.time())}.png"
    filepath = os.path.join(CARDS_DIR, filename)
    img.save(filepath, "PNG", quality=95)
    return filename
