// Arranque de la app.

import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { $, el } from './util.js';
import { db, cargar, guardarTodoYa, guardarMeta, guardarUltimo } from './store.js';
import { registrar, ir, atras, hoja, puedeSalir } from './nav.js';
import { vistaTrabajos } from './views/trabajos.js';
import { vistaTrabajo } from './views/trabajo.js';
import { vistaRecepcion } from './views/recepcion.js';
import { vistaInforme } from './views/informe.js';
import { vistaPresupuesto } from './views/presupuesto.js';
import { vistaAjustes } from './views/ajustes.js';
import { fuentesListas } from './render/canvas.js';

registrar('trabajos', vistaTrabajos);
registrar('trabajo', vistaTrabajo);
registrar('recepcion', vistaRecepcion);
registrar('informe', vistaInforme);
registrar('presupuesto', vistaPresupuesto);
registrar('ajustes', vistaAjustes);

async function arrancar() {
  await cargar();
  fuentesListas();
  document.querySelectorAll('.tabbar button').forEach((b) => b.addEventListener('click', () => {
    const tab = b.dataset.tab;
    if (!puedeSalir()) return;
    if (tab === 'recibir') { ir('trabajos', {}, { raiz: true }); ir('recepcion', {}); }
    else ir(tab, {}, { raiz: true });
  }));
  $('#back').addEventListener('click', () => atras());

  if (Capacitor.isNativePlatform()) {
    App.addListener('backButton', () => {
      const ev = new Event('mpc-back', { cancelable: true });
      document.dispatchEvent(ev);
      if (ev.defaultPrevented) return;
      if (!atras()) App.minimizeApp();
    });
    App.addListener('pause', () => { guardarTodoYa(); });
  } else {
    window.addEventListener('beforeunload', () => { guardarTodoYa(); });
  }

  ir('trabajos', {}, { raiz: true });
  document.body.classList.add('listo');
  if (db.meta.primeraVez) bienvenida();
}

function bienvenida() {
  hoja('Bienvenido a la app de Mario PC', (cerrar) => {
    const prox = el('input', { type: 'number', inputmode: 'numeric', min: '1', value: String(db.ultimo + 1), id: 'bv-prox' });
    return [
      el('p', { class: 'sheet-p', text: 'Ya cargué tus precios y ajustes del presupuestador y la recepción. Todo lo que guardes queda solo en este teléfono.' }),
      el('div', { class: 'field' }, el('label', { for: 'bv-prox', text: 'Próximo N° de orden' }), prox),
      el('p', { class: 'hint', text: 'En la recepción vas por el ' + db.ultimo + '. Si ya usaste más números, cambialo.' }),
      el('div', { class: 'stack' }, el('button', { type: 'button', class: 'btn primary', text: 'Empezar', onclick: () => {
        const n = parseInt(prox.value, 10);
        if (isFinite(n) && n > 0) guardarUltimo(n - 1);
        db.meta.primeraVez = false; guardarMeta(); cerrar();
      } })),
    ];
  }, { cerrable: false });
}

arrancar();
