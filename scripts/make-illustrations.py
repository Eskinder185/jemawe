#!/usr/bin/env python3
"""
Generates Jemawe's banner illustrations (assets/illustrations/*.svg).

One visual language for every page: schematic line drawings on the midnight
banner, built from the same primitives (windows, phones, nodes, traces) in the
brand blues. No text and no fake UI copy: content is shown as abstract bars.

Run:  python3 scripts/make-illustrations.py
"""
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "assets" / "illustrations"
OUT.mkdir(parents=True, exist_ok=True)

LINE = "#93B4FD"     # blue-300
ACCENT = "#2563EB"   # blue-600
BRIGHT = "#7DD3FC"
PANEL = "#13213F"    # navy-800
PANEL2 = "#1E2D50"   # navy-700
WHITE = "#FFFFFF"

W, H = 560, 420


def svg(body: str) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" fill="none" '
        f'stroke-linecap="round" stroke-linejoin="round">{body}</svg>\n'
    )


def grid_dots() -> str:
    dots = []
    for x in range(40, W, 40):
        for y in range(40, H, 40):
            dots.append(f'<circle cx="{x}" cy="{y}" r="1.2" fill="{LINE}" opacity="0.18"/>')
    return "".join(dots)


def window(x, y, w, h, rows=3, chart=False, hero=True) -> str:
    """Browser/app window with abstract content bars."""
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.6" stroke-width="1.5"/>']
    s.append(f'<path d="M{x} {y+26}H{x+w}" stroke="{LINE}" stroke-opacity="0.35" stroke-width="1.2"/>')
    for i in range(3):
        s.append(f'<circle cx="{x+16+i*12}" cy="{y+13}" r="3" fill="{LINE}" opacity="0.5"/>')
    cy = y + 44
    if hero:
        s.append(f'<rect x="{x+18}" y="{cy}" width="{w*0.46:.0f}" height="12" rx="6" fill="{WHITE}" opacity="0.85"/>')
        s.append(f'<rect x="{x+18}" y="{cy+20}" width="{w*0.32:.0f}" height="8" rx="4" fill="{LINE}" opacity="0.5"/>')
        s.append(f'<rect x="{x+18}" y="{cy+38}" width="64" height="18" rx="6" fill="{ACCENT}"/>')
        cy += 72
    if chart:
        cw, ch = w - 36, 70
        s.append(f'<rect x="{x+18}" y="{cy}" width="{cw}" height="{ch}" rx="8" fill="{PANEL2}"/>')
        pts = [(0, 0.7), (0.18, 0.55), (0.36, 0.62), (0.54, 0.35), (0.72, 0.42), (0.9, 0.18), (1, 0.22)]
        d = "M" + " L".join(f"{x+28+px*(cw-20):.0f} {cy+10+py*(ch-20):.0f}" for px, py in pts)
        s.append(f'<path d="{d}" stroke="{BRIGHT}" stroke-width="2.4"/>')
        cy += ch + 14
    col_w = (w - 36 - 2 * 12) / 3
    for r in range(rows if rows <= 1 else 1):
        for c in range(3):
            cx = x + 18 + c * (col_w + 12)
            if cy + 46 <= y + h - 12:
                s.append(f'<rect x="{cx:.0f}" y="{cy}" width="{col_w:.0f}" height="46" rx="8" fill="{PANEL2}" stroke="{LINE}" stroke-opacity="0.25"/>')
                s.append(f'<rect x="{cx+10:.0f}" y="{cy+12}" width="{col_w*0.55:.0f}" height="6" rx="3" fill="{LINE}" opacity="0.6"/>')
                s.append(f'<rect x="{cx+10:.0f}" y="{cy+26}" width="{col_w*0.75:.0f}" height="5" rx="2.5" fill="{LINE}" opacity="0.3"/>')
    return "".join(s)


