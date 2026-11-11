#!/usr/bin/env python3
import os
from PIL import Image, ImageDraw, ImageFont

def render_logo(size=512, shape="square"):
    scale = 4
    canvas = size * scale
    img = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Palette matching SVG
    c_blue_top = (30, 58, 138)
    c_blue_bot = (37, 99, 235)
    c_gold = (250, 195, 45)
    c_cyan = (56, 189, 248)
    c_navy = (30, 58, 138)
    
    if shape != "foreground":
        for y in range(canvas):
            t = y / float(canvas)
            r = int(c_blue_top[0] * (1 - t) + c_blue_bot[0] * t)
            g = int(c_blue_top[1] * (1 - t) + c_blue_bot[1] * t)
            b = int(c_blue_top[2] * (1 - t) + c_blue_bot[2] * t)
            draw.line([(0, y), (canvas, y)], fill=(r, g, b, 255))
            
        mask = Image.new("L", (canvas, canvas), 0)
        mask_draw = ImageDraw.Draw(mask)
        if shape == "circle":
            mask_draw.ellipse([0, 0, canvas, canvas], fill=255)
        else:
            radius = int(canvas * 0.22)
            mask_draw.rounded_rectangle([0, 0, canvas, canvas], radius=radius, fill=255)
        img.putalpha(mask)
        draw = ImageDraw.Draw(img)

    cx = canvas / 2.0
    cy = canvas / 2.0
    scale_factor = 0.72 if shape == "foreground" else 0.92
    
    # Roof Chevron
    roof_y = cy - int(canvas * 0.26 * scale_factor)
    roof_w = int(canvas * 0.30 * scale_factor)
    roof_h = int(canvas * 0.16 * scale_factor)
    stroke_w = int(canvas * 0.055 * scale_factor)
    
    draw.line([
        (cx - roof_w, roof_y + roof_h),
        (cx, roof_y),
        (cx + roof_w, roof_y + roof_h)
    ], fill=c_gold + (255,), width=stroke_w, joint="curve")
    
    # Cyan Diamond Crest
    inner_y = roof_y + int(roof_h * 0.58)
    d_size = int(canvas * 0.048 * scale_factor)
    draw.polygon([
        (cx, inner_y - d_size),
        (cx + d_size, inner_y),
        (cx, inner_y + d_size),
        (cx - d_size, inner_y)
    ], fill=c_cyan + (255,))

    # Bold Typography "GCR"
    font_size = int(canvas * 0.23 * scale_factor)
    font = None
    for font_path in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFPro-Bold.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial Bold.ttf"
    ]:
        if os.path.exists(font_path):
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except Exception:
                pass
    if not font:
        font = ImageFont.load_default()
        
    text = "GCR"
    bbox = draw.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    
    text_y = cy + int(canvas * 0.02 * scale_factor)
    draw.text((cx - tw / 2.0, text_y), text, fill=(255, 255, 255, 255), font=font)
    
    # Subtitle "VALUATION" badge - Solid White with Bold Navy Text for 100% Visibility!
    sub_font_size = int(canvas * 0.058 * scale_factor)
    sub_font = None
    for font_path in [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFPro-Bold.ttf",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/Library/Fonts/Arial Bold.ttf"
    ]:
        if os.path.exists(font_path):
            try:
                sub_font = ImageFont.truetype(font_path, sub_font_size)
                break
            except Exception:
                pass
    if not sub_font:
        sub_font = ImageFont.load_default()
        
    sub_text = "VALUATION"
    s_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
    stw = s_bbox[2] - s_bbox[0]
    sth = s_bbox[3] - s_bbox[1]
    
    sub_y = text_y + th + int(canvas * 0.045 * scale_factor)
    pill_pad_x = int(canvas * 0.055 * scale_factor)
    pill_pad_y = int(canvas * 0.018 * scale_factor)
    
    pill_box = [
        cx - stw / 2.0 - pill_pad_x,
        sub_y - pill_pad_y,
        cx + stw / 2.0 + pill_pad_x,
        sub_y + sth + pill_pad_y
    ]
    # Pure solid white pill background
    draw.rounded_rectangle(pill_box, radius=int(canvas * 0.035 * scale_factor), fill=(255, 255, 255, 255))
    # Deep Navy Blue text for maximum AAA contrast
    draw.text((cx - stw / 2.0, sub_y), sub_text, fill=c_navy + (255,), font=sub_font)
    
    return img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    base_dir = "/Users/apple/GCR /gcrapp/ValuationApp/android/app/src/main/res"
    densities = {
        "mdpi": {"icon": 48, "foreground": 108},
        "hdpi": {"icon": 72, "foreground": 162},
        "xhdpi": {"icon": 96, "foreground": 216},
        "xxhdpi": {"icon": 144, "foreground": 324},
        "xxxhdpi": {"icon": 192, "foreground": 432},
    }
    
    for density, sizes in densities.items():
        folder = os.path.join(base_dir, f"mipmap-{density}")
        os.makedirs(folder, exist_ok=True)
        render_logo(sizes["icon"], shape="square").save(os.path.join(folder, "ic_launcher.png"), "PNG")
        render_logo(sizes["icon"], shape="circle").save(os.path.join(folder, "ic_launcher_round.png"), "PNG")
        render_logo(sizes["foreground"], shape="foreground").save(os.path.join(folder, "ic_launcher_foreground.png"), "PNG")
        
    web_logo = render_logo(512, shape="square")
    web_dir = "/Users/apple/GCR /gcrapp/ValuationApp/public"
    web_logo.save(os.path.join(web_dir, "gcr_logo.png"), "PNG")
    web_logo.save("/Users/apple/GCR /gcrapp/ValuationApp/src/assets/gcr_logo.png", "PNG")
    web_logo.save("/Users/apple/.gemini/antigravity-ide/brain/14686a6c-0324-4f3e-b600-64ef800d3c96/gcr_app_icon.png", "PNG")
    print("Re-rendered all icons with high contrast solid white badge for VALUATION!")

if __name__ == "__main__":
    main()
