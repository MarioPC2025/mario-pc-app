// Informe técnico que se entrega con el equipo. Se guarda solo mientras escribís.

import { el, campo, dinero, toast, stampISO, fechaFmt, addDays, debounce } from '../util.js';
import { db, trabajoPorId, guardarTrabajo, informeVacio } from '../store.js';
import { RESULTADOS, TAREAS, PRUEBAS, METRICAS_SUGERIDAS, RECOMENDACIONES } from '../catalog.js';
import { verInforme, mensajeInforme } from '../acciones.js';
import { abrirWhatsApp } from '../files.js';
import { setTitulo, hoja } from '../nav.js';
import { bloque, chips } from './recepcion.js';

const TAREAS_POR_SERVICIO = {
  ssd: ['Cambio de disco a SSD', 'Clonado del sistema al disco nuevo'],
  pantalla: ['Cambio de pantalla'],
  bateria: ['Cambio de batería'],
};

export const vistaInforme = {
  tab: 'trabajos',
  render(main, params) {
    const t = trabajoPorId(params.id);
    if (!t) { main.append(el('p', { class: 'hint pad', text: 'Esta ficha ya no existe.' })); return; }
    if (!t.informe) { t.informe = prellenar(t); guardarTrabajo(t); }
    const inf = t.informe;
    setTitulo('Informe técnico', 'Orden N° ' + t.orden + (t.cliente.nombre.trim() ? ' · ' + t.cliente.nombre.trim() : ''));
    const guardar = debounce(() => guardarTrabajo(t), 300);

    // Resultado
    const resBox = el('div', { class: 'res-list', role: 'radiogroup' });
    function pintarRes() {
      resBox.replaceChildren(...RESULTADOS.map((r) => el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(inf.resultado === r.id), class: 'res res-' + r.id,
        onclick: () => { inf.resultado = r.id; guardar(); pintarRes(); },
      }, el('b', { text: r.nombre }), el('span', { text: r.frase }))));
    }
    pintarRes();

    const diag = campo('Qué encontraste', { multiline: true, rows: '4', maxlength: '900', value: inf.diagnostico, placeholder: 'Ej: El disco rígido tenía sectores dañados y por eso Windows tardaba varios minutos en arrancar.' }, (v) => { inf.diagnostico = v; guardar(); });

    // Tareas
    const tareasItems = TAREAS.concat(inf.tareas.filter((x) => !TAREAS.includes(x))).map((x) => ({ id: x, nombre: x }));
    const tareas = chips(tareasItems, inf.tareas, guardar);
    const otras = filasTexto(inf.tareasOtras, 'Otra tarea', 'Ej: Reemplazo del ventilador', guardar);

    // Repuestos
    const reps = el('div', { class: 'rows' });
    function pintarReps() {
      reps.replaceChildren(...inf.repuestos.map((r, i) => el('div', { class: 'rowcard' },
        el('div', { class: 'two' },
          campo('Repuesto', { value: r.nombre, maxlength: '60', placeholder: 'Ej: SSD 480 GB' }, (v) => { r.nombre = v; guardar(); }).wrap,
          campo('Marca / detalle', { value: r.detalle, maxlength: '80', placeholder: 'Ej: Kingston A400' }, (v) => { r.detalle = v; guardar(); }).wrap),
        el('button', { type: 'button', class: 'btn small ghost', text: 'Quitar', onclick: () => { inf.repuestos.splice(i, 1); guardar(); pintarReps(); } }))));
    }
    pintarReps();

    // Antes y después
    const dl = el('datalist', { id: 'metricas-dl' }, ...METRICAS_SUGERIDAS.map((m) => el('option', { value: m })));
    const mets = el('div', { class: 'rows' });
    function pintarMets() {
      mets.replaceChildren(...inf.metricas.map((m, i) => el('div', { class: 'rowcard' },
        campo('Medición', { value: m.nombre, maxlength: '50', list: 'metricas-dl', placeholder: 'Ej: Tiempo de encendido' }, (v) => { m.nombre = v; guardar(); }).wrap,
        el('div', { class: 'two fixed' },
          campo('Antes', { value: m.antes, maxlength: '24', placeholder: 'Ej: 2 min 40 s' }, (v) => { m.antes = v; guardar(); }).wrap,
          campo('Después', { value: m.despues, maxlength: '24', placeholder: 'Ej: 18 s' }, (v) => { m.despues = v; guardar(); }).wrap),
        el('button', { type: 'button', class: 'btn small ghost', text: 'Quitar', onclick: () => { inf.metricas.splice(i, 1); guardar(); pintarMets(); } }))));
    }
    pintarMets();

    const pruebas = chips(PRUEBAS.map((x) => ({ id: x, nombre: x })), inf.pruebas, guardar);
    const recs = chips(RECOMENDACIONES.map((x) => ({ id: x, nombre: x })), inf.recomendaciones, guardar);
    const recOtra = campo('Otra recomendación', { multiline: true, rows: '2', maxlength: '300', value: inf.recomendacionOtra }, (v) => { inf.recomendacionOtra = v; guardar(); });

    // Entrega
    const garantiaTxt = el('p', { class: 'hint' });
    const pintarGarantia = () => {
      const g = db.cfg.negocio.garantiaDias;
      garantiaTxt.textContent = g > 0 ? 'Garantía: ' + g + ' días, hasta el ' + fechaFmt(addDays(inf.fechaEntrega, g)) + '. Los días se cambian en Ajustes.' : 'Sin garantía (se cambia en Ajustes).';
    };
    const fecha = campo('Fecha de entrega', { type: 'date', value: inf.fechaEntrega }, (v) => { inf.fechaEntrega = v; guardar(); pintarGarantia(); });
    pintarGarantia();
    const total = el('div', { class: 'field' }, el('label', { text: 'Importe total' }), dinero(inf.total, (v) => { inf.total = v; guardar(); }));
    const mostrar = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: inf.mostrarTotal, onchange: (e) => { inf.mostrarTotal = e.target.checked; guardar(); } }), el('span', { text: 'Mostrar el importe en el informe' }));

    const btnPdf = el('button', { type: 'button', class: 'btn primary', text: 'Ver PDF', onclick: () => {
      guardarTrabajo(t);
      if (!inf.diagnostico.trim() && !inf.tareas.length && !inf.tareasOtras.some((x) => x.trim())) {
        toast('Contá qué encontraste o qué hiciste antes de armar el informe', 3200); return;
      }
      inf.generado = stampISO(); guardarTrabajo(t);
      verInforme(t, (ok) => { if (ok && t.estado !== 'entregado') ofrecerEntregado(t); });
    } });

    main.append(el('div', { class: 'wrap form' },
      bloque('Resultado', resBox),
      bloque('Diagnóstico', diag.wrap),
      bloque('Qué hice', tareas, otras),
      bloque('Repuestos instalados', reps, el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar repuesto', onclick: () => { inf.repuestos.push({ nombre: '', detalle: '' }); guardar(); pintarReps(); } })),
      bloque('Antes y después', el('p', { class: 'hint', text: 'Opcional. Muy bueno para mostrar la mejora de un cambio a SSD o una limpieza.' }), dl, mets,
        el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar medición', onclick: () => { inf.metricas.push({ nombre: '', antes: '', despues: '' }); guardar(); pintarMets(); } })),
      bloque('Lo que probaste', pruebas),
      bloque('Recomendaciones', recs, recOtra.wrap),
      bloque('Entrega', el('div', { class: 'two' }, fecha.wrap, total), mostrar, garantiaTxt)),
      el('div', { class: 'bar' },
        el('button', { type: 'button', class: 'btn', text: 'Mensaje', onclick: () => abrirWhatsApp(t.cliente.tel, mensajeInforme(t)) }),
        btnPdf));

    return () => guardarTrabajo(t);
  },
};