def phone(x, y, w=112, h=210, rows=4, tabs=False) -> str:
    s = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="20" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.7" stroke-width="1.6"/>']
    s.append(f'<rect x="{x+w/2-16:.0f}" y="{y+9}" width="32" height="5" rx="2.5" fill="{LINE}" opacity="0.4"/>')
    cy = y + 28
    s.append(f'<rect x="{x+12}" y="{cy}" width="{w-24}" height="28" rx="8" fill="{ACCENT}" opacity="0.9"/>')
    cy += 38
    if tabs:
        for i in range(3):
            s.append(f'<rect x="{x+12+i*30}" y="{cy}" width="24" height="10" rx="5" fill="{WHITE if i == 0 else LINE}" opacity="{0.9 if i == 0 else 0.35}"/>')
        cy += 20
    for i in range(rows):
        if cy + 22 > y + h - 10:
            break
        s.append(f'<rect x="{x+12}" y="{cy}" width="{(w-24)*0.6:.0f}" height="6" rx="3" fill="{WHITE}" opacity="0.7"/>')
        s.append(f'<rect x="{x+w-34}" y="{cy}" width="22" height="6" rx="3" fill="{BRIGHT}" opacity="0.8"/>')
        s.append(f'<rect x="{x+12}" y="{cy+12}" width="{(w-24)*0.8:.0f}" height="4" rx="2" fill="{LINE}" opacity="0.3"/>')
        cy += 30
    return "".join(s)


def node(cx, cy, r=26, glyph="", core=False) -> str:
    fill = ACCENT if core else PANEL
    stroke = BRIGHT if core else LINE
    return (
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-opacity="0.8" stroke-width="1.6"/>'
        f'<g transform="translate({cx-12} {cy-12})" stroke="{WHITE if core else LINE}" stroke-width="1.8">{glyph}</g>'
    )


def trace(d, bright=False, dash=False) -> str:
    extra = ' stroke-dasharray="4 6"' if dash else ""
    return f'<path d="{d}" stroke="{BRIGHT if bright else LINE}" stroke-opacity="{0.9 if bright else 0.5}" stroke-width="1.6"{extra}/>'


def badge(cx, cy, glyph) -> str:
    return (
        f'<circle cx="{cx}" cy="{cy}" r="20" fill="{ACCENT}" stroke="{BRIGHT}" stroke-width="1.5"/>'
        f'<g transform="translate({cx-12} {cy-12})" stroke="{WHITE}" stroke-width="2">{glyph}</g>'
    )


# Glyphs (24x24 coordinate space)
G = {
    "check": '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    "refresh": '<path d="M20 11a8 8 0 0 0-14.3-4.5L4 8.5M4 13a8 8 0 0 0 14.3 4.5L20 15.5"/><path d="M4 4v4.5h4.5M20 20v-4.5h-4.5"/>',
    "headset": '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3.5" y="13" width="4" height="6" rx="1.5"/><rect x="16.5" y="13" width="4" height="6" rx="1.5"/>',
    "monitor": '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M9 20h6M12 16v4"/>',
    "cpu": '<rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
    "browser": '<rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M3 9h18"/>',
    "wrench": '<path d="M14.7 6.3a4.5 4.5 0 0 0-6 5.5l-5.2 5.2a2 2 0 0 0 2.8 2.8l5.2-5.2a4.5 4.5 0 0 0 5.5-6l-2.7 2.7-2.4-.4-.4-2.4 2.7-2.7z"/>',
    "gear": '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    "user": '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    "calendar": '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    "mail": '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
    "message": '<path d="M4 5h16v11H9l-5 4V5z"/>',
    "book": '<path d="M4 5.5A2 2 0 0 1 6 3.5h13.5v15H6a2 2 0 0 0-2 2v-15z"/>',
    "flag": '<path d="M5 21V4M5 4h11.5l-2 4 2 4H5"/>',
    "arrow-up": '<path d="M12 19V5M5 12l7-7 7 7"/>',
    "file": '<path d="M14 3.5H6.5a1.5 1.5 0 0 0-1.5 1.5v14a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5z"/><path d="M14 3.5v5h5"/>',
    "heart": '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z"/>',
    "j": '<path d="M15 3v11a5.5 5.5 0 0 1-10.2 2.9" stroke-width="2.6"/>',
}


def qr(x, y, s=70) -> str:
    cells = [
        "1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111",
    ]
    out = [f'<rect x="{x}" y="{y}" width="{s}" height="{s}" rx="8" fill="{WHITE}"/>']
    cell = (s - 16) / 9
    pattern = [
        "111000111", "101011101", "111001111", "000110100", "101101011",
        "010010110", "111001101", "101010011", "111011101",
    ]
    for r, row in enumerate(pattern):
        for c, v in enumerate(row):
            if v == "1":
                out.append(f'<rect x="{x+8+c*cell:.1f}" y="{y+8+r*cell:.1f}" width="{cell-0.6:.1f}" height="{cell-0.6:.1f}" fill="#071226"/>')
    return "".join(out)


