// Secciones de la ficha: plazo de retiro, cobro (seña, guarda, pago), costos y ganancia, fotos y garantía.

import { el, fmt, fechaFmt, fechaCorta, dinero, toast, todayISO, stampISO, addDays, diasEntre } from '../util.js';
import { db, guardarTrabajo, pagoVacio } from '../store.js';
import { mensajeGuarda } from '../acciones.js';
import { abrirWhatsApp } from '../files.js';
import { ir, hoja, recargar } from '../nav.js';
import { radios } from './recepcion.js';
import {
  totalTrabajo, diasListo, diasGuarda, montoGuarda, guardaDesde, plazoRetiro, sena, totalACobrar, saldo,
  costos, ganancia, diezmoDe, pctDiezmo, cobradoTotal,
} from '../cuentas.js';
import { elegirFotos, agregarFotos, srcFoto, borrarFoto } from '../fotos.js';

const medioNombre = (m) => (m === 'mp' ? 'Mercado Pago' : m === 'efectivo' ? 'Efectivo' : '');
function seccion(titulo, ...hijos) { return el('section', { class: 'blk info' }, el('h2', { text: titulo }), ...hijos); }
function fila(k, v, cls) { return el('div', { class: 'kv' + (cls ? ' ' + cls : '') }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })); }

/* ---------- Plazo de retiro ---------- */
export function seccionRetiro(t) {
  if (t.estado !== 'listo' || !t.listoDesde) return null;
  const d = diasListo(t), plazo = plazoRetiro(), dg = diasGuarda(t), porDia = db.cfg.retiro.porDia;
  if (!plazo) return null;
  const desde = guardaDesde(t);
  const faltan = plazo - d;
  const txt = dg > 0
    ? 'Listo desde el ' + fechaFmt(String(t.listoDesde).slice(0, 10)) + '. Pasaron los ' + plazo + ' días: la guarda corre desde el ' + fechaFmt(desde) + ' (' + dg + (dg === 1 ? ' día' : ' días') + ', ' + fmt(montoGuarda(t)) + ').'
    : 'Listo para retirar ' + (d === 0 ? 'desde hoy' : 'hace ' + d + (d === 1 ? ' día' : ' días')) + '. ' + (faltan === 1 ? 'Mañana' : 'En ' + faltan + ' días') + ' empieza a correr la guarda.';
  const aviso = t.avisoGuarda ? el('p', { class: 'hint', text: 'Último aviso por WhatsApp: ' + fechaFmt(String(t.avisoGuarda).slice(0, 10)) + '.' }) : null;
  const mandar = () => {
    abrirWhatsApp(t.cliente.tel, mensajeGuarda(t, { desde, porDia, dias: dg, monto: montoGuarda(t) }));
    t.avisoGuarda = stampISO(); guardarTrabajo(t); recargar();
  };
  return el('div', { class: 'notice' + (dg > 0 ? '' : ' ok') }, el('p', { text: txt }), aviso,
    el('button', { type: 'button', class: 'btn small', text: dg > 0 ? 'Avisar que corre la guarda' : 'Recordarle que lo retire', onclick: mandar }));
}

/* ---------- Cobro ---------- */
export function seccionCobro(t) {
  if (!t.pago) t.pago = pagoVacio();
  const p = t.pago;
  const box = el('div');
  function pintar() {
    const tt = totalTrabajo(t), dg = diasGuarda(t), mg = montoGuarda(t), sn = sena(t), sal = saldo(t);
    const filas = [fila(t.garantiaDe ? 'Trabajo (garantía)' : 'Trabajo', tt == null ? 'sin importe' : fmt(tt))];
    if (dg > 0) {
      filas.push(fila('Guarda (' + dg + (dg === 1 ? ' día' : ' días') + ' × ' + fmt(db.cfg.retiro.porDia) + ')', p.sinGuarda ? 'no se cobra' : fmt(mg)));
      filas.push(el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!p.sinGuarda, disabled: p.pagado, onchange: (e) => { p.sinGuarda = e.target.checked; guardarTrabajo(t); pintar(); } }), el('span', { text: 'No cobrar la guarda' })));
    }
    filas.push(fila('Seña', sn ? fmt(sn) + ' · ' + medioNombre(p.senaMedio) + ' · ' + fechaCorta(p.senaFecha) : '-'));
    if (p.pagado) {
      filas.push(fila('Pagado', fmt(p.pagoMonto || 0) + (p.pagoMedio ? ' · ' + medioNombre(p.pagoMedio) : '') + ' · ' + fechaCorta(p.pagoFecha), 'strong'));
    } else {
      filas.push(fila('Saldo', sal == null ? 'falta el importe' : fmt(sal), 'strong'));
    }
    const botones = el('div', { class: 'row-btns' },
      !p.pagado ? el('button', { type: 'button', class: 'btn small primary', text: 'Registrar pago', onclick: () => registrarPago(t, pintar) }) : null,
      !p.pagado ? el('button', { type: 'button', class: 'btn small', text: sn ? 'Cambiar seña' : 'Anotar seña', onclick: () => editarSena(t, pintar) }) : null,
      p.pagado ? el('button', { type: 'button', class: 'btn small ghost', text: 'Deshacer pago', onclick: () => { Object.assign(p, { pagado: false, pagoMonto: null, pagoMedio: '', pagoFecha: null }); guardarTrabajo(t); pintar(); } }) : null);
    box.replaceChildren(...filas, botones);
  }
  pintar();
  return seccion('Cobro', box);
}

