// ui.js — bindings UI, selección/drag/pan, lista de cargas
import { addCharge, charges, removeCharge, setCharges, clearCharges, CHARGE_RADIUS } from './physics.js';
import { screenToWorld, worldToScreen, markDirty, view } from './renderer.js';

const canvas = document.getElementById('fieldCanvas');
const statusEl = document.getElementById('status');
let tool = 'select';
let dragged = null;
let dragOffset = { x: 0, y: 0 };

let isPanning = false;
let panStart = null;

const undoStack = [];
const redoStack = [];
function pushUndo() { undoStack.push(JSON.stringify(charges)); if (undoStack.length > 60) undoStack.shift(); }

function setActiveToolBtn(t) {
  document.querySelectorAll('.md-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.fab').forEach(f => f.classList.remove('active'));
  const map = { add:'toolAdd', select:'toolSelect', delete:'toolDelete' };
  const fabMap = { add:'fabAdd', select:'fabSelect', delete:'fabDelete' };
  document.getElementById(map[t])?.classList.add('active');
  document.getElementById(fabMap[t])?.classList.add('active');
  if (statusEl) statusEl.textContent = t==='add'?'Modo: añadir':t==='select'?'Modo: seleccionar':'Modo: eliminar';
}

function findChargeAtWorld(x, y) {
  return charges.findIndex(c => Math.hypot(x - c.x, y - c.y) <= CHARGE_RADIUS * 1.2);
}

