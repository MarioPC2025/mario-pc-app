// Navegación entre pantallas, con el botón "atrás" de Android.

import { $, el } from './util.js';

const vistas = {};
const pila = [];
let actual = null; // {nombre, params, limpiar, tab}

export function registrar(nombre, def) { vistas[nombre] = def; }

function pintar(entrada) {
  if (actual && actual.limpiar) { try { actual.limpiar(); } catch (e) {} }
  const def = vistas[entrada.nombre];
  const main = $('#view');
  main.replaceChildren();
  main.scrollTop = 0; window.scrollTo(0, 0);
  setTitulo('', '');
  setAcciones([]);
  $('#back').hidden = pila.length === 0;
  const tab = typeof def.tab === 'function' ? def.tab(entrada.params || {}) : (def.tab || entrada.nombre);
  document.querySelectorAll('.tabbar button').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
  document.body.dataset.vista = entrada.nombre;
  actual = Object.assign({}, entrada, { limpiar: null });
  const r = def.render(main, entrada.params || {});
  if (typeof r === 'function') actual.limpiar = r;
}

// Ir a una pantalla. raiz: vacía la pila (pestañas de abajo). reemplazar: no deja volver a la actual.
export function ir(nombre, params = {}, { raiz = false, reemplazar = false } = {}) {
  if (raiz) pila.length = 0;
  else if (actual && !reemplazar) pila.push({ nombre: actual.nombre, params: actual.params });
  pintar({ nombre, params });
}

export function puedeSalir() {
  const d = actual && vistas[actual.nombre];
  return !(d && d.antesDeSalir && d.antesDeSalir() === false);
}

export function atras() {
  if (actual && vistas[actual.nombre].antesDeSalir && vistas[actual.nombre].antesDeSalir() === false) return true;
  const prev = pila.pop();
  if (!prev) return false;
  pintar(prev);
  return true;
}

export function recargar() { if (actual) pintar({ nombre: actual.nombre, params: actual.params }); }
export const vistaActual = () => (actual ? actual.nombre : '');

export function setTitulo(t, sub) {
  $('#title').textContent = t || '';
  const s = $('#subtitle');
  s.textContent = sub || '';
  s.hidden = !sub;
}
export function setAcciones(botones) {
  $('#actions').replaceChildren(...botones.filter(Boolean));
}

// Hoja inferior (menú o diálogo simple)
export function hoja(titulo, contenido, { cerrable = true } = {}) {
  const fondo = el('div', { class: 'sheet-bg' });
  const caja = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo });
  const cerrar = () => { fondo.remove(); document.removeEventListener('mpc-back', onBack); };
  const onBack = (e) => { e.preventDefault(); cerrar(); };
  if (cerrable) fondo.addEventListener('click', (e) => { if (e.target === fondo) cerrar(); });
  caja.append(el('div', { class: 'sheet-grip' }), el('h2', { class: 'sheet-title', text: titulo }));
  const body = el('div', { class: 'sheet-body' });
  caja.append(body);
  fondo.append(caja);
  document.body.append(fondo);
  document.addEventListener('mpc-back', onBack);
  const c = typeof contenido === 'function' ? contenido(cerrar) : contenido;
  if (c) body.append(...[].concat(c));
  return cerrar;
}
