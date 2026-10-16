// Presupuestador: arma el presupuesto, lo manda por WhatsApp y puede pasarlo a recepción.

import { el, fmt, uid, waNumber, todayISO, fechaFmt, addDays, dinero, toast, botonConfirmar, haceCuanto, limpiarNombreArchivo } from '../util.js';
import { db, guardarPresupuesto, borrarPresupuesto } from '../store.js';
import { EQUIPOS, SERVICIOS, equipoNombre } from '../catalog.js';
import { armarPresupuestoPdf } from '../render/presupuestoPdf.js';
import { compartirArchivo, abrirWhatsApp, copiar } from '../files.js';
import { ir, setTitulo, setAcciones } from '../nav.js';

let q = nuevo();
let modo = 'nuevo';
let msgEditado = null;

function nuevo() {
  return { id: null, nombre: '', tel: '', devices: [{ id: uid('e'), tipo: 'notebook', detalle: '', svcs: [] }], rep: {}, extras: [], libres: [] };
}

const precios = () => db.cfg.precios;
function moPrice(s, e) { const v = precios().mo[s] && precios().mo[s][e]; return typeof v === 'number' ? v : null; }
const garantiaTexto = () => { const g = db.cfg.negocio.garantiaDias; return g > 0 ? g + (g == 1 ? ' día' : ' días') + ' sobre el trabajo realizado' : ''; };

function nombresEquipos() {
  const base = q.devices.map((d) => equipoNombre(d.tipo) + (d.detalle.trim() ? ' ' + d.detalle.trim() : ''));
  const cuenta = {}, vistos = {};
  base.forEach((n) => { cuenta[n] = (cuenta[n] || 0) + 1; });
  return base.map((n) => { if (cuenta[n] < 2) return n; vistos[n] = (vistos[n] || 0) + 1; return n + ' ' + vistos[n]; });
}
function etiquetaEquipos() {
  const n = nombresEquipos();
  if (n.length === 1) return { lbl: 'Equipo', val: n[0] };
  const j = n.join(' + ');
  return { lbl: 'Equipos', val: j.length <= 48 ? j : n.length + ' equipos' };
}
export function construir() {
  const lines = [], multi = q.devices.length > 1, names = nombresEquipos();
  let total = 0, missing = 0;
  q.devices.forEach((d, i) => SERVICIOS.forEach((sv) => {
    if (!d.svcs.includes(sv.id) || !sv.aplica.includes(d.tipo)) return;
    lines.push({ tipo: 'mo', nombre: multi ? names[i] + ' · ' + sv.nombre : sv.nombre + ' (mano de obra)', qty: 1, precio: moPrice(sv.id, d.tipo) });
  }));
  const libres = (arr, def, tipo) => arr.forEach((l) => {
    const nm = l.nombre && l.nombre.trim();
    if (nm || l.precio != null) lines.push({ tipo, nombre: nm || def, qty: 1, precio: l.precio });
  });
  libres(q.extras, 'Servicio adicional', 'extra');
  precios().repuestos.forEach((r) => { const n = q.rep[r.id] || 0; if (n > 0) lines.push({ tipo: 'rep', nombre: r.nombre || 'Repuesto', qty: n, precio: r.precio }); });
  libres(q.libres, 'Ítem', 'libre');
  lines.forEach((l) => { if (l.precio == null) missing++; else total += l.precio * l.qty; });
  return { lines, total, missing };
}
function mensaje() {
  const b = construir(), L = [], eq = etiquetaEquipos(), nom = q.nombre.trim(), p = db.cfg.presupuesto;
  L.push('*Presupuesto - Mario PC*');
  L.push(nom ? 'Hola ' + nom + '! Te paso el presupuesto:' : 'Te paso el presupuesto:');
  L.push('', eq.lbl + ': ' + eq.val, 'Detalle:');
  if (!b.lines.length) L.push('- (sin ítems)');
  b.lines.forEach((l) => L.push('- ' + l.nombre + (l.qty > 1 ? ' x' + l.qty : '') + ': ' + (l.precio == null ? 'a confirmar' : fmt(l.precio * l.qty))));
  L.push('', '*' + (b.missing ? 'Total parcial' : 'Total') + ': ' + fmt(b.total) + '*');
  if (b.missing) L.push('(Los ítems "a confirmar" se suman después.)');
  const foot = [];
  if (p.validez > 0) foot.push('Validez del presupuesto: ' + p.validez + (p.validez == 1 ? ' día' : ' días'));
  if (garantiaTexto()) foot.push('Garantía: ' + garantiaTexto());
  if (p.pagos.trim()) foot.push('Formas de pago: ' + p.pagos.trim());
  if (foot.length) L.push('', ...foot);
  if (db.cfg.negocio.wsp.trim()) L.push('', 'Mario PC - WhatsApp ' + db.cfg.negocio.wsp.trim());
  return L.join('\n');
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function snapshot(estado) {
  const b = construir(), now = new Date();
  const prev = q.id ? db.presupuestos.find((p) => p.id === q.id) : null;
  return Object.assign({}, JSON.parse(JSON.stringify(q)), {
    id: q.id || uid('p'),
    numero: prev ? prev.numero : now.getFullYear() + pad2(now.getMonth() + 1) + pad2(now.getDate()) + '-' + pad2(now.getHours()) + pad2(now.getMinutes()),
    fecha: prev ? prev.fecha : todayISO(),
    estado: estado || (prev ? prev.estado : 'enviado'),
    lines: b.lines, total: b.total, missing: b.missing, equipoTxt: etiquetaEquipos().val,
  });
}
function guardarActual(estado) {
  const p = snapshot(estado);
  guardarPresupuesto(p);
  q.id = p.id;
  return p;
}

export const vistaPresupuesto = {
  tab: 'presupuesto',
  render(main) {
    setTitulo('Presupuesto', '');
    setAcciones([el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Empezar uno nuevo', text: '↺', onclick: () => {
      if (!window.confirm('¿Empezar un presupuesto nuevo? Se borra lo que cargaste.')) return;
      q = nuevo(); msgEditado = null; modo = 'nuevo'; pintar();
    } })]);
    const wrap = el('div', { class: 'wrap' });
    main.append(wrap);
    const pintar = () => { wrap.replaceChildren(); (modo === 'nuevo' ? editor : guardados)(wrap, pintar); };
    pintar();
  },
};

