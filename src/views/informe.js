// Informe técnico que se entrega con el equipo. Se guarda solo mientras escribís.

import { el, campo, dinero, toast, stampISO, fechaFmt, addDays, debounce } from '../util.js';
import { db, trabajoPorId, guardarTrabajo, guardarCfg, informeVacio } from '../store.js';
import { RESULTADOS, TAREAS, TAREAS_POR_SERVICIO, PRUEBAS, recomendacionesPara, recomendacionesAuto, CARPETA_DATOS } from '../catalog.js';
import { verInforme, mensajeInforme, marcarResenaPedida } from '../acciones.js';
import { abrirWhatsApp } from '../files.js';
import { setTitulo, hoja } from '../nav.js';
import { bloque, chips } from './recepcion.js';

const TAREA_BACKUP = 'Copia de seguridad de archivos';

export const vistaInforme = {
  tab: 'trabajos',
  render(main, params) {
    const t = trabajoPorId(params.id);
    if (!t) { main.append(el('p', { class: 'hint pad', text: 'Esta ficha ya no existe.' })); return; }
    if (!t.informe) { t.informe = prellenar(t); guardarTrabajo(t); }
    const inf = t.informe;
    // Informes viejos: las tareas escritas a mano pasan a ser tildes comunes
    (inf.tareasOtras || []).map((x) => x.trim()).filter(Boolean).forEach((x) => { if (!inf.tareas.includes(x)) inf.tareas.push(x); });
    inf.tareasOtras = [];
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

    // Tareas: las de siempre + las que fuiste agregando (quedan guardadas para la próxima)
    const datosChk = el('input', { type: 'checkbox', checked: !!inf.datosEscritorio, onchange: (e) => { inf.datosEscritorio = e.target.checked; guardar(); } });
    const datos = el('label', { class: 'check' }, datosChk, el('span', { text: 'Dejé sus archivos en la carpeta "' + CARPETA_DATOS + '" del escritorio' }));
    const tareasBox = el('div');
    let teniaBackup = inf.tareas.includes(TAREA_BACKUP);
    function alCambiarTareas() {
      const tiene = inf.tareas.includes(TAREA_BACKUP);
      if (tiene && !teniaBackup && !inf.datosEscritorio) { inf.datosEscritorio = true; datosChk.checked = true; }
      teniaBackup = tiene;
      guardar();
    }
    function pintarTareas() {
      const lista = TAREAS.concat(db.cfg.tareasPropias.filter((x) => !TAREAS.includes(x)));
      inf.tareas.forEach((x) => { if (!lista.includes(x)) lista.push(x); });
      tareasBox.replaceChildren(chips(lista.map((x) => ({ id: x, nombre: x })), inf.tareas, alCambiarTareas));
    }
    pintarTareas();
    const nuevaTarea = el('input', { type: 'text', maxlength: '80', placeholder: 'Ej: Reemplazo del ventilador', 'aria-label': 'Otra tarea', autocomplete: 'off' });
    function agregarTarea() {
      const x = nuevaTarea.value.trim().replace(/\s+/g, ' ');
      if (!x) { nuevaTarea.focus(); return; }
      const ya = TAREAS.concat(db.cfg.tareasPropias).find((y) => y.toLowerCase() === x.toLowerCase());
      const nombre = ya || x;
      if (!ya) { db.cfg.tareasPropias.push(nombre); guardarCfg(); }
      if (!inf.tareas.includes(nombre)) inf.tareas.push(nombre);
      nuevaTarea.value = '';
      alCambiarTareas(); pintarTareas();
      toast(ya ? 'Tildada: ' + nombre : 'Agregada y guardada para la próxima');
    }
    nuevaTarea.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarTarea(); } });
    const otraTarea = el('div', { class: 'field' }, el('label', { text: 'Otra tarea' }),
      el('div', { class: 'add-row' }, nuevaTarea, el('button', { type: 'button', class: 'btn', text: 'Agregar', onclick: agregarTarea })),
      el('p', { class: 'hint', text: 'Queda en la lista para los próximos informes. Las sacás desde Ajustes.' }));

    // Repuestos
    const reps = el('div', { class: 'rows' });
    function pintarReps() {
      reps.replaceChildren(...inf.repuestos.map((r, i) => el('div', { class: 'rowcard' },
        el('div', { class: 'two' },
          campo('Repuesto', { value: r.nombre, maxlength: '60', placeholder: 'Ej: SSD 480 GB' }, (v) => { r.nombre = v; guardar(); }).wrap,
          campo('Marca / detalle', { value: r.detalle, maxlength: '80', placeholder: 'Ej: Kingston A400' }, (v) => { r.detalle = v; guardar(); }).wrap),
        el('div', { class: 'rowcard-foot' },
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!r.cliente, onchange: (e) => { r.cliente = e.target.checked; guardar(); } }), el('span', { text: 'Lo trajo el cliente' })),
          el('button', { type: 'button', class: 'btn small ghost', text: 'Quitar', onclick: () => { inf.repuestos.splice(i, 1); guardar(); pintarReps(); } })))));
    }
    pintarReps();

    const pruebas = chips(PRUEBAS.map((x) => ({ id: x, nombre: x })), inf.pruebas, guardar);
    // Recomendaciones: solo las que tienen sentido para este tipo de equipo
    const recLista = recomendacionesPara(t.equipo.tipo);
    inf.recomendaciones.forEach((x) => { if (!recLista.includes(x)) recLista.push(x); });
    const recs = chips(recLista.map((x) => ({ id: x, nombre: x })), inf.recomendaciones, guardar);
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
      if (!inf.diagnostico.trim() && !inf.tareas.length) {
        toast('Contá qué encontraste o qué hiciste antes de armar el informe', 3200); return;
      }
      inf.generado = stampISO();
      // Con el informe hecho, el equipo queda "Listo" (falta entregarlo)
      if (t.estado === 'recibido' || t.estado === 'en_curso') t.estado = 'listo';
      guardarTrabajo(t);
      verInforme(t, (ok) => { if (ok && t.estado !== 'entregado') ofrecerEntregado(t); });
    } });

    main.append(el('div', { class: 'wrap form' },
      bloque('Resultado', resBox),
      bloque('Diagnóstico', diag.wrap),
      bloque('Qué hice', tareasBox, otraTarea, datos),
      bloque('Repuestos instalados', reps, el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar repuesto', onclick: () => { inf.repuestos.push({ nombre: '', detalle: '', cliente: false }); guardar(); pintarReps(); } })),
      bloque('Lo que probaste', pruebas),
      bloque('Recomendaciones', recs, recOtra.wrap),
      bloque('Entrega', el('div', { class: 'two' }, fecha.wrap, total), mostrar, garantiaTxt)),
      el('div', { class: 'bar' },
        el('button', { type: 'button', class: 'btn', text: 'Mensaje', onclick: () => { abrirWhatsApp(t.cliente.tel, mensajeInforme(t)); marcarResenaPedida(t); } }),
        btnPdf));

    return () => guardarTrabajo(t);
  },
};

