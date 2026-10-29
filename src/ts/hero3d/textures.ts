/**
 * Procedural canvas textures for the ecosystem scene. Everything is drawn at
 * modest sizes (max 768px) so the scene downloads no images at all.
 * UI screens use abstract bars instead of fake copy.
 */
import { CanvasTexture, SRGBColorSpace, Texture } from "three";

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!];
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function finish(c: HTMLCanvasElement, anisotropy = 1): Texture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}

/** A light-theme business website, as shown on the laptop. */
export function websiteTexture(): Texture {
  const [c, x] = canvas(768, 480);
  x.fillStyle = "#F6F8FC";
  x.fillRect(0, 0, 768, 480);
  // header
  x.fillStyle = "#FFFFFF";
  x.fillRect(0, 0, 768, 54);
  rr(x, 28, 16, 22, 22, 6, "#2563EB");
  rr(x, 58, 22, 70, 10, 5, "#0B1730");
  [380, 446, 512, 578].forEach((px) => rr(x, px, 23, 48, 8, 4, "#94A3B8"));
  rr(x, 650, 14, 90, 26, 7, "#2563EB");
  // hero
  const g = x.createLinearGradient(0, 54, 768, 270);
  g.addColorStop(0, "#071226");
  g.addColorStop(1, "#13306E");
  x.fillStyle = g;
  x.fillRect(0, 54, 768, 218);
  rr(x, 40, 96, 300, 22, 8, "#FFFFFF");
  rr(x, 40, 128, 240, 22, 8, "#FFFFFF");
  rr(x, 40, 166, 280, 9, 4, "rgba(219,230,254,.7)");
  rr(x, 40, 182, 240, 9, 4, "rgba(219,230,254,.7)");
  rr(x, 40, 210, 112, 34, 8, "#FFFFFF");
  rr(x, 162, 210, 112, 34, 8, "rgba(255,255,255,.14)");
  // hero image block
  const g2 = x.createLinearGradient(430, 80, 730, 250);
  g2.addColorStop(0, "#3B82F6");
  g2.addColorStop(1, "#7DD3FC");
  rr(x, 430, 82, 300, 166, 14, "rgba(59,130,246,.25)");
  x.fillStyle = g2;
  x.beginPath();
  x.arc(600, 165, 54, 0, Math.PI * 2);
  x.fill();
  rr(x, 452, 102, 110, 12, 6, "rgba(255,255,255,.75)");
  rr(x, 452, 122, 80, 8, 4, "rgba(255,255,255,.45)");
  // cards
  for (let i = 0; i < 3; i++) {
    const cx = 40 + i * 236;
    rr(x, cx, 300, 216, 150, 12, "#FFFFFF");
    rr(x, cx + 18, 318, 34, 34, 9, i === 1 ? "#0B1730" : "#2563EB");
    rr(x, cx + 18, 366, 130, 11, 5, "#0B1730");
    rr(x, cx + 18, 388, 170, 8, 4, "#CBD5E1");
    rr(x, cx + 18, 404, 150, 8, 4, "#CBD5E1");
    rr(x, cx + 18, 424, 64, 9, 4, "#2563EB");
  }
  return finish(c, 4);
}

/** A remote-support session on a dark desktop, as shown on the monitor. */
export function remoteTexture(): Texture {
  const [c, x] = canvas(768, 456);
  const g = x.createLinearGradient(0, 0, 768, 456);
  g.addColorStop(0, "#0B1730");
  g.addColorStop(1, "#13213F");
  x.fillStyle = g;
  x.fillRect(0, 0, 768, 456);
  // background grid
  x.strokeStyle = "rgba(147,180,253,.08)";
  x.lineWidth = 1;
  for (let i = 0; i < 768; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 456); x.stroke(); }
  for (let j = 0; j < 456; j += 32) { x.beginPath(); x.moveTo(0, j); x.lineTo(768, j); x.stroke(); }
  // session window
  rr(x, 60, 46, 430, 330, 14, "#F6F8FC");
  rr(x, 60, 46, 430, 40, 14, "#E2E8F0");
  x.fillStyle = "#E2E8F0";
  x.fillRect(60, 70, 430, 16);
  ["#F87171", "#FBBF24", "#34D399"].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(84 + i * 18, 66, 5, 0, Math.PI * 2); x.fill(); });
  // settings rows + progress
  for (let i = 0; i < 5; i++) {
    rr(x, 86, 108 + i * 42, 22, 22, 6, i === 2 ? "#2563EB" : "#CBD5E1");
    rr(x, 120, 112 + i * 42, 150 + (i % 2) * 60, 9, 4, "#334155");
    rr(x, 120, 126 + i * 42, 110, 7, 3, "#94A3B8");
    rr(x, 410, 112 + i * 42, 52, 18, 9, i === 2 ? "#2563EB" : "#CBD5E1");
  }
  rr(x, 86, 330, 380, 10, 5, "#E2E8F0");
  rr(x, 86, 330, 260, 10, 5, "#2563EB");
  // chat panel
  rr(x, 520, 46, 200, 330, 14, "rgba(7,18,38,.85)");
  x.fillStyle = "#34D399";
  x.beginPath(); x.arc(542, 70, 6, 0, Math.PI * 2); x.fill();
  rr(x, 556, 64, 90, 10, 5, "rgba(255,255,255,.85)");
  rr(x, 536, 104, 150, 34, 10, "rgba(59,130,246,.35)");
  rr(x, 554, 150, 150, 34, 10, "#2563EB");
  rr(x, 536, 196, 130, 34, 10, "rgba(59,130,246,.35)");
  rr(x, 536, 330, 168, 30, 10, "rgba(255,255,255,.1)");
  // cursor
  x.fillStyle = "#FFFFFF";
  x.beginPath(); x.moveTo(330, 236); x.lineTo(330, 270); x.lineTo(340, 261); x.lineTo(348, 278); x.lineTo(354, 275); x.lineTo(346, 258); x.lineTo(359, 258); x.closePath(); x.fill();
  // taskbar
  x.fillStyle = "rgba(7,18,38,.9)";
  x.fillRect(0, 420, 768, 36);
  [24, 60, 96, 132].forEach((px, i) => rr(x, px, 428, 22, 20, 5, i === 0 ? "#2563EB" : "rgba(147,180,253,.4)"));
  return finish(c, 4);
}

