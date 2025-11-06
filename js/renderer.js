// renderer.js — dibuja en canvas; trabaja en CSS pixels (world units).
import { charges, CHARGE_RADIUS, calculateField, calculatePotential, calculateMagnitude } from './physics.js';
import { traceStreamline } from './solver.js';

const canvas = document.getElementById('fieldCanvas');
const ctx = canvas.getContext('2d', { alpha: true });

export const view = { offsetX: 0, offsetY: 0, scale: 1 }; // offset en CSS px
let dirty = true;
export function markDirty() { dirty = true; }

function resizeCanvasToDisplay() {
  const rect = canvas.getBoundingClientRect();
  const DPR = window.devicePixelRatio || 1;
  const w = Math.max(300, Math.floor(rect.width * DPR));
  const h = Math.max(200, Math.floor(rect.height * DPR));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    // deja que dibujemos en CSS px: escalamos el contexto
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    markDirty();
  }
}

/* screen/client -> world coords (world = CSS px) */
export function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  return {
    x: (localX - view.offsetX) / view.scale,
    y: (localY - view.offsetY) / view.scale
  };
}

/* world -> screen CSS pixels (no DPR) */
export function worldToScreen(wx, wy) {
  return {
    x: wx * view.scale + view.offsetX,
    y: wy * view.scale + view.offsetY
  };
}

/* helper color map (simple) */
function mapValueToColorNormalized(t) {
  // t in [0,1]
  const r = Math.round(255 * t);
  const g = Math.round(120 * (1 - t));
  const b = Math.round(255 * (1 - t));
  return `rgb(${r},${g},${b})`;
}

/* Heatmap (potential or magnitude) */
function drawColorMap(mode) {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const sample = 8; // px
  let min = Infinity, max = -Infinity;
  const values = [];
  for (let y = 0; y < h; y += sample) {
    for (let x = 0; x < w; x += sample) {
      const wx = (x - view.offsetX) / view.scale;
      const wy = (y - view.offsetY) / view.scale;
      const v = mode === 'potential' ? calculatePotential(wx, wy) : calculateMagnitude(wx, wy);
      values.push({ x, y, v });
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (!isFinite(min) || !isFinite(max)) return;
  if (mode === 'potential') {
    const m = Math.max(Math.abs(min), Math.abs(max));
    min = -m; max = m;
  }
  const range = max - min || 1;
  for (const s of values) {
    const t = (s.v - min) / range;
    ctx.fillStyle = mapValueToColorNormalized(t);
    ctx.fillRect(s.x, s.y, sample, sample);
  }
}

/* Vector field */
function drawVectorField() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  const step = 40; // px sampling
  const ARROW_BASE = 10;
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';

  for (let sy = step/2; sy < h; sy += step) {
    for (let sx = step/2; sx < w; sx += step) {
      const wx = (sx - view.offsetX) / view.scale;
      const wy = (sy - view.offsetY) / view.scale;
      const E = calculateField(wx, wy);
      const mag = Math.hypot(E.Ex, E.Ey);
      if (!isFinite(mag) || mag < 1e-2) continue;
      const ux = E.Ex / mag, uy = E.Ey / mag; // unit
      // length map (log-ish)
      const len = Math.min(step * 0.9, ARROW_BASE + Math.log10(1 + mag) * 6);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + ux*len, sy + uy*len);
      ctx.stroke();
      // arrowhead
      const ex = sx + ux*len, ey = sy + uy*len;
      const ax = -uy, ay = ux; // perp
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex - ux*6 + ax*4, ey - uy*6 + ay*4);
      ctx.lineTo(ex - ux*6 - ax*4, ey - uy*6 - ay*4);
      ctx.closePath();
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();
    }
  }
}

/* Streamlines */
function drawAllStreamlines() {
  const numSeeds = parseInt(document.getElementById('numSeeds')?.value || 30, 10);
  ctx.lineWidth = 1.5;
  for (const c of charges) {
    if (!isFinite(c.q)) continue;
    const sign = Math.sign(c.q);
    const seeds = Math.max(6, Math.round(numSeeds * Math.min(4, Math.abs(c.q*1e6)/50))); // heuristic
    const startR = CHARGE_RADIUS * 1.2;
    for (let i = 0; i < seeds; i++) {
      const ang = (2*Math.PI / seeds) * i;
      const sx = c.x + startR * Math.cos(ang);
      const sy = c.y + startR * Math.sin(ang);
      const path = traceStreamline(sx, sy);
      if (path.length < 2) continue;
      ctx.beginPath();
      const p0 = worldToScreen(path[0].x, path[0].y);
      ctx.moveTo(p0.x, p0.y);
      for (let p of path) {
        const sp = worldToScreen(p.x, p.y);
        ctx.lineTo(sp.x, sp.y);
      }
      ctx.strokeStyle = c.q > 0 ? 'rgba(220,40,40,0.9)' : 'rgba(45,120,220,0.9)';
      ctx.stroke();
    }
  }
}

/* Draw charges */
export function drawCharges() {
  for (const c of charges) {
    const s = worldToScreen(c.x, c.y);
    const size = Math.max(6, CHARGE_RADIUS * view.scale);
    ctx.beginPath();
    ctx.arc(s.x, s.y, size, 0, Math.PI*2);
    ctx.fillStyle = c.q > 0 ? '#ef5350' : '#42a5f5';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.stroke();

    // etiqueta: mostrar µC para el usuario
    ctx.fillStyle = 'white';
    ctx.font = `${10}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = Math.round(c.q * 1e6);
    ctx.fillText(`${label}µC`, s.x, s.y);
  }
}

/* Main render */
export function render(mode = 'streamlines') {
  if (!dirty) return;
  resizeCanvasToDisplay();
  const rect = canvas.getBoundingClientRect();
  const w = rect.width, h = rect.height;

  // limpiar (en CSS px)
  ctx.clearRect(0, 0, w, h);

  // heatmap
  if (mode === 'potential' || mode === 'magnitude') drawColorMap(mode);

  // streamlines
  if (mode === 'streamlines' || document.getElementById('showStreamlines')?.checked) {
    drawAllStreamlines();
  }

  // vectors
  if (document.getElementById('showVectors')?.checked) {
    drawVectorField();
  }

  // charges encima
  drawCharges();

  dirty = false;
}
