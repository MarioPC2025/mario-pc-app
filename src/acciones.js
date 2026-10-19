// Acciones que se usan desde varias pantallas: imprimir, comprobante, informe, avisos por WhatsApp.

import { el, toast, fechaFmt, addDays, fmt, limpiarNombreArchivo, todayISO } from './util.js';
import { db, guardarCfg } from './store.js';
import { RESULTADOS, equipoNombre } from './catalog.js';
import { prepararLogos, drawLabel, rotarParaImpresora, renderA4, equipoTexto } from './render/recepcion.js';
import { canvasToPdf, toBlobP, fuentesListas } from './render/canvas.js';
import { armarInformePdf } from './render/informePdf.js';
import { compartirArchivo, abrirWhatsApp, appsWhatsApp, enviarArchivoWhatsApp } from './files.js';
import { imprimir, mensajeError, elegirImpresora } from './printer.js';
import { hoja } from './nav.js';
import { verPdf } from './preview.js';

export async function lienzoEtiqueta(t) {
  await Promise.all([fuentesListas(), prepararLogos()]);
  return drawLabel(t, db.cfg);
}
export async function lienzoComprobante(t, opts) {
  await Promise.all([fuentesListas(), prepararLogos()]);
  return renderA4(t, db.cfg, opts);
}

/* ---------- Etiqueta ---------- */
let imprimiendo = false;
export async function imprimirEtiqueta(t, boton) {
  if (imprimiendo) return;
  const im = db.cfg.impresora;
  if (!im.deviceId) { menuSinImpresora(t); return; }
  imprimiendo = true;
  const txt = boton ? boton.textContent : '';
  const prog = (p) => { if (boton) boton.textContent = 'Imprimiendo… ' + Math.round(p * 100) + '%'; };
  if (boton) { boton.setAttribute('aria-busy', 'true'); boton.textContent = 'Conectando…'; }
  try {
    const cv = rotarParaImpresora(await lienzoEtiqueta(t), db.cfg.etiqueta.giro === 'ccw');
    await imprimir(im, cv, prog);
    toast('Etiqueta impresa');
  } catch (e) {
    const msg = mensajeError(e);
    hoja('No se pudo imprimir', (cerrar) => [
      el('p', { class: 'sheet-p', text: msg }),
      el('div', { class: 'stack' },
        el('button', { type: 'button', class: 'btn primary', text: 'Probar de nuevo', onclick: () => { cerrar(); imprimirEtiqueta(t, boton); } }),
        el('button', { type: 'button', class: 'btn', text: 'Mandar la imagen a la app de Phomemo', onclick: () => { cerrar(); compartirEtiqueta(t); } })),
    ]);
  } finally {
    imprimiendo = false;
    if (boton) { boton.removeAttribute('aria-busy'); boton.textContent = txt; }
  }
}

function menuSinImpresora(t) {
  hoja('Imprimir etiqueta', (cerrar) => [
    el('p', { class: 'sheet-p', text: 'Todavía no conectaste la Phomemo. La conectás una sola vez y después imprime directo.' }),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn primary', text: 'Conectar la Phomemo', onclick: async () => {
        cerrar();
        const ok = await conectarImpresora();
        if (ok) imprimirEtiqueta(t);
      } }),
      el('button', { type: 'button', class: 'btn', text: 'Mandar la imagen a la app de Phomemo', onclick: () => { cerrar(); compartirEtiqueta(t); } })),
  ]);
}

export async function conectarImpresora() {
  try {
    const d = await elegirImpresora();
    db.cfg.impresora.deviceId = d.deviceId;
    db.cfg.impresora.nombre = d.nombre;
    guardarCfg();
    toast('Conectada: ' + d.nombre);
    return true;
  } catch (e) {
    const m = mensajeError(e);
    if (m !== 'Cancelado.') toast(m, 4000);
    return false;
  }
}

export async function compartirEtiqueta(t) {
  const cv = rotarParaImpresora(await lienzoEtiqueta(t), db.cfg.etiqueta.giro === 'ccw');
  const b = await toBlobP(cv, 'image/png');
  await compartirArchivo(b, 'mariopc-etiqueta-' + t.orden + '.png', { titulo: 'Etiqueta N° ' + t.orden });
}