/** Navy circuit board with traces, pads, and a CPU socket. */
export function pcbTexture(): Texture {
  const [c, x] = canvas(512, 352);
  x.fillStyle = "#0E1C3A";
  x.fillRect(0, 0, 512, 352);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  x.lineCap = "round";
  for (let i = 0; i < 46; i++) {
    x.strokeStyle = `rgba(59,130,246,${0.25 + rand() * 0.35})`;
    x.lineWidth = 1.5 + rand() * 1.5;
    let px = rand() * 512, py = rand() * 352;
    x.beginPath(); x.moveTo(px, py);
    for (let s = 0; s < 3; s++) {
      if (s % 2 === 0) px += (rand() - 0.5) * 220; else py += (rand() - 0.5) * 160;
      x.lineTo(px, py);
    }
    x.stroke();
    x.fillStyle = "rgba(147,180,253,.7)";
    x.fillRect(px - 2.5, py - 2.5, 5, 5);
  }
  // socket outline + slots
  x.strokeStyle = "rgba(219,230,254,.55)";
  x.lineWidth = 3;
  x.strokeRect(120, 110, 120, 120);
  x.strokeStyle = "rgba(147,180,253,.35)";
  for (let i = 0; i < 2; i++) x.strokeRect(300 + i * 26, 40, 12, 270);
  x.strokeRect(180, 300, 150, 24);
  return finish(c, 2);
}

/** Memory chips for RAM sticks and the SSD (chip blocks on a blue PCB). */
export function chipTexture(chips: number, w = 256, h = 64): Texture {
  const [c, x] = canvas(w, h);
  x.fillStyle = "#16316B";
  x.fillRect(0, 0, w, h);
  const cw = (w - 20) / chips;
  for (let i = 0; i < chips; i++) rr(x, 10 + i * cw + 3, h * 0.2, cw - 6, h * 0.55, 3, "#0A0F1E");
  x.fillStyle = "#D9A21B";
  for (let i = 0; i < w; i += 6) x.fillRect(i, h - 6, 3, 6);
  return finish(c, 2);
}

/** Dark keyboard deck. */
export function keyboardTexture(): Texture {
  const [c, x] = canvas(512, 200);
  x.fillStyle = "#1A2740";
  x.fillRect(0, 0, 512, 200);
  for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) rr(x, 10 + k * 35.5, 10 + r * 36, 30, 30, 5, "#0D1628");
  return finish(c);
}

/** Fan grille for the power supply. */
export function grilleTexture(): Texture {
  const [c, x] = canvas(256, 256);
  x.fillStyle = "#121D33";
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = "rgba(147,180,253,.55)";
  x.lineWidth = 4;
  for (let r = 24; r < 120; r += 18) { x.beginPath(); x.arc(128, 128, r, 0, Math.PI * 2); x.stroke(); }
  x.beginPath(); x.moveTo(128, 8); x.lineTo(128, 248); x.moveTo(8, 128); x.lineTo(248, 128); x.stroke();
  return finish(c);
}

/** Small floating UI card (glass panel) beside the laptop. */
export function cardTexture(variant: number): Texture {
  const [c, x] = canvas(256, 168);
  rr(x, 0, 0, 256, 168, 18, "rgba(19,33,63,.92)");
  x.strokeStyle = "rgba(147,180,253,.6)";
  x.lineWidth = 2;
  x.strokeRect(1, 1, 254, 166);
  if (variant === 0) {
    rr(x, 20, 22, 120, 12, 6, "rgba(255,255,255,.85)");
    x.strokeStyle = "#7DD3FC"; x.lineWidth = 4; x.beginPath();
    [[20, 130], [70, 100], [110, 112], [160, 70], [236, 52]].forEach(([px, py], i) => (i ? x.lineTo(px, py) : x.moveTo(px, py)));
    x.stroke();
  } else {
    rr(x, 20, 22, 40, 40, 10, "#2563EB");
    rr(x, 74, 26, 140, 12, 6, "rgba(255,255,255,.85)");
    rr(x, 74, 46, 100, 9, 4, "rgba(147,180,253,.6)");
    rr(x, 20, 90, 216, 10, 5, "rgba(147,180,253,.35)");
    rr(x, 20, 110, 170, 10, 5, "rgba(147,180,253,.35)");
    rr(x, 20, 134, 80, 18, 9, "#2563EB");
  }
  return finish(c);
}

/** Soft radial glow used for bloom-like highlights (additive sprites). */
export function glowTexture(): Texture {
  const [c, x] = canvas(128, 128);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return finish(c);
}
