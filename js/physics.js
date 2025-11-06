// physics.js — física real, posiciones en world units (CSS px). q en Coulombs internamente.
export const K = 8.9875517923e9;      // 1/(4πϵ0) N·m²/C²
export const METERS_PER_WORLD = 0.01; // 1 world unit (CSS px) = 0.01 m (ajusta si quieres)
export const CHARGE_RADIUS = 10;      // visual radius (world units / CSS px)

export let charges = [];
let nextId = 0;

/* helper lectura control */
function getControlValue(id, fallback = null) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
  return el.value;
}

/* epsilon (suavizado) en metros: toma slider en world units -> convierte a metros */
function getEpsilonMeters() {
  const epsWorld = getControlValue('epsilon', 10) || 10;
  return Math.max(1e-9, epsWorld * METERS_PER_WORLD);
}

/* Convenciones:
   - Entradas y outputs de estas funciones usan COORDENADAS EN WORLD UNITS (CSS px).
   - Dentro, convertimos a metros para cálculos físicos.
*/

/* campo eléctrico (Ex, Ey) en N/C */
export function calculateField(wx, wy) {
  const eps_m = getEpsilonMeters();
  const x_m = wx * METERS_PER_WORLD;
  const y_m = wy * METERS_PER_WORLD;

  let Ex = 0, Ey = 0;

  for (const c of charges) {
    const cx_m = c.x * METERS_PER_WORLD;
    const cy_m = c.y * METERS_PER_WORLD;
    const q = c.q; // already in Coulombs

    const dx = x_m - cx_m;
    const dy = y_m - cy_m;
    const r2 = dx*dx + dy*dy;
    const r2_eps = r2 + eps_m*eps_m;
    const r = Math.sqrt(r2_eps);
    const r3 = r2_eps * r;

    // guard: si demasiado pequeño, saltamos (con suavizado no debería ser 0)
    if (r3 === 0) continue;

    const factor = K * q / r3; // N·m²/C² * C / m^3 = N/C / m^0 -> consistent
    Ex += factor * dx;
    Ey += factor * dy;
  }

  return { Ex, Ey };
}

/* magnitud de E en N/C */
export function calculateMagnitude(wx, wy) {
  const E = calculateField(wx, wy);
  return Math.hypot(E.Ex, E.Ey);
}

/* potencial en V */
export function calculatePotential(wx, wy) {
  const eps_m = getEpsilonMeters();
  const x_m = wx * METERS_PER_WORLD;
  const y_m = wy * METERS_PER_WORLD;
  let V = 0;
  for (const c of charges) {
    const cx_m = c.x * METERS_PER_WORLD;
    const cy_m = c.y * METERS_PER_WORLD;
    const q = c.q;
    const dx = x_m - cx_m;
    const dy = y_m - cy_m;
    const r = Math.sqrt(dx*dx + dy*dy + eps_m*eps_m);
    V += K * q / r;
  }
  return V;
}

/* Gestión de cargas
   addCharge(x,y,q_uC) -> q en microcoulombs desde UI; internamente se guarda en Coulombs.
*/
export function addCharge(x, y, q_uC) {
  const qC = parseFloat(q_uC) * 1e-6; // µC -> C
  charges.push({ x: +x, y: +y, q: qC, id: nextId++ });
}

export function removeCharge(index) {
  if (index >= 0 && index < charges.length) charges.splice(index, 1);
}

export function clearCharges() {
  charges = [];
  nextId = 0;
}

export function setCharges(newCharges = []) {
  // acepta lista de {x,y,q} donde q puede estar en µC (asumimos µC)
  charges = newCharges.map((c, i) => ({
    x: +c.x,
    y: +c.y,
    q: (typeof c.q === 'number' ? c.q * 1e-6 : parseFloat(c.q) * 1e-6) || 0,
    id: (c.id ?? i)
  }));
  nextId = charges.reduce((m, c) => Math.max(m, c.id ?? -1), -1) + 1;
}