export function setupUI(renderCallback) {
  // buttons
  document.getElementById('toolAdd')?.addEventListener('click', ()=>{ tool='add'; setActiveToolBtn(tool); });
  document.getElementById('toolSelect')?.addEventListener('click', ()=>{ tool='select'; setActiveToolBtn(tool); });
  document.getElementById('toolDelete')?.addEventListener('click', ()=>{ tool='delete'; setActiveToolBtn(tool); });

  ['fabAdd','fabSelect','fabDelete'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', ()=> {
      const t = id === 'fabAdd' ? 'add' : id === 'fabSelect' ? 'select' : 'delete';
      tool = t; setActiveToolBtn(tool);
      renderCallback();
    });
  });

  // scene actions
  document.getElementById('saveBtn')?.addEventListener('click', ()=> {
    localStorage.setItem('electricFieldConfig_v2', JSON.stringify(charges.map(c=>({x:c.x,y:c.y,q:c.q*1e6,id:c.id}))));
    alert('Guardado local OK.');
  });
  document.getElementById('loadBtn')?.addEventListener('click', ()=> {
    const raw = localStorage.getItem('electricFieldConfig_v2');
    if (!raw) { alert('No hay configuración guardada.'); return; }
    try {
      pushUndo();
      const parsed = JSON.parse(raw);
      setCharges(parsed);
      markDirty(); renderCallback(); updateChargeList(renderCallback);
      alert('Cargado OK.');
    } catch(e) { alert('JSON inválido.'); }
  });
  document.getElementById('clearBtn')?.addEventListener('click', ()=> {
    if (!confirm('Eliminar todas las cargas?')) return;
    pushUndo(); clearCharges(); markDirty(); renderCallback(); updateChargeList(renderCallback);
  });
  document.getElementById('exportPNG')?.addEventListener('click', ()=> {
    const a = document.createElement('a');
    a.download = 'campo_electrico.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  });

  // ranges labels
  [['numSeeds','numSeedsLabel'],['epsilon','epsilonLabel'],['maxSteps','maxStepsLabel']].forEach(([rid,lid])=>{
    const r = document.getElementById(rid), l = document.getElementById(lid);
    if (r && l) r.addEventListener('input', ()=> { l.textContent = r.value; markDirty(); renderCallback(); });
  });

  // keyboard
  window.addEventListener('keydown', (e)=> {
    if (e.key === 'a' || e.key === 'A') { tool='add'; setActiveToolBtn(tool); renderCallback(); }
    if (e.key === 's' || e.key === 'S') { tool='select'; setActiveToolBtn(tool); renderCallback(); }
    if (e.key === 'd' || e.key === 'D') { tool='delete'; setActiveToolBtn(tool); renderCallback(); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      if (undoStack.length === 0) return;
      const st = undoStack.pop();
      redoStack.push(JSON.stringify(charges));
      setCharges(JSON.parse(st));
      markDirty(); renderCallback(); updateChargeList(renderCallback);
    }
  });

  // canvas mouse
  canvas.addEventListener('mousedown', (ev) => {
    const p = screenToWorld(ev.clientX, ev.clientY);
    // pan with middle button or ctrl+left
    if (ev.button === 1 || (ev.button === 0 && ev.ctrlKey)) {
      isPanning = true;
      const rect = canvas.getBoundingClientRect();
      panStart = { sx: ev.clientX - rect.left, sy: ev.clientY - rect.top, startOffsetX: view.offsetX, startOffsetY: view.offsetY };
      canvas.classList.add('dragging');
      return;
    }

    if (tool === 'add') {
      const qVal = parseFloat(document.getElementById('chargeValue')?.value || 50);
      const sign = document.querySelector('input[name="chargeSign"]:checked')?.value || 'pos';
      const q = sign === 'neg' ? -Math.abs(qVal) : Math.abs(qVal);
      pushUndo();
      addCharge(p.x, p.y, q);
      markDirty(); renderCallback(); updateChargeList(renderCallback);
      return;
    }

    const idx = findChargeAtWorld(p.x, p.y);
    if (idx !== -1) {
      if (tool === 'delete') {
        pushUndo(); removeCharge(idx); markDirty(); renderCallback(); updateChargeList(renderCallback);
        return;
      }
      // start drag (select)
      dragged = charges[idx];
      dragOffset = { x: p.x - dragged.x, y: p.y - dragged.y };
      pushUndo();
      markDirty(); renderCallback(); updateChargeList(renderCallback);
    } else {
      // deselect
      dragged = null;
      markDirty(); renderCallback(); updateChargeList(renderCallback);
    }
  });

  window.addEventListener('mousemove', (ev) => {
    const p = screenToWorld(ev.clientX, ev.clientY);
    // panning
    if (isPanning && panStart) {
      const rect = canvas.getBoundingClientRect();
      const localX = ev.clientX - rect.left, localY = ev.clientY - rect.top;
      view.offsetX = panStart.startOffsetX + (localX - panStart.sx);
      view.offsetY = panStart.startOffsetY + (localY - panStart.sy);
      markDirty(); renderCallback();
      return;
    }
    // dragging charge
    if (dragged) {
      dragged.x = p.x - dragOffset.x;
      dragged.y = p.y - dragOffset.y;
      markDirty(); renderCallback();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; panStart = null; canvas.classList.remove('dragging'); }
    if (dragged) { dragged = null; updateChargeList(renderCallback); }
  });

  // wheel zoom (anchor at mouse)
  canvas.addEventListener('wheel', (ev) => {
    if (ev.ctrlKey || ev.metaKey) return;
    ev.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const factor = Math.exp(-ev.deltaY * 0.0015);
    const prev = view.scale;
    const next = Math.max(0.2, Math.min(6, prev * factor));
    view.scale = next;
    // keep mouse position stable: newOffset = mx - (mx - offset)*new/old
    view.offsetX = mx - (mx - view.offsetX) * (next / prev);
    view.offsetY = my - (my - view.offsetY) * (next / prev);
    markDirty(); renderCallback();
  }, { passive: false });

  setActiveToolBtn('select');
  renderCallback();
  updateChargeList(renderCallback);
}

/* charge list rendering (busca id o clase) */
export function updateChargeList(renderCallback) {
  const container = document.getElementById('chargeList') || document.querySelector('.charge-list');
  if (!container) return;
  container.innerHTML = '';
  if (!charges || charges.length === 0) {
    container.innerHTML = '<div class="muted">No hay cargas — usa "Añadir" o haz clic en el canvas.</div>';
    return;
  }
  charges.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'charge-item';
    el.innerHTML = `
      <div class="meta">ID ${c.id} • (${Math.round(c.x)}, ${Math.round(c.y)})</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="number" value="${Math.round(c.q*1e6)}" style="width:84px" data-index="${i}" />
        <button class="md-btn md-btn--outline" data-remove="${i}">X</button>
      </div>`;
    container.appendChild(el);
  });

  container.querySelectorAll('input[type="number"]').forEach(inp => {
    inp.addEventListener('input', (e) => {
      const idx = parseInt(e.target.getAttribute('data-index'), 10);
      if (Number.isFinite(idx) && charges[idx]) {
        charges[idx].q = parseFloat(e.target.value) * 1e-6; // µC -> C
        markDirty(); renderCallback();
      }
    });
  });

  container.querySelectorAll('button[data-remove]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.getAttribute('data-remove'), 10);
      if (Number.isFinite(idx) && charges[idx]) {
        pushUndo(); removeCharge(idx); markDirty(); renderCallback(); updateChargeList(renderCallback);
      }
    });
  });
}