function editarSena(t, despues) {
  const p = t.pago;
  let monto = p.sena, medio = p.senaMedio || 'efectivo';
  hoja('Seña', (cerrar) => [
    el('div', { class: 'field' }, el('label', { text: 'Monto' }), dinero(monto, (v) => { monto = v == null ? null : Math.abs(v); })),
    el('div', { class: 'field' }, el('label', { text: 'Forma de pago' }), radios('sena-m', [{ id: 'efectivo', nombre: 'Efectivo' }, { id: 'mp', nombre: 'Mercado Pago' }], () => medio, (v) => { medio = v; })),
    el('p', { class: 'hint', text: 'Si cancela el trabajo, la seña no se devuelve (está en las condiciones del comprobante).' }),
    el('div', { class: 'stack' }, el('button', { type: 'button', class: 'btn primary', text: 'Guardar', onclick: () => {
      p.sena = monto || null; p.senaMedio = medio; p.senaFecha = p.sena ? (p.senaFecha || todayISO()) : null;
      guardarTrabajo(t); cerrar(); despues && despues(); toast(p.sena ? 'Seña anotada' : 'Seña borrada');
    } })),
  ]);
}

export function registrarPago(t, despues) {
  const p = t.pago;
  const sal = saldo(t);
  let monto = sal != null ? sal : null, medio = 'efectivo';
  hoja('Registrar pago', (cerrar) => [
    el('p', { class: 'sheet-p', text: sal == null ? 'Todavía no hay importe en el informe. Poné cuánto te pagó.' : 'Saldo a cobrar: ' + fmt(sal) + (sena(t) ? ' (ya descontada la seña de ' + fmt(sena(t)) + ')' : '') + '.' }),
    el('div', { class: 'field' }, el('label', { text: 'Te pagó' }), dinero(monto, (v) => { monto = v; })),
    el('div', { class: 'field' }, el('label', { text: 'Forma de pago' }), radios('pago-m', [{ id: 'efectivo', nombre: 'Efectivo' }, { id: 'mp', nombre: 'Mercado Pago' }], () => medio, (v) => { medio = v; })),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn primary', text: 'Guardar pago', onclick: () => {
        Object.assign(p, { pagado: true, pagoMonto: monto || 0, pagoMedio: medio, pagoFecha: todayISO() });
        guardarTrabajo(t); cerrar(); toast('Pago registrado'); despues && despues();
      } }),
      el('button', { type: 'button', class: 'btn', text: 'Todavía no pagó', onclick: () => { cerrar(); despues && despues(); } })),
  ]);
}

/* ---------- Costos, ganancia y diezmo ---------- */
export function seccionGanancia(t) {
  if (!t.pago) t.pago = pagoVacio();
  const box = el('div');
  function pintar() {
    const reps = ((t.informe && t.informe.repuestos) || []).filter((r) => (r.nombre || '').trim());
    const filas = reps.map((r) => fila(r.nombre, r.cliente ? 'lo trajo el cliente' : typeof r.costo === 'number' ? fmt(r.costo) : 'sin costo cargado'));
    const g = ganancia(t), cob = cobradoTotal(t);
    box.replaceChildren(
      ...(filas.length ? filas : [el('p', { class: 'hint', text: 'Los costos de los repuestos se cargan en el informe, en cada repuesto.' })]),
      el('div', { class: 'field' }, el('label', { text: 'Otros gastos (envío, insumos…)' }), dinero(t.pago.gastos, (v) => { t.pago.gastos = v == null ? null : Math.abs(v); guardarTrabajo(t); pintarTotales(); })),
      totales);
    pintarTotales();
  }
  const totales = el('div');
  function pintarTotales() {
    const cob = cobradoTotal(t), g = ganancia(t);
    totales.replaceChildren(
      fila('Cobrado hasta ahora', fmt(cob)),
      fila('Costos', fmt(costos(t))),
      fila('Ganancia', fmt(g), 'strong'),
      fila('Diezmo (' + pctDiezmo() + '%)', fmt(diezmoDe(g))));
  }
  pintar();
  return seccion('Costos y ganancia', box, el('p', { class: 'hint', text: 'El diezmo de cada mes lo marcás como dado en Resumen.' }));
}