/* ---------- Comprobante A4 ---------- */
async function pdfComprobante(t, { firmas = true } = {}) {
  const pdf = await canvasToPdf(await lienzoComprobante(t, { firmas }));
  const nombre = limpiarNombreArchivo('Comprobante Mario PC N° ' + t.orden + (t.cliente.nombre ? ' - ' + t.cliente.nombre : '')) + '.pdf';
  return { pdf, nombre, titulo: 'Comprobante de recepción N° ' + t.orden };
}
// Manda el comprobante por WhatsApp directo, sin vista previa. Va sin campos de firma (es la copia digital).
export async function enviarComprobante(t) {
  toast('Armando el comprobante…', 1500);
  const { pdf, nombre, titulo } = await pdfComprobante(t, { firmas: false });
  return mandarPorWhatsApp(pdf, nombre, { tel: t.cliente.tel, texto: mensajeComprobante(t), titulo });
}
// Vista previa del comprobante, con los botones para mandarlo por WhatsApp o compartirlo.
// El check "Con firmas" agrega o saca los campos de firma (empieza tildado, para imprimir).
export async function verComprobante(t) {
  toast('Armando el comprobante…', 1500);
  let actual = await pdfComprobante(t, { firmas: true });
  verPdf(actual.pdf, {
    titulo: 'Comprobante', sub: 'Orden N° ' + t.orden + (t.cliente.nombre.trim() ? ' · ' + t.cliente.nombre.trim() : ''),
    opcion: { texto: 'Con campos de firma', valor: true, alCambiar: async (firmas) => { actual = await pdfComprobante(t, { firmas }); return actual.pdf; } },
    acciones: [
      { text: 'Compartir', onclick: () => compartirArchivo(actual.pdf, actual.nombre, { titulo: actual.titulo }) },
      { text: 'WhatsApp', primary: true, onclick: () => mandarPorWhatsApp(actual.pdf, actual.nombre, { tel: t.cliente.tel, texto: mensajeComprobante(t), titulo: actual.titulo }) },
    ],
  });
}

/* ---------- Mandar un PDF por WhatsApp ---------- */
// Si están instaladas las dos (WhatsApp y WhatsApp Business), pregunta con cuál.
export async function mandarPorWhatsApp(blob, nombre, opts) {
  const a = await appsWhatsApp();
  if (a.whatsapp && a.business) {
    // Si cierra la hoja sin elegir, la promesa queda sin resolver y no pasa nada
    return new Promise((fin) => {
      const con = (app) => (cerrar) => { cerrar(); fin(enviarArchivoWhatsApp(blob, nombre, { ...opts, app })); };
      hoja('¿Con cuál WhatsApp?', (cerrar) => [
        el('div', { class: 'stack' },
          el('button', { type: 'button', class: 'btn primary', text: 'WhatsApp Business', onclick: () => con('com.whatsapp.w4b')(cerrar) }),
          el('button', { type: 'button', class: 'btn', text: 'WhatsApp', onclick: () => con('com.whatsapp')(cerrar) })),
      ]);
    });
  }
  if (a.whatsapp || a.business) return enviarArchivoWhatsApp(blob, nombre, { ...opts, app: a.business ? 'com.whatsapp.w4b' : 'com.whatsapp' });
  return compartirArchivo(blob, nombre, { titulo: opts.titulo, texto: opts.texto }); // sin WhatsApp (o en el navegador)
}