function ofrecerEntregado(t) {
  hoja('¿Ya lo entregaste?', (cerrar) => [
    el('p', { class: 'sheet-p', text: 'Si el equipo ya volvió con su dueño, lo paso a "Entregado".' }),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn primary', text: 'Sí, marcar entregado', onclick: () => { t.estado = 'entregado'; guardarTrabajo(t); cerrar(); toast('Marcado como entregado'); } }),
      el('button', { type: 'button', class: 'btn', text: 'Todavía no', onclick: cerrar })),
  ]);
}

function filasTexto(arr, label, ph, onChange) {
  const box = el('div', { class: 'rows' });
  function pintar() {
    box.replaceChildren(...arr.map((v, i) => el('div', { class: 'inline-row' },
      campo(label, { value: v, maxlength: '80', placeholder: ph }, (nv) => { arr[i] = nv; onChange(); }).wrap,
      el('button', { type: 'button', class: 'btn icon', 'aria-label': 'Quitar', text: '×', onclick: () => { arr.splice(i, 1); onChange(); pintar(); } }))),
    el('button', { type: 'button', class: 'btn ghost small', text: '+ Otra tarea', onclick: () => { arr.push(''); onChange(); pintar(); const ins = box.querySelectorAll('input'); if (ins.length) ins[ins.length - 1].focus(); } }));
  }
  pintar();
  return box;
}

// Arranca el informe con lo que ya se sabe del presupuesto aprobado
function prellenar(t) {
  const inf = informeVacio(t);
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  if (pres) {
    (pres.devices || []).forEach((d) => (d.svcs || []).forEach((s) => (TAREAS_POR_SERVICIO[s] || []).forEach((x) => { if (!inf.tareas.includes(x)) inf.tareas.push(x); })));
    pres.lines.filter((l) => l.tipo === 'rep' && (l.precio == null || l.precio >= 0)).forEach((l) => {
      for (let i = 0; i < Math.min(l.qty, 4); i++) inf.repuestos.push({ nombre: l.nombre, detalle: '' });
    });
    if (inf.tareas.includes('Cambio de disco a SSD')) inf.metricas.push({ nombre: 'Tiempo de encendido', antes: '', despues: '' });
  }
  return inf;
}
