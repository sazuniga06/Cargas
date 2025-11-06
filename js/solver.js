// solver.js — RK4 integrator que sigue la DIRECCIÓN del campo (estabilidad)
import { calculateField, CHARGE_RADIUS, charges } from './physics.js';

const DEFAULT_STEP = 4; // step en world units (CSS px) — ajustable
const MIN_STEP = 0.1;
const STOP_DIST = CHARGE_RADIUS * 0.6; // si llegamos a esta cercanía a una carga, detenemos

function getMaxSteps() {
  const el = document.getElementById('maxSteps');
  return el ? (parseInt(el.value, 10) || 300) : 300;
}

/* devuelve vector unitario de la dirección del campo en (wx,wy) */
function fieldDirection(wx, wy) {
  const E = calculateField(wx, wy);
  const mag = Math.hypot(E.Ex, E.Ey);
  if (!isFinite(mag) || mag === 0) return { dx: 0, dy: 0 };
  return { dx: E.Ex / mag, dy: E.Ey / mag };
}

/* RK4 integrator para dr/ds = dir(E(x)) */
function rungeKutta4(wx, wy, h) {
  // h está en world units (CSS px)
  const d1 = fieldDirection(wx, wy);
  const k1x = d1.dx * h, k1y = d1.dy * h;

  const d2 = fieldDirection(wx + k1x/2, wy + k1y/2);
  const k2x = d2.dx * h, k2y = d2.dy * h;

  const d3 = fieldDirection(wx + k2x/2, wy + k2y/2);
  const k3x = d3.dx * h, k3y = d3.dy * h;

  const d4 = fieldDirection(wx + k3x, wy + k3y);
  const k4x = d4.dx * h, k4y = d4.dy * h;

  const nx = wx + (k1x + 2*k2x + 2*k3x + k4x)/6;
  const ny = wy + (k1y + 2*k2y + 2*k3y + k4y)/6;
  return { x: nx, y: ny };
}

/* rompe si cerca de cualquier carga (en world units) */
function nearAnyCharge(wx, wy) {
  for (const c of charges) {
    if (Math.hypot(wx - c.x, wy - c.y) <= STOP_DIST) return true;
  }
  return false;
}

/* traceStreamline(startX, startY)
   startX/Y en world units (CSS px).
   devuelve array de puntos {x,y} en world units.
*/
export function traceStreamline(startX, startY) {
  const path = [];
  const canvas = document.getElementById('fieldCanvas');
  if (!canvas) return path;
  const rect = canvas.getBoundingClientRect();
  const wCss = rect.width, hCss = rect.height;

  const maxSteps = getMaxSteps();
  let cx = startX, cy = startY;
  const h = Math.max(MIN_STEP, DEFAULT_STEP);

  for (let i = 0; i < maxSteps; i++) {
    // si sale del área visible (CSS pixels)
    const sx = cx; const sy = cy;
    if (sx < -100 || sy < -100 || sx > wCss + 100 || sy > hCss + 100) break;

    // si estamos muy cerca de una carga, stop
    if (nearAnyCharge(cx, cy)) break;

    const next = rungeKutta4(cx, cy, h);

    if (!isFinite(next.x) || !isFinite(next.y)) break;

    if (Math.hypot(next.x - cx, next.y - cy) < 1e-3) break;

    path.push({ x: next.x, y: next.y });

    cx = next.x; cy = next.y;
  }

  return path;
}