def laptop(x, y, w=300, h=180) -> str:
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.65" stroke-width="1.6"/>'
        f'<rect x="{x+14}" y="{y+14}" width="{w-28}" height="{h-28}" rx="6" fill="{PANEL2}"/>'
        f'<path d="M{x-30} {y+h+14}H{x+w+30}l-18 14H{x-12}z" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.65" stroke-width="1.6"/>'
    )


ILLOS = {}

ILLOS["web"] = grid_dots() + window(40, 60, 360, 260, chart=False) + phone(380, 150) + trace("M400 330 V370 H200", dash=True)
ILLOS["software"] = grid_dots() + window(50, 50, 400, 300, chart=True, hero=False) + node(470, 110, glyph=G["lock"], core=True) + trace("M450 110 H430")
ILLOS["restaurant"] = (
    grid_dots()
    + f'<circle cx="200" cy="230" r="120" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.35" stroke-width="1.5"/>'
    + f'<circle cx="200" cy="230" r="86" stroke="{LINE}" stroke-opacity="0.25" stroke-width="1.2"/>'
    + phone(250, 90, w=130, h=240, rows=5, tabs=True)
    + qr(420, 250)
    + trace("M420 285 H380", bright=True)
)
ILLOS["maintenance"] = grid_dots() + window(60, 70, 340, 240) + badge(420, 110, G["refresh"]) + badge(420, 190, G["check"]) + trace("M400 110 H380 M400 190 H380")
ILLOS["support"] = (
    grid_dots() + laptop(150, 120, 260, 160)
    + node(90, 90, glyph=G["headset"], core=True)
    + trace("M116 90 H150 Q160 90 160 100 V130", bright=True)
    + badge(430, 120, G["lock"])
    + f'<rect x="180" y="150" width="120" height="10" rx="5" fill="{WHITE}" opacity="0.8"/><rect x="180" y="170" width="190" height="7" rx="3.5" fill="{LINE}" opacity="0.4"/><rect x="180" y="186" width="160" height="7" rx="3.5" fill="{LINE}" opacity="0.4"/>'
)
ILLOS["business"] = (
    grid_dots()
    + node(280, 210, r=34, glyph=G["j"], core=True)
    + "".join(
        f'<rect x="{x}" y="{y}" width="110" height="76" rx="10" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.6" stroke-width="1.5"/>'
        f'<rect x="{x+12}" y="{y+14}" width="60" height="7" rx="3.5" fill="{WHITE}" opacity="0.75"/><rect x="{x+12}" y="{y+30}" width="80" height="5" rx="2.5" fill="{LINE}" opacity="0.35"/>'
        for x, y in [(60, 60), (390, 60), (60, 290), (390, 290)]
    )
    + trace("M170 98 H230 Q246 98 246 114 V180") + trace("M390 98 H330 Q314 98 314 114 V180")
    + trace("M170 328 H230 Q246 328 246 312 V240") + trace("M390 328 H330 Q314 328 314 312 V240")
)
ILLOS["os"] = grid_dots() + window(40, 80, 230, 200, rows=1) + window(290, 120, 230, 200, rows=1) + badge(280, 70, G["gear"])
ILLOS["repair"] = (
    grid_dots() + laptop(120, 100, 300, 170)
    + f'<rect x="200" y="150" width="140" height="70" rx="8" fill="{PANEL}" stroke="{BRIGHT}" stroke-width="1.5"/>'
    + "".join(f'<path d="M{x} 150 V138 M{x} 220 V232" stroke="{BRIGHT}" stroke-width="1.5"/>' for x in range(215, 340, 20))
    + badge(450, 110, G["wrench"])
)
ILLOS["upgrade"] = (
    grid_dots()
    + f'<rect x="60" y="150" width="300" height="70" rx="8" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.7" stroke-width="1.6"/>'
    + "".join(f'<rect x="{80+i*55}" y="165" width="38" height="40" rx="4" fill="{PANEL2}" stroke="{LINE}" stroke-opacity="0.4"/>' for i in range(5))
    + "".join(f'<path d="M{75+i*14} 220 V236" stroke="{BRIGHT}" stroke-width="2"/>' for i in range(20))
    + f'<rect x="120" y="270" width="220" height="80" rx="10" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.7" stroke-width="1.6"/>'
    + f'<rect x="140" y="290" width="70" height="40" rx="6" fill="{ACCENT}"/><rect x="226" y="296" width="90" height="8" rx="4" fill="{WHITE}" opacity="0.7"/><rect x="226" y="314" width="64" height="6" rx="3" fill="{LINE}" opacity="0.4"/>'
    + badge(440, 140, G["arrow-up"]) + trace("M420 140 H360", bright=True)
)
ILLOS["education"] = (
    grid_dots() + window(40, 70, 300, 240, rows=1)
    + node(410, 100, glyph=G["book"]) + node(470, 200, glyph=G["flag"]) + node(410, 300, glyph=G["check"], core=True)
    + trace("M410 126 Q410 170 446 186") + trace("M462 225 Q440 270 432 282", bright=True)
)
ILLOS["community"] = (
    grid_dots()
    + node(280, 120, r=34, glyph=G["heart"], core=True)
    + node(140, 240, glyph=G["user"]) + node(280, 300, glyph=G["user"]) + node(420, 240, glyph=G["user"])
    + trace("M260 148 L156 218") + trace("M280 154 V274") + trace("M300 148 L404 218")
    + trace("M166 240 H254 M306 300 H394", dash=True)
    + badge(470, 110, G["calendar"])
)
ILLOS["startup"] = (
    grid_dots() + window(40, 160, 260, 200, rows=1)
    + trace("M300 300 C380 290 420 220 470 110", bright=True)
    + node(470, 100, glyph=G["flag"], core=True)
    + "".join(f'<circle cx="{x}" cy="{y}" r="4" fill="{BRIGHT}"/>' for x, y in [(340, 292), (390, 262), (430, 200)])
)
ILLOS["professional"] = (
    grid_dots()
    + f'<rect x="80" y="60" width="220" height="290" rx="12" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.6" stroke-width="1.5"/>'
    + "".join(f'<rect x="104" y="{100+i*30}" width="{170 if i % 3 else 120}" height="7" rx="3.5" fill="{WHITE if i == 0 else LINE}" opacity="{0.8 if i == 0 else 0.35}"/>' for i in range(7))
    + badge(300, 320, G["lock"])
    + node(420, 120, glyph=G["calendar"]) + node(440, 250, glyph=G["message"])
    + trace("M300 120 H394") + trace("M300 250 H414")
)
ILLOS["about"] = (
    grid_dots()
    + node(280, 210, r=40, glyph=G["j"], core=True)
    + node(130, 100, glyph=G["browser"]) + node(430, 100, glyph=G["headset"]) + node(280, 350, glyph=G["cpu"])
    + trace("M246 188 L152 116") + trace("M314 188 L408 116") + trace("M280 250 V324") + trace("M156 100 H404", dash=True)
)
ILLOS["contact"] = (
    grid_dots()
    + f'<rect x="80" y="110" width="260" height="180" rx="14" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.65" stroke-width="1.6"/>'
    + f'<path d="m84 120 126 92 126-92" stroke="{LINE}" stroke-opacity="0.65" stroke-width="1.6"/>'
    + f'<path d="M380 160h120v76h-70l-30 24v-24h-20z" fill="{ACCENT}" stroke="{BRIGHT}" stroke-width="1.5"/>'
    + f'<rect x="398" y="182" width="80" height="7" rx="3.5" fill="{WHITE}" opacity="0.85"/><rect x="398" y="200" width="56" height="6" rx="3" fill="{WHITE}" opacity="0.5"/>'
    + trace("M340 200 H380", bright=True)
)
ILLOS["services"] = (
    grid_dots()
    + "".join(
        f'<rect x="{x}" y="{y}" width="200" height="110" rx="14" fill="{PANEL}" stroke="{LINE}" stroke-opacity="0.6" stroke-width="1.5"/>'
        f'<g transform="translate({x+20} {y+22})" stroke="{LINE}" stroke-width="1.8">{g}</g>'
        f'<rect x="{x+20}" y="{y+62}" width="110" height="8" rx="4" fill="{WHITE}" opacity="0.75"/><rect x="{x+20}" y="{y+80}" width="150" height="6" rx="3" fill="{LINE}" opacity="0.35"/>'
        for (x, y, g) in [(60, 50, G["browser"]), (300, 150, G["headset"]), (80, 260, G["cpu"])]
    )
    + trace("M260 105 H330 Q346 105 346 121 V150") + trace("M300 205 H230 Q214 205 214 221 V260")
)

for name, body in ILLOS.items():
    (OUT / f"{name}.svg").write_text(svg(body))
print(f"Wrote {len(ILLOS)} illustrations to {OUT}")
