#!/usr/bin/env node
/**
 * Icon generation script — VolleyManager
 * Uses @napi-rs/canvas. Run: node scripts/generate-icons.js
 *
 * Note: icon.png and adaptive-icon.png already exist at 1024x1024.
 * Run this only to regenerate them with the canonical design.
 */
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '..', 'assets', 'images');

function drawVolleyball(ctx, cx, cy, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  const stripes = [
    { color: '#1D4ED8', startAngle: -0.4, endAngle: 0.6 },
    { color: '#E63946', startAngle: 1.2, endAngle: 2.0 },
    { color: '#1D4ED8', startAngle: 2.6, endAngle: 3.4 },
  ];
  for (const s of stripes) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, s.startAngle, s.endAngle);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.globalAlpha = alpha * 0.75;
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = r * 0.04;
  ctx.globalAlpha = alpha;
  ctx.stroke();

  ctx.restore();
}

function drawCourt(ctx, x, y, w, h) {
  ctx.save();
  const rx = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, rx);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Net (centre line)
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient #0D1117 → #1D4ED8 at 30% opacity
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0D1117');
  grad.addColorStop(1, 'rgba(29,78,216,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Court — centered lower-left area
  const courtX = size * 0.08;
  const courtY = size * 0.25;
  const courtW = size * 0.52;
  const courtH = size * 0.50;
  drawCourt(ctx, courtX, courtY, courtW, courtH);

  // Ball trail (3 decreasing ghost circles)
  const ballR = size * 0.18;
  const ballCX = size * 0.72;
  const ballCY = size * 0.30;
  drawVolleyball(ctx, ballCX - ballR * 1.4, ballCY + ballR * 1.0, ballR * 0.55, 0.1);
  drawVolleyball(ctx, ballCX - ballR * 0.8, ballCY + ballR * 0.45, ballR * 0.75, 0.2);
  drawVolleyball(ctx, ballCX, ballCY, ballR, 1);

  // "VM" label
  ctx.save();
  const fs = size * 0.13;
  ctx.font = `900 ${fs}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('VM', size / 2, size * 0.96);
  ctx.restore();

  return canvas;
}

function generateSplashIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  const r = size * 0.44;
  drawVolleyball(ctx, size / 2, size / 2, r);

  return canvas;
}

function generateAdaptiveIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);

  // Safe zone: 66% of size
  const safeR = size * 0.33;
  const cx = size / 2;
  const cy = size / 2;

  drawVolleyball(ctx, cx, cy, safeR);

  return canvas;
}

function generateFavicon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0D1117');
  grad.addColorStop(1, '#1D4ED8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  drawVolleyball(ctx, size / 2, size * 0.42, size * 0.32);
  return canvas;
}

function save(canvas, filePath) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filePath, buf);
  console.log(`✓ ${path.basename(filePath)} (${canvas.width}×${canvas.height})`);
}

console.log('Generating VolleyManager icons...');
save(generateIcon(1024), path.join(ASSETS, 'icon.png'));
save(generateAdaptiveIcon(1024), path.join(ASSETS, 'adaptive-icon.png'));
save(generateFavicon(48), path.join(ASSETS, 'favicon.png'));
save(generateSplashIcon(288), path.join(ASSETS, 'splash-icon.png'));
console.log('Done.');
