#!/usr/bin/env node
/**
 * Play Store asset generator — VolleyManager
 * Generates: feature-graphic.png (1024×500) + 4 screenshots (1080×1920)
 * Run: node scripts/generate-store-assets.js
 */
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'store-assets');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const DARK = '#0D1117';
const SURFACE = '#161B22';
const RED = '#E63946';
const BLUE = '#1D4ED8';
const MUTED = '#8B949E';
const WHITE = '#F0F6FC';
const ELEVATED = '#21262D';

// ── Shared drawing helpers ────────────────────────────────────────────────────

function fillBg(ctx, w, h, color1 = DARK, color2 = BLUE) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2 + '55');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

function text(ctx, str, x, y, size, color, weight = '400', align = 'center', baseline = 'middle') {
  ctx.font = `${weight} ${size}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(str, x, y);
}

function drawBall(ctx, cx, cy, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = WHITE;
  ctx.fill();
  const stripes = [
    { color: BLUE, s: -0.4, e: 0.6 },
    { color: RED, s: 1.2, e: 2.0 },
    { color: BLUE, s: 2.6, e: 3.4 },
  ];
  for (const s of stripes) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s.s, s.e);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.globalAlpha = alpha * 0.7;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = r * 0.04;
  ctx.globalAlpha = alpha;
  ctx.stroke();
  ctx.restore();
}

function footer(ctx, w, h, label = 'SyllDevLearning') {
  text(ctx, label, w / 2, h - 36, 22, MUTED, '400');
}

function save(canvas, name) {
  const buf = canvas.toBuffer('image/png');
  const fp = path.join(OUT, name);
  fs.writeFileSync(fp, buf);
  console.log(`✓ ${name} (${canvas.width}×${canvas.height})`);
}

// ── Feature graphic 1024×500 ─────────────────────────────────────────────────

function featureGraphic() {
  const W = 1024, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  fillBg(ctx, W, H, DARK, BLUE);

  // Ball + trail on the left
  const bx = 200, by = 250, br = 120;
  drawBall(ctx, bx - br * 1.5, by + br * 0.8, br * 0.55, 0.1);
  drawBall(ctx, bx - br * 0.7, by + br * 0.35, br * 0.75, 0.2);
  drawBall(ctx, bx, by, br);

  // Title + subtitle on the right
  text(ctx, 'VolleyManager', W * 0.57, H * 0.38, 64, WHITE, '900');
  text(ctx, 'Arbitrage  •  Tactique  •  Stats', W * 0.57, H * 0.60, 28, MUTED, '400');

  return canvas;
}

// ── Screenshot helpers ────────────────────────────────────────────────────────

function screenshotBase(title, subtitle) {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  fillBg(ctx, W, H, DARK, '#0D1117');

  // Status bar area
  roundRect(ctx, 0, 0, W, 80, 0, SURFACE, null);

  // Title block
  text(ctx, title, W / 2, 220, 72, WHITE, '900');
  text(ctx, subtitle, W / 2, 310, 36, MUTED, '400');

  return { canvas, ctx, W, H };
}

// ── Screenshot 1 — Scoring ────────────────────────────────────────────────────

function screenshot1() {
  const { canvas, ctx, W, H } = screenshotBase('Scoring intuitif', 'Arbitrez d\'un seul doigt');

  const btnW = 380, btnH = 400, btnY = 480, gap = 40;
  const leftX = W / 2 - btnW - gap / 2;
  const rightX = W / 2 + gap / 2;

  // Home score button (blue)
  roundRect(ctx, leftX, btnY, btnW, btnH, 24, BLUE, null);
  text(ctx, 'France', leftX + btnW / 2, btnY + 80, 36, WHITE, '600');
  text(ctx, '25', leftX + btnW / 2, btnY + btnH / 2 + 20, 140, WHITE, '900');

  // Away score button (red)
  roundRect(ctx, rightX, btnY, btnW, btnH, 24, RED, null);
  text(ctx, 'Brésil', rightX + btnW / 2, btnY + 80, 36, WHITE, '600');
  text(ctx, '23', rightX + btnW / 2, btnY + btnH / 2 + 20, 140, WHITE, '900');

  // Sets label
  text(ctx, '2 — 1  SETS', W / 2, btnY + btnH + 80, 40, MUTED, '700');

  // Undo + timeout row
  const rowY = btnY + btnH + 180;
  roundRect(ctx, leftX, rowY, btnW, 100, 16, ELEVATED, null);
  text(ctx, '↩  Annuler', leftX + btnW / 2, rowY + 50, 32, WHITE, '500');
  roundRect(ctx, rightX, rowY, btnW, 100, 16, ELEVATED, null);
  text(ctx, '⏱  Temps mort', rightX + btnW / 2, rowY + 50, 32, WHITE, '500');

  footer(ctx, W, H);
  return canvas;
}

// ── Screenshot 2 — Tactical ───────────────────────────────────────────────────

function screenshot2() {
  const { canvas, ctx, W, H } = screenshotBase('Tableau tactique', 'Dessinez vos combinaisons');

  const courtX = 100, courtY = 420, courtW = W - 200, courtH = 800;
  roundRect(ctx, courtX, courtY, courtW, courtH, 12, '#1A3D1A', 'rgba(255,255,255,0.2)');

  // Net
  ctx.beginPath();
  ctx.moveTo(courtX, courtY + courtH / 2);
  ctx.lineTo(courtX + courtW, courtY + courtH / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Player tokens (6 home, 6 away)
  const homePositions = [
    [0.2, 0.25], [0.5, 0.25], [0.8, 0.25],
    [0.2, 0.45], [0.5, 0.45], [0.8, 0.45],
  ];
  const awayPositions = [
    [0.2, 0.60], [0.5, 0.60], [0.8, 0.60],
    [0.2, 0.80], [0.5, 0.80], [0.8, 0.80],
  ];

  function playerDot(rx, ry, color, num) {
    const px = courtX + rx * courtW;
    const py = courtY + ry * courtH;
    ctx.beginPath();
    ctx.arc(px, py, 30, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    text(ctx, String(num), px, py, 26, WHITE, '700');
  }

  homePositions.forEach(([rx, ry], i) => playerDot(rx, ry, BLUE, i + 1));
  awayPositions.forEach(([rx, ry], i) => playerDot(rx, ry, RED, i + 1));

  // Arrows (3 colored)
  const arrows = [
    { from: [0.2, 0.25], to: [0.5, 0.45], color: RED },
    { from: [0.5, 0.25], to: [0.8, 0.25], color: '#2EA043' },
    { from: [0.8, 0.25], to: [0.5, 0.25], color: '#F59E0B' },
  ];
  for (const a of arrows) {
    const fx = courtX + a.from[0] * courtW;
    const fy = courtY + a.from[1] * courtH;
    const tx = courtX + a.to[0] * courtW;
    const ty = courtY + a.to[1] * courtH;
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(tx, ty);
    ctx.strokeStyle = a.color;
    ctx.lineWidth = 5;
    ctx.stroke();
  }

  footer(ctx, W, H);
  return canvas;
}

// ── Screenshot 3 — Stats ──────────────────────────────────────────────────────

function screenshot3() {
  const { canvas, ctx, W, H } = screenshotBase('Statistiques détaillées', 'Analysez chaque joueur');

  // Radar hexagon
  const cx = W / 2, cy = 900, radarR = 260;
  const labels = ['Service', 'Attaque', 'Block', 'Réception', 'Défense', 'Passe'];
  const values = [0.8, 0.9, 0.6, 0.75, 0.7, 0.85];
  const N = labels.length;

  // Background rings
  for (let ring = 1; ring <= 4; ring++) {
    const r = (ring / 4) * radarR;
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = ELEVATED;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Data polygon
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const r = values[i] * radarR;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = BLUE + '55';
  ctx.fill();
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Labels
  for (let i = 0; i < N; i++) {
    const angle = (Math.PI * 2 * i) / N - Math.PI / 2;
    const lx = cx + (radarR + 40) * Math.cos(angle);
    const ly = cy + (radarR + 40) * Math.sin(angle);
    text(ctx, labels[i], lx, ly, 24, MUTED, '500');
  }

  // Bar chart
  const bars = [
    { label: 'Service', v: 0.80 },
    { label: 'Attaque', v: 0.90 },
    { label: 'Block', v: 0.60 },
    { label: 'Réception', v: 0.75 },
  ];
  const barStartY = 1300;
  const barH = 44;
  const barMaxW = W - 300;
  bars.forEach((b, i) => {
    const by = barStartY + i * 100;
    text(ctx, b.label, 160, by + barH / 2, 28, MUTED, '500', 'right');
    roundRect(ctx, 180, by, barMaxW, barH, 8, ELEVATED, null);
    roundRect(ctx, 180, by, barMaxW * b.v, barH, 8, BLUE, null);
    text(ctx, `${Math.round(b.v * 100)}%`, 180 + barMaxW + 20, by + barH / 2, 26, MUTED, '600', 'left');
  });

  footer(ctx, W, H);
  return canvas;
}

// ── Screenshot 4 — Teams ──────────────────────────────────────────────────────

function screenshot4() {
  const { canvas, ctx, W, H } = screenshotBase('Gestion d\'équipe', 'France vs Brésil en un tap');

  const cardW = W - 120, cardX = 60;

  function teamCard(yTop, teamColor, teamName, players) {
    roundRect(ctx, cardX, yTop, cardW, 380, 20, SURFACE, 'rgba(255,255,255,0.06)');

    // Color stripe
    roundRect(ctx, cardX, yTop, 8, 380, [20, 0, 0, 20], teamColor, null);

    // Team name
    text(ctx, teamName, cardX + 60, yTop + 80, 48, WHITE, '700', 'left');

    // Players
    players.forEach((p, i) => {
      const py = yTop + 160 + i * 60;
      roundRect(ctx, cardX + 40, py, cardW - 80, 50, 8, ELEVATED, null);
      text(ctx, `#${p.num}  ${p.name}`, cardX + 80, py + 25, 26, WHITE, '500', 'left');
    });
  }

  teamCard(420, BLUE, 'France', [
    { num: 1, name: 'Ngapeth' },
    { num: 4, name: 'Tillie' },
    { num: 11, name: 'Brizard' },
  ]);

  teamCard(860, '#F59E0B', 'Brésil', [
    { num: 11, name: 'Lucarelli' },
    { num: 19, name: 'Flavio' },
    { num: 16, name: 'Alan' },
  ]);

  footer(ctx, W, H);
  return canvas;
}

// ── Run ───────────────────────────────────────────────────────────────────────

console.log('Generating Play Store assets...');
save(featureGraphic(), 'feature-graphic.png');
save(screenshot1(), 'screenshot-1-scoring.png');
save(screenshot2(), 'screenshot-2-tactical.png');
save(screenshot3(), 'screenshot-3-stats.png');
save(screenshot4(), 'screenshot-4-teams.png');
console.log(`\nAll assets saved to store-assets/`);
