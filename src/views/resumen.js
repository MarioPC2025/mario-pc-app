// Resumen del mes: cuánto entró, cuántos equipos, reseñas, presupuestos y clientes para volver a contactar.

import { el, fmt, fechaFmt, diasEntre, todayISO, stampISO, toast } from '../util.js';
import { db, guardarTrabajo } from '../store.js';
import { EQUIPOS, equipoNombre } from '../catalog.js';
import { mensajeRecordatorio } from '../acciones.js';
import { abrirWhatsApp } from '../files.js';
import { ir, setTitulo, recargar } from '../nav.js';
import { paraRecordar } from '../seguimiento.js';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
let mes = null; // 'AAAA-MM'

const mesDe = (iso) => String(iso || '').slice(0, 7);
function moverMes(m, n) {
  const [a, b] = m.split('-').map(Number);
  const d = new Date(Date.UTC(a, b - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}
const nombreMes = (m) => MESES[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4);
const entregaDe = (t) => (t.informe && t.informe.fechaEntrega) || '';

function datosMes(m) {
  const entregados = db.trabajos.filter((t) => t.estado === 'entregado' && mesDe(entregaDe(t)) === m);
  const conTotal = entregados.filter((t) => t.informe && typeof t.informe.total === 'number');
  const facturado = conTotal.reduce((s, t) => s + t.informe.total, 0);
  const dias = entregados.map((t) => diasEntre(t.fecha, entregaDe(t))).filter((d) => d != null && d >= 0);
  const pedidas = db.trabajos.filter((t) => mesDe(t.resenaPedida) === m);
  const pres = db.presupuestos.filter((p) => mesDe(p.fecha) === m);
  return {
    entregados, facturado, ticket: conTotal.length ? Math.round(facturado / conTotal.length) : null,
    recibidos: db.trabajos.filter((t) => mesDe(t.fecha) === m).length,
    dias: dias.length ? dias.reduce((a, b) => a + b, 0) / dias.length : null,
    pedidas: pedidas.length, dejadas: pedidas.filter((t) => t.resenaDejo).length,
    presEnviados: pres.length, presAprobados: pres.filter((p) => p.estado === 'aceptado').length,
  };
}

export const vistaResumen = {
  tab: 'resumen',
  render(main, params) {
    setTitulo('Resumen', '');
    const hoyMes = mesDe(todayISO());
    if (!mes) mes = hoyMes;
    const d = datosMes(mes);
    const wrap = el('div', { class: 'wrap' });
    main.append(wrap);

    // Navegación entre meses
    wrap.append(el('div', { class: 'mes-nav' },
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mes anterior', text: '‹', onclick: () => { mes = moverMes(mes, -1); recargar(); } }),
      el('h2', { text: nombreMes(mes) }),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Mes siguiente', text: '›', disabled: mes >= hoyMes, onclick: () => { mes = moverMes(mes, 1); recargar(); } })));

    const tile = (lbl, val, sub, grande) => el('div', { class: 'stat' + (grande ? ' big' : '') }, el('span', { class: 'lbl', text: lbl }), el('b', { text: val }), sub ? el('small', { text: sub }) : null);
    const porCobrar = db.trabajos.filter((t) => t.estado === 'listo' && t.informe && typeof t.informe.total === 'number');
    wrap.append(el('div', { class: 'stats' },
      tile('Facturado', fmt(d.facturado), d.entregados.length ? 'con ' + d.entregados.length + (d.entregados.length === 1 ? ' equipo entregado' : ' equipos entregados') : 'sin entregas este mes', true),
      tile('Ticket promedio', d.ticket != null ? fmt(d.ticket) : '-'),
      tile('Equipos recibidos', String(d.recibidos)),
      tile('Días en el taller', d.dias != null ? d.dias.toFixed(1).replace('.', ',') : '-', 'promedio, de que entra a que sale'),
      tile('Reseñas', d.pedidas ? d.dejadas + ' de ' + d.pedidas : '-', d.pedidas ? 'dejadas de las que pediste' : 'no pediste este mes'),
      tile('Presupuestos', d.presEnviados ? d.presAprobados + ' de ' + d.presEnviados : '-', d.presEnviados ? 'aprobados (' + Math.round(d.presAprobados * 100 / d.presEnviados) + '%)' : 'ninguno este mes'),
      mes === hoyMes && porCobrar.length ? tile('Listos sin entregar', fmt(porCobrar.reduce((s, t) => s + t.informe.total, 0)), porCobrar.length + (porCobrar.length === 1 ? ' equipo' : ' equipos') + ' para retirar', true) : null));

    // Por tipo de equipo
    if (d.entregados.length) {
      const max = Math.max(...EQUIPOS.map((e) => d.entregados.filter((t) => t.equipo.tipo === e.id).length));
      wrap.append(el('section', { class: 'blk' }, el('h2', { text: 'Qué entregaste' }),
        ...EQUIPOS.map((e) => {
          const n = d.entregados.filter((t) => t.equipo.tipo === e.id).length;
          return n ? barra(e.nombre, n, n / max, String(n)) : null;
        })));
    }

    // Últimos 6 meses
    const ult = [];
    for (let i = 5; i >= 0; i--) { const m = moverMes(hoyMes, -i); ult.push({ m, v: datosMes(m).facturado }); }
    const maxV = Math.max(1, ...ult.map((x) => x.v));
    if (ult.some((x) => x.v)) {
      wrap.append(el('section', { class: 'blk' }, el('h2', { text: 'Últimos 6 meses' }),
        ...ult.map((x) => barra(MESES[+x.m.slice(5, 7) - 1].slice(0, 3), x.v, x.v / maxV, x.v ? fmt(x.v) : '-', x.m === mes))));
    }

    // Para volver a contactar
    const rec = paraRecordar();
    const secRec = el('section', { class: 'blk', id: 'res-recordar' }, el('h2', { text: 'Para volver a contactar' }),
      el('p', { class: 'hint', text: 'Clientes a los que les hiciste una limpieza hace un año o más y no volvieron. El mensaje les recuerda la limpieza anual.' }));
    if (!rec.length) secRec.append(el('p', { class: 'hint', text: 'Por ahora nadie. Van a ir apareciendo solos.' }));
    rec.forEach((t) => {
      secRec.append(el('div', { class: 'rowcard' },
        el('div', { class: 'rec-hd' },
          el('b', { text: t.cliente.nombre.trim() || 'Sin nombre' }),
          el('span', { class: 'hint', text: [equipoNombre(t.equipo.tipo), t.equipo.marca].filter((x) => String(x).trim()).join(' ') + ' · entregado el ' + fechaFmt(entregaDe(t)) })),
        el('div', { class: 'row-btns' },
          el('button', { type: 'button', class: 'btn small primary', text: 'Mandar recordatorio', onclick: () => { abrirWhatsApp(t.cliente.tel, mensajeRecordatorio(t)); t.recordatorio = stampISO(); guardarTrabajo(t); recargar(); } }),
          el('button', { type: 'button', class: 'btn small', text: 'Ver ficha', onclick: () => ir('trabajo', { id: t.id }) }),
          el('button', { type: 'button', class: 'btn small ghost', text: 'Descartar', onclick: () => { t.recordatorio = 'descartado'; guardarTrabajo(t); toast('Listo, no aparece más'); recargar(); } }))));
    });
    wrap.append(secRec);

    if (params.ir === 'recordar') setTimeout(() => secRec.scrollIntoView({ block: 'start' }), 50);
  },
};

function barra(lbl, n, frac, txt, marcada) {
  return el('div', { class: 'barra' + (marcada ? ' on' : '') },
    el('span', { class: 'barra-l', text: lbl }),
    el('span', { class: 'barra-t' }, el('span', { class: 'barra-f', style: 'width:' + Math.max(2, Math.round(frac * 100)) + '%' })),
    el('span', { class: 'barra-v', text: txt }));
}
