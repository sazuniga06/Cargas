// main.js — arranque
import { render, view } from './renderer.js';
import { setupUI, updateChargeList } from './ui.js';
import { addCharge } from './physics.js';

window.rendererView = view; // alias si lo necesitas desde consola

function appRender() {
  const mode = document.getElementById('visualizationMode')?.value || 'streamlines';
  render(mode);
}

function init() {
  // UI
  setupUI(appRender);

  // ejemplo: dipolo inicial (valores en µC)
  addCharge(250, 300, 50);   // 50 µC
  addCharge(550, 300, -50);  // -50 µC

  // actualiza lista y dibuja
  updateChargeList(appRender);
  appRender();

  // loop rAF (render bajo dirty flag)
  function loop() {
    render(document.getElementById('visualizationMode')?.value || 'streamlines');
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

window.addEventListener('load', init);