function ofrecerEntregado(t) {
  hoja('¿Ya lo entregaste?', (cerrar) => [
    el('p', { class: 'sheet-p', text: 'Si el equipo ya volvió con su dueño, lo paso a "Entregado".' + (t.claveValor ? ' La clave que anotaste se borra.' : '') }),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn primary', text: 'Sí, marcar entregado', onclick: () => { t.estado = 'entregado'; guardarTrabajo(t); cerrar(); toast('Marcado como entregado'); } }),
      el('button', { type: 'button', class: 'btn', text: 'Todavía no', onclick: cerrar })),
  ]);
}

// Arranca el informe con lo que ya se sabe: presupuesto aprobado y tipo de equipo
function prellenar(t) {
  const inf = informeVacio(t);
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  if (pres) {
    (pres.devices || []).forEach((d) => (d.svcs || []).forEach((s) => (TAREAS_POR_SERVICIO[s] || []).forEach((x) => { if (!inf.tareas.includes(x)) inf.tareas.push(x); })));
    pres.lines.filter((l) => l.tipo === 'rep' && (l.precio == null || l.precio >= 0)).forEach((l) => {
      for (let i = 0; i < Math.min(l.qty, 4); i++) inf.repuestos.push({ nombre: l.nombre, detalle: '', cliente: false });
    });
  }
  if (inf.tareas.includes(TAREA_BACKUP)) inf.datosEscritorio = true;
  inf.recomendaciones = recomendacionesAuto(t.equipo.tipo);
  return inf;
}
