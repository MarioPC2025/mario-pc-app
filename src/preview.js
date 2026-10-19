// Vista previa de PDF a pantalla completa, antes de compartirlo.
// El WebView de Android no muestra PDF, así que se dibuja cada página con pdf.js (va dentro del APK
// en www/pdfjs y se carga recién la primera vez que se abre una vista previa).

import { el, toast } from './util.js';

const ZOOMS = [1, 1.5, 2, 3];
const MAX_PIXELES = 16e6; // tope por página para no reventar la memoria del WebView

let pdfjs = null;
async function cargarPdfjs() {
  if (pdfjs) return pdfjs;
  const base = new URL('pdfjs/', document.baseURI).href;
  const lib = await import(/* @vite-ignore */ base + 'pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.mjs';
  pdfjs = { lib, base };
  return pdfjs;
}

// Muestra el PDF. `acciones`: [{ text, primary, onclick(cerrar) }] para la barra de abajo.
export async function verPdf(blob, { titulo = 'Vista previa', sub = '', acciones = [] } = {}) {
  let zoom = 0, doc = null, tarea = null, cerrado = false, version = 0;

  const paginas = el('div', { class: 'pv-pages' });
  const scroller = el('div', { class: 'pv-scroll' }, el('p', { class: 'pv-msg', text: 'Armando la vista previa…' }));
  const lblZoom = el('span', { class: 'pv-zoom-t', 'aria-live': 'polite', text: 'Ajustado' });
  const menos = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Achicar', text: '−', disabled: true, onclick: () => setZoom(zoom - 1) });
  const mas = el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Agrandar', text: '+', onclick: () => setZoom(zoom + 1) });
  const subEl = el('p', { class: 'pv-sub', text: sub });

  const caja = el('div', { class: 'pv', role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo },
    el('header', { class: 'pv-top' },
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Cerrar vista previa', text: '‹', onclick: () => cerrar() }),
      el('div', { class: 'pv-t' }, el('h2', { text: titulo }), subEl),
      el('div', { class: 'pv-zoom' }, menos, lblZoom, mas)),
    scroller,
    el('div', { class: 'pv-bar' }, ...acciones.map((a) => el('button', {
      type: 'button', class: 'btn' + (a.primary ? ' primary' : ''), text: a.text, onclick: () => a.onclick(cerrar),
    }))));

  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('mpc-back', onBack);
    window.removeEventListener('resize', onResize);
    if (vv) { vv.removeEventListener('resize', onResize); vv.removeEventListener('scroll', encajar); }
    caja.remove();
    if (tarea) tarea.destroy().catch(() => {});
  }
  // El botón atrás de Android cierra la vista previa (o la hoja que esté abierta encima)
  function onBack(e) {
    if (document.querySelector('.sheet-bg')) return;
    e.preventDefault(); cerrar();
  }
  // Seguro: la vista previa ocupa exactamente la parte visible de la pantalla. En algunos celulares, si algo de
  // la pantalla de atrás se sale por el costado, Chrome agranda el área de la app y la barra de botones quedaba
  // fuera de la pantalla.
  const vv = window.visualViewport;
  let anchoAnterior = 0;
  function encajar() {
    if (!vv) return;
    Object.assign(caja.style, { left: vv.offsetLeft + 'px', top: vv.offsetTop + 'px', width: vv.width + 'px', height: vv.height + 'px', right: 'auto', bottom: 'auto' });
  }
  let tResize = null;
  function onResize() {
    encajar();
    clearTimeout(tResize);
    tResize = setTimeout(() => { if (doc && scroller.clientWidth !== anchoAnterior) dibujar(); }, 200);
  }

  document.body.append(caja);
  encajar();
  document.addEventListener('mpc-back', onBack);
  window.addEventListener('resize', onResize);
  if (vv) { vv.addEventListener('resize', onResize); vv.addEventListener('scroll', encajar); }

  function setZoom(z) {
    z = Math.max(0, Math.min(ZOOMS.length - 1, z));
    if (z === zoom || !doc) return;
    // mantiene a la vista la misma zona del documento
    const fx = scroller.scrollWidth > scroller.clientWidth ? (scroller.scrollLeft + scroller.clientWidth / 2) / scroller.scrollWidth : 0.5;
    const fy = (scroller.scrollTop + scroller.clientHeight / 2) / scroller.scrollHeight;
    zoom = z;
    menos.disabled = zoom === 0;
    mas.disabled = zoom === ZOOMS.length - 1;
    lblZoom.textContent = zoom === 0 ? 'Ajustado' : Math.round(ZOOMS[zoom] * 100) + '%';
    dibujar().then(() => {
      scroller.scrollLeft = fx * scroller.scrollWidth - scroller.clientWidth / 2;
      scroller.scrollTop = fy * scroller.scrollHeight - scroller.clientHeight / 2;
    });
  }

  // Doble toque: alterna entre ajustado y 200%
  let ultimoToque = 0;
  scroller.addEventListener('click', () => {
    const ahora = Date.now();
    if (ahora - ultimoToque < 320) { setZoom(zoom === 0 ? 2 : 0); ultimoToque = 0; } else ultimoToque = ahora;
  });

  async function dibujar() {
    const v = ++version;
    anchoAnterior = scroller.clientWidth;
    const ancho = Math.max(200, scroller.clientWidth - 24);
    const dpr = window.devicePixelRatio || 1;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      if (v !== version || cerrado) return;
      const base = page.getViewport({ scale: 1 });
      const escala = (ancho / base.width) * ZOOMS[zoom];
      const css = page.getViewport({ scale: escala });
      const salida = Math.min(dpr, Math.sqrt(MAX_PIXELES / (css.width * css.height)));
      const vp = page.getViewport({ scale: escala * salida });
      const cv = el('canvas', { class: 'pv-page', 'aria-label': 'Página ' + i + ' de ' + doc.numPages });
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      cv.style.width = Math.floor(css.width) + 'px'; cv.style.height = Math.floor(css.height) + 'px';
      await page.render({ canvas: cv, viewport: vp }).promise;
      if (v !== version || cerrado) return;
      if (i === 1) { paginas.replaceChildren(cv); scroller.replaceChildren(paginas); }
      else paginas.append(cv);
    }
  }

  try {
    const { lib, base } = await cargarPdfjs();
    if (cerrado) return;
    const data = new Uint8Array(await blob.arrayBuffer());
    tarea = lib.getDocument({ data, standardFontDataUrl: base + 'standard_fonts/', useSystemFonts: false, isEvalSupported: false });
    doc = await tarea.promise;
    if (cerrado) return;
    const n = doc.numPages;
    subEl.textContent = [sub, n + (n === 1 ? ' página' : ' páginas')].filter(Boolean).join(' · ');
    await dibujar();
  } catch (e) {
    if (cerrado) return;
    console.error(e);
    scroller.replaceChildren(el('p', { class: 'pv-msg', text: 'No se pudo mostrar la vista previa. Igual podés compartir el PDF desde acá abajo.' }));
    toast('No se pudo mostrar la vista previa');
  }
  return cerrar;
}