/* ---------- Fotos ---------- */
export function seccionFotos(t) {
  const grid = el('div', { class: 'fotos' });
  async function pintar() {
    const items = await Promise.all(t.fotos.map(async (f) => {
      const src = await srcFoto(t, f);
      return el('button', { type: 'button', class: 'foto', 'aria-label': 'Ver foto', onclick: () => verFoto(t, f, src, pintar) },
        el('img', { src, alt: '', loading: 'lazy' }), f.subida ? el('span', { class: 'foto-ok', title: 'En Drive', text: '☁' }) : null);
    }));
    grid.replaceChildren(...items);
  }
  pintar();
  const sumar = async (camara) => {
    const files = await elegirFotos({ camara });
    if (!files.length) return;
    toast('Guardando…', 1200);
    const n = await agregarFotos(t, files);
    if (n) { guardarTrabajo(t); pintar(); toast(n === 1 ? 'Foto guardada' : n + ' fotos guardadas'); }
  };
  return seccion('Fotos del equipo', grid,
    el('div', { class: 'row-btns' },
      el('button', { type: 'button', class: 'btn small primary', text: 'Sacar foto', onclick: () => sumar(true) }),
      el('button', { type: 'button', class: 'btn small', text: 'De la galería', onclick: () => sumar(false) })),
    el('p', { class: 'hint', text: 'Sacale fotos al recibirlo (golpes, rayones, pantalla) por si después hay un reclamo. Quedan en el teléfono y, con Drive conectado, también en tu Drive.' }));
}

function verFoto(t, f, src, despues) {
  hoja('Foto · ' + fechaFmt(String(f.fecha).slice(0, 10)), (cerrar) => [
    el('img', { src, alt: '', class: 'foto-grande' }),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn', text: 'Cerrar', onclick: cerrar }),
      el('button', { type: 'button', class: 'btn danger-ghost', text: 'Borrar esta foto', onclick: async () => {
        if (!window.confirm('¿Borrar la foto?' + (f.subida ? ' En tu Drive queda la copia.' : ''))) return;
        await borrarFoto(t, f); guardarTrabajo(t); cerrar(); despues();
      } })),
  ]);
}

/* ---------- Garantía ---------- */
export function botonGarantia(t) {
  if (t.estado !== 'entregado') return null;
  return el('button', { type: 'button', class: 'linkbtn', text: 'Volvió por garantía: abrir ficha nueva', onclick: () => {
    const g = db.cfg.negocio.garantiaDias;
    const entregado = t.entregadoEl || (t.informe && t.informe.fechaEntrega) || t.fecha;
    const vence = addDays(entregado, g);
    const dentro = g > 0 && diasEntre(todayISO(), vence) >= 0;
    hoja('Reclamo de garantía', (cerrar) => [
      el('p', { class: 'sheet-p', text: dentro ? 'Está dentro de la garantía (vence el ' + fechaFmt(vence) + ').' : 'Ojo: la garantía venció el ' + fechaFmt(vence) + '. Si igual lo tomás como garantía, seguí.' }),
      el('p', { class: 'hint', text: 'Se abre una ficha nueva con los datos del cliente y del equipo, marcada como garantía del N° ' + t.orden + '. El informe arranca sin cargo.' }),
      el('div', { class: 'stack' },
        el('button', { type: 'button', class: 'btn primary', text: 'Abrir ficha de garantía', onclick: () => {
          cerrar();
          ir('recepcion', { prefill: {
            cliente: { nombre: t.cliente.nombre, tel: t.cliente.tel },
            equipo: Object.assign({}, t.equipo),
            falla: 'Garantía del trabajo N° ' + t.orden + ': ',
            garantiaDe: { id: t.id, orden: t.orden, fecha: entregado },
          } });
        } }),
        el('button', { type: 'button', class: 'btn', text: 'Cancelar', onclick: cerrar })),
    ]);
  } });
}