function tabs(pintar) {
  const n = db.presupuestos.length;
  return el('div', { class: 'seg2', role: 'tablist' },
    el('button', { type: 'button', role: 'tab', 'aria-selected': String(modo === 'nuevo'), text: q.id ? 'Editando' : 'Nuevo', onclick: () => { modo = 'nuevo'; pintar(); } }),
    el('button', { type: 'button', role: 'tab', 'aria-selected': String(modo === 'guardados'), text: 'Guardados' + (n ? ' (' + n + ')' : ''), onclick: () => { modo = 'guardados'; pintar(); } }));
}

/* ---------- Editor ---------- */
function editor(wrap, pintar) {
  const lines = el('div', { class: 'lines' }), totalEl = el('strong'), totalLbl = el('span', { class: 'lbl' }), falta = el('p', { class: 'falta', hidden: true });
  const barTotal = el('strong'), barLbl = el('span', { class: 'lbl' });
  const ta = el('textarea', { class: 'msg', spellcheck: 'false', 'aria-label': 'Mensaje para WhatsApp' });
  const reset = el('button', { type: 'button', class: 'btn small', text: 'Volver al texto automático', hidden: true, onclick: () => { msgEditado = null; actualizar(); } });
  ta.addEventListener('input', () => { msgEditado = ta.value; reset.hidden = false; });
  const telHint = el('p', { class: 'hint' });

  function actualizar() {
    const b = construir();
    lines.replaceChildren();
    if (!b.lines.length) lines.append(el('p', { class: 'hint', text: 'Elegí un servicio o sumá repuestos.' }));
    b.lines.forEach((l) => lines.append(el('div', { class: 'ln' },
      el('span', { class: 'ln-n' }, l.nombre, l.qty > 1 ? ' ×' + l.qty : null),
      el('span', { class: 'ln-p' + (l.precio == null ? ' warn' : ''), text: l.precio == null ? 'a confirmar' : fmt(l.precio * l.qty) }))));
    const lab = b.missing ? 'Total parcial' : 'Total';
    totalEl.textContent = barTotal.textContent = fmt(b.total);
    totalLbl.textContent = barLbl.textContent = lab;
    falta.hidden = !b.missing;
    if (b.missing) falta.textContent = 'Falta el precio de ' + b.missing + (b.missing > 1 ? ' ítems' : ' ítem') + '. Cargalo en Ajustes → Precios.';
    if (msgEditado == null) { ta.value = mensaje(); reset.hidden = true; } else ta.value = msgEditado;
    const n = waNumber(q.tel);
    telHint.textContent = !q.tel.trim() ? 'Sin número, WhatsApp te deja elegir el contacto.' : n ? 'Se abre el chat con +' + n.slice(0, 2) + ' ' + n.charAt(2) + ' ' + n.slice(3) : 'No pude interpretar el número. Probá con código de área, sin 0 ni 15.';
  }

  const nombre = el('input', { type: 'text', maxlength: '50', placeholder: 'Juan', value: q.nombre, autocomplete: 'off', id: 'q-nombre' });
  nombre.addEventListener('input', () => { q.nombre = nombre.value; actualizar(); });
  const tel = el('input', { type: 'tel', inputmode: 'tel', maxlength: '24', placeholder: '11 5555 1234', value: q.tel, autocomplete: 'off', id: 'q-tel' });
  tel.addEventListener('input', () => { q.tel = tel.value; actualizar(); });

  // Equipos
  const devBox = el('div', { class: 'devs' });
  function pintarEquipos() {
    const multi = q.devices.length > 1;
    devBox.classList.toggle('multi', multi);
    devBox.replaceChildren(...q.devices.map((d, idx) => {
      const card = el('div', { class: 'dev' });
      if (multi) card.append(el('div', { class: 'dev-hd' }, el('span', { class: 'lbl', text: 'Equipo ' + (idx + 1) }),
        el('button', { type: 'button', class: 'btn small', text: 'Quitar', onclick: () => { q.devices.splice(idx, 1); pintarEquipos(); actualizar(); } })));
      const seg = el('div', { class: 'seg', role: 'radiogroup' });
      EQUIPOS.forEach((e) => {
        const inp = el('input', { type: 'radio', name: 'tipo-' + d.id, checked: d.tipo === e.id });
        inp.addEventListener('change', () => {
          d.tipo = e.id;
          d.svcs = d.svcs.filter((sid) => SERVICIOS.some((s) => s.id === sid && s.aplica.includes(e.id)));
          pintarEquipos(); actualizar();
        });
        seg.append(el('label', { class: 'opt' }, inp, el('span', { text: e.nombre })));
      });
      const det = el('input', { type: 'text', maxlength: '40', placeholder: 'Ej: Lenovo IdeaPad 3', value: d.detalle, autocomplete: 'off' });
      det.addEventListener('input', () => { d.detalle = det.value; actualizar(); });
      const list = el('div', { class: 'svc-list' });
      SERVICIOS.filter((s) => s.aplica.includes(d.tipo)).forEach((s) => {
        const p = moPrice(s.id, d.tipo);
        const inp = el('input', { type: 'checkbox', checked: d.svcs.includes(s.id) });
        inp.addEventListener('change', () => {
          if (inp.checked) { if (!d.svcs.includes(s.id)) d.svcs.push(s.id); } else d.svcs = d.svcs.filter((x) => x !== s.id);
          actualizar();
        });
        list.append(el('label', { class: 'svc' }, inp, el('span', { class: 'svc-in' }, el('b', { text: s.nombre }), el('i', { class: p == null ? 'none' : '', text: p == null ? 'sin precio' : fmt(p) }))));
      });
      card.append(seg, el('div', { class: 'field' }, el('label', { text: 'Marca y modelo (opcional)' }), det), list);
      return card;
    }));
  }
  pintarEquipos();

  // Repuestos con + y −
  const repBox = el('div');
  function pintarRepuestos() {
    const items = precios().repuestos.filter((r) => r.nombre.trim());
    repBox.replaceChildren();
    if (!items.length) { repBox.append(el('p', { class: 'hint', text: 'No hay repuestos cargados. Agregalos en Ajustes → Precios.' })); return; }
    items.forEach((r) => {
      const out = el('output', { text: String(q.rep[r.id] || 0) });
      const row = el('div', { class: 'rep' + ((q.rep[r.id] || 0) > 0 ? ' on' : '') });
      const set = (v) => {
        v = Math.max(0, Math.min(20, v));
        if (v === 0) delete q.rep[r.id]; else q.rep[r.id] = v;
        out.textContent = String(v); row.classList.toggle('on', v > 0); actualizar();
      };
      row.append(el('div', { class: 'info' }, el('span', { class: 'nm', text: r.nombre }), el('span', { class: 'pr', text: r.precio == null ? 'sin precio' : fmt(r.precio) })),
        el('div', { class: 'stepper' },
          el('button', { type: 'button', 'aria-label': 'Quitar uno: ' + r.nombre, text: '−', onclick: () => set((q.rep[r.id] || 0) - 1) }), out,
          el('button', { type: 'button', 'aria-label': 'Agregar uno: ' + r.nombre, text: '+', onclick: () => set((q.rep[r.id] || 0) + 1) })));
      repBox.append(row);
    });
  }
  pintarRepuestos();

  const extras = filas(q.extras, 'servicio', 'Ej: instalación de Windows', actualizar);
  const libres = filas(q.libres, 'ítem', 'Ej: envío o descuento', actualizar);

  const resumen = el('section', { class: 'panel', id: 'resumen' }, el('h2', { text: 'Resumen' }), lines, el('div', { class: 'total' }, totalLbl, totalEl), falta);

  const nombreArchivo = () => limpiarNombreArchivo('Presupuesto Mario PC' + (q.nombre.trim() ? ' - ' + q.nombre.trim() : '') + ' ' + todayISO()) + '.pdf';
  async function pdf() {
    const b = construir();
    if (!b.lines.length) { toast('Elegí un servicio o sumá ítems antes de armar el PDF.'); return; }
    const p = guardarActual();
    const v = db.cfg.presupuesto.validez, n = db.cfg.negocio;
    const blob = armarPresupuestoPdf({
      numero: p.numero, fecha: fechaFmt(p.fecha), validoHasta: v > 0 ? fechaFmt(addDays(p.fecha, v)) : null,
      cliente: q.nombre.trim(), equipoLbl: etiquetaEquipos().lbl, equipo: etiquetaEquipos().val,
      lines: b.lines, total: b.total, missing: b.missing, validez: v, garantia: garantiaTexto(),
      pagos: db.cfg.presupuesto.pagos.trim(), whatsapp: n.wsp.trim(), ig: n.ig.trim(), web: n.web.trim(),
    });
    await compartirArchivo(blob, nombreArchivo(), { titulo: 'Presupuesto' });
  }
  function aRecepcion() {
    const b = construir();
    if (!b.lines.length) { toast('El presupuesto está vacío'); return; }
    const p = guardarActual('aceptado');
    const d = q.devices[0];
    const svcs = SERVICIOS.filter((s) => d.svcs.includes(s.id)).map((s) => s.nombre);
    const det = d.detalle.trim().split(/\s+/);
    const prefill = {
      cliente: { nombre: q.nombre.trim(), tel: q.tel.trim() },
      equipo: { tipo: d.tipo, marca: det.length > 1 ? det[0] : '', modelo: det.length > 1 ? det.slice(1).join(' ') : d.detalle.trim(), serie: '' },
      falla: svcs.join(', '), presupuestoId: p.id,
    };
    if (q.devices.length > 1) toast('Este presupuesto tiene ' + q.devices.length + ' equipos: la ficha arranca con el primero.', 4000);
    q = nuevo(); msgEditado = null;
    ir('recepcion', { prefill });
  }

  wrap.append(tabs(pintar),
    el('section', { class: 'blk' }, el('h2', { text: 'Cliente' }),
      el('div', { class: 'two' },
        el('div', { class: 'field' }, el('label', { for: 'q-nombre', text: 'Nombre (opcional)' }), nombre),
        el('div', { class: 'field' }, el('label', { for: 'q-tel', text: 'WhatsApp del cliente' }), tel)), telHint),
    el('section', { class: 'blk' }, el('h2', { text: 'Equipo y servicios' }), devBox,
      el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar otro equipo', onclick: () => { q.devices.push({ id: uid('e'), tipo: 'notebook', detalle: '', svcs: [] }); pintarEquipos(); actualizar(); } })),
    el('section', { class: 'blk' }, el('h2', { text: 'Servicios adicionales' }), el('p', { class: 'hint', text: 'Para trabajos que no están en la lista, como instalar Windows o una limpieza.' }), extras),
    el('section', { class: 'blk' }, el('h2', { text: 'Repuestos' }), repBox),
    el('section', { class: 'blk' }, el('h2', { text: 'Otros ítems' }), el('p', { class: 'hint', text: 'Con un monto negativo podés restar.' }), libres),
    resumen,
    el('section', { class: 'msgbox' }, el('label', { class: 'lbl', text: 'Mensaje' }), ta, reset,
      el('div', { class: 'actions' },
        el('button', { type: 'button', class: 'btn', text: 'Copiar', onclick: () => copiar(ta.value) }),
        el('button', { type: 'button', class: 'btn', text: 'PDF', onclick: pdf }),
        el('button', { type: 'button', class: 'btn primary wa', text: 'Mandar por WhatsApp', onclick: () => { if (construir().lines.length) guardarActual(); abrirWhatsApp(q.tel, ta.value); } })),
      el('button', { type: 'button', class: 'btn ok-ghost wide', text: 'Lo aprobó: pasar a recepción', onclick: aRecepcion }),
      el('p', { class: 'hint', text: 'Al mandarlo o armar el PDF, queda en Guardados para retomarlo después.' })),
    el('div', { class: 'bar' }, el('div', { class: 't' }, barLbl, barTotal),
      el('button', { type: 'button', class: 'btn primary', text: 'Ver resumen', onclick: () => resumen.scrollIntoView({ behavior: 'smooth', block: 'start' }) })));
  actualizar();
}

function filas(arr, cosa, ejemplo, onChange) {
  const box = el('div', { class: 'rows' });
  function pintar() {
    box.replaceChildren(...arr.map((l, i) => {
      const nm = el('input', { type: 'text', maxlength: '60', placeholder: ejemplo, value: l.nombre, 'aria-label': 'Nombre del ' + cosa, autocomplete: 'off' });
      nm.addEventListener('input', () => { l.nombre = nm.value; onChange(); });
      return el('div', { class: 'libre' }, nm, dinero(l.precio, (v) => { l.precio = v; onChange(); }, { 'aria-label': 'Precio del ' + cosa }),
        el('button', { type: 'button', class: 'btn icon', 'aria-label': 'Quitar ' + cosa, text: '×', onclick: () => { arr.splice(i, 1); pintar(); onChange(); } }));
    }), el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar ' + cosa, onclick: () => { arr.push({ id: uid('l'), nombre: '', precio: null }); pintar(); onChange(); const ins = box.querySelectorAll('input[type=text]'); if (ins.length) ins[ins.length - 2].focus(); } }));
  }
  pintar();
  return box;
}

/* ---------- Guardados ---------- */
function guardados(wrap, pintar) {
  wrap.append(tabs(pintar));
  if (!db.presupuestos.length) {
    wrap.append(el('div', { class: 'empty' }, el('p', { class: 'empty-t', text: 'No hay presupuestos guardados' }), el('p', { class: 'hint', text: 'Se guardan solos cuando los mandás por WhatsApp o armás el PDF.' })));
    return;
  }
  const lista = el('div', { class: 'cards' });
  db.presupuestos.forEach((p) => {
    lista.append(el('div', { class: 'card pres' },
      el('button', { type: 'button', class: 'pres-main', onclick: () => {
        q = { id: p.id, nombre: p.nombre, tel: p.tel, devices: JSON.parse(JSON.stringify(p.devices)), rep: Object.assign({}, p.rep), extras: JSON.parse(JSON.stringify(p.extras)), libres: JSON.parse(JSON.stringify(p.libres)) };
        msgEditado = null; modo = 'nuevo'; pintar(); window.scrollTo(0, 0);
      } },
        el('span', { class: 'job-cli', text: p.nombre.trim() || 'Sin nombre' }),
        el('span', { class: 'job-eq', text: p.equipoTxt || '' }),
        el('span', { class: 'job-meta' },
          el('span', { class: 'badge ' + (p.estado === 'aceptado' ? 'b-listo' : 'b-recibido'), text: p.estado === 'aceptado' ? 'Aprobado' : 'Enviado' }),
          el('span', { text: haceCuanto(p.fecha) }))),
      el('span', { class: 'pres-total', text: fmt(p.total) }),
      botonConfirmar('×', 'Borrar', () => { borrarPresupuesto(p.id); if (q.id === p.id) q.id = null; pintar(); }, 'btn icon')));
  });
  wrap.append(lista);
}