/* ---------- Informe técnico ---------- */
export function datosInforme(t) {
  const inf = t.informe, n = db.cfg.negocio;
  const res = RESULTADOS.find((r) => r.id === inf.resultado) || RESULTADOS[0];
  const tareas = inf.tareas.concat(inf.tareasOtras.map((x) => x.trim()).filter(Boolean));
  const recs = inf.recomendaciones.concat(inf.recomendacionOtra.trim() ? [inf.recomendacionOtra.trim()] : []);
  return {
    orden: t.orden,
    fechaRecepcion: fechaFmt(t.fecha), fechaEntrega: fechaFmt(inf.fechaEntrega || todayISO()),
    cliente: t.cliente.nombre.trim(), equipo: equipoTexto(t), serie: t.equipo.serie.trim(),
    falla: t.falla.trim(), resultado: res, diagnostico: inf.diagnostico.trim(),
    tareas, repuestos: inf.repuestos.filter((r) => (r.nombre || '').trim()),
    metricas: inf.metricas.filter((m) => (m.nombre || '').trim() && ((m.antes || '').trim() || (m.despues || '').trim())),
    pruebas: inf.pruebas, recomendaciones: recs,
    total: inf.total, mostrarTotal: inf.mostrarTotal,
    garantiaDias: n.garantiaDias, garantiaHasta: fechaFmt(addDays(inf.fechaEntrega || todayISO(), n.garantiaDias)),
    wsp: n.wsp.trim(), ig: n.ig.trim(), web: n.web.trim(), resenas: (n.resenas || '').trim(),
  };
}
export function nombreInforme(t) {
  return limpiarNombreArchivo('Informe técnico Mario PC N° ' + t.orden + (t.cliente.nombre ? ' - ' + t.cliente.nombre : '')) + '.pdf';
}
export function pdfInforme(t) { return armarInformePdf(datosInforme(t)); }

// Vista previa del informe. despues(ok): se llama después de compartir (ok = se compartió).
export function verInforme(t, despues) {
  const blob = pdfInforme(t), nombre = nombreInforme(t);
  verPdf(blob, {
    titulo: 'Informe técnico', sub: 'Orden N° ' + t.orden + (t.cliente.nombre.trim() ? ' · ' + t.cliente.nombre.trim() : ''),
    acciones: [
      { text: 'Compartir', onclick: async () => {
        const ok = await compartirArchivo(blob, nombre, { titulo: 'Informe técnico N° ' + t.orden });
        if (despues) despues(ok);
      } },
      { text: 'WhatsApp', primary: true, onclick: async () => {
        const ok = await mandarPorWhatsApp(blob, nombre, { tel: t.cliente.tel, texto: mensajeInforme(t), titulo: 'Informe técnico N° ' + t.orden });
        if (despues) despues(ok);
      } },
    ],
  });
}

/* ---------- Mensajes de WhatsApp ---------- */
function primerNombre(t) { return (t.cliente.nombre.trim().split(/\s+/)[0] || '').replace(/^./, (c) => c.toUpperCase()); }
function equipoCorto(t) {
  const tipo = equipoNombre(t.equipo.tipo).toLowerCase();
  return (tipo === 'pc de escritorio' ? 'PC' : tipo) + (t.equipo.marca.trim() ? ' ' + t.equipo.marca.trim() : '');
}
export function mensajeListo(t) {
  const nom = primerNombre(t);
  const total = t.informe && t.informe.total != null ? t.informe.total : null;
  const L = [(nom ? 'Hola ' + nom + '! ' : 'Hola! ') + 'Tu ' + equipoCorto(t) + ' ya está listo para retirar (orden N° ' + t.orden + ').'];
  if (total != null) L.push('El total es ' + fmt(total) + '.');
  L.push('Avisame qué día y horario te queda cómodo y coordinamos.');
  L.push('', 'Mario PC');
  return L.join('\n');
}
export function mensajeComprobante(t) {
  const nom = primerNombre(t);
  return (nom ? 'Hola ' + nom + '! ' : 'Hola! ') + 'Te paso el comprobante de recepción de tu ' + equipoCorto(t) +
    ' (orden N° ' + t.orden + '). Guardalo para cuando vengas a retirarlo. Cualquier duda, escribime.\n\nMario PC';
}
export function mensajeInforme(t) {
  const nom = primerNombre(t);
  return (nom ? 'Hola ' + nom + '! ' : 'Hola! ') + 'Te paso el informe técnico de tu ' + equipoCorto(t) +
    ' (orden N° ' + t.orden + '), con todo lo que le hice y la garantía. Cualquier duda, escribime.' +
    ((db.cfg.negocio.resenas || '').trim() ? '\n\nSi te gustó el trabajo, me ayudás muchísimo dejando una reseña en Google: ' + db.cfg.negocio.resenas.trim() : '') +
    '\n\nMario PC';
}
export function avisarListo(t) { abrirWhatsApp(t.cliente.tel, mensajeListo(t)); }
