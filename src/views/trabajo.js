// Ficha de un trabajo: estado, acciones y todos los datos.

import { el, fmt, fechaFmt, haceCuanto, botonConfirmar, toast, diaCorto } from '../util.js';
import { db, trabajoPorId, guardarTrabajo, borrarTrabajo } from '../store.js';
import { ESTADOS, equipoNombre, claveNombre, RESULTADOS } from '../catalog.js';
import { accList, danoList } from '../render/recepcion.js';
import { imprimirEtiqueta, compartirComprobante, compartirEtiqueta, compartirInforme, avisarListo, mensajeInforme } from '../acciones.js';
import { abrirWhatsApp, llamar } from '../files.js';
import { ir, atras, setTitulo, setAcciones, hoja } from '../nav.js';

export const vistaTrabajo = {
  tab: 'trabajos',
  render(main, params) {
    const t = trabajoPorId(params.id);
    if (!t) { main.append(el('p', { class: 'hint pad', text: 'Esta ficha ya no existe.' })); return; }
    setTitulo('Orden N° ' + t.orden, '');
    setAcciones([el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Editar ficha', text: '✎', onclick: () => ir('recepcion', { id: t.id }) })]);

    const wrap = el('div', { class: 'wrap' });
    main.append(wrap);

    if (params.recien) {
      params.recien = false;
      wrap.append(el('div', { class: 'notice ok' }, el('p', { text: 'Ficha guardada. Imprimí la etiqueta y pasale el comprobante al cliente.' })));
    }

    // Cabecera
    const estados = el('div', { class: 'steps', role: 'radiogroup', 'aria-label': 'Estado del trabajo' });
    function pintarEstados() {
      estados.replaceChildren(...ESTADOS.map((e, i) => el('button', {
        type: 'button', role: 'radio', 'aria-checked': String(t.estado === e.id),
        class: 'step' + (ESTADOS.findIndex((x) => x.id === t.estado) >= i ? ' done' : ''),
        onclick: () => cambiarEstado(e.id),
      }, el('span', { class: 'dot' }), el('span', { text: e.corto }))));
    }
    function cambiarEstado(id) {
      if (t.estado === id) return;
      t.estado = id; guardarTrabajo(t); pintarEstados();
      if (id === 'listo') hoja('Equipo listo', (cerrar) => [
        el('p', { class: 'sheet-p', text: '¿Le aviso a ' + (t.cliente.nombre.trim() || 'el cliente') + ' por WhatsApp que ya puede retirarlo?' }),
        el('div', { class: 'stack' },
          el('button', { type: 'button', class: 'btn primary', text: 'Avisar por WhatsApp', onclick: () => { cerrar(); avisarListo(t); } }),
          el('button', { type: 'button', class: 'btn', text: 'Ahora no', onclick: cerrar })),
      ]);
      if (id === 'entregado' && !(t.informe && t.informe.generado)) hoja('Equipo entregado', (cerrar) => [
        el('p', { class: 'sheet-p', text: 'Todavía no armaste el informe técnico de este trabajo.' }),
        el('div', { class: 'stack' },
          el('button', { type: 'button', class: 'btn primary', text: 'Armar el informe', onclick: () => { cerrar(); ir('informe', { id: t.id }); } }),
          el('button', { type: 'button', class: 'btn', text: 'Ahora no', onclick: cerrar })),
      ]);
    }
    pintarEstados();

    wrap.append(el('div', { class: 'hero' },
      el('div', { class: 'hero-n' }, el('small', { text: 'N°' }), t.orden),
      el('div', { class: 'hero-txt' },
        el('p', { class: 'hero-cli', text: t.cliente.nombre.trim() || 'Sin nombre' }),
        el('p', { class: 'hero-eq', text: [equipoNombre(t.equipo.tipo), t.equipo.marca, t.equipo.modelo].filter((x) => String(x).trim()).join(' ') }),
        el('p', { class: 'hint', text: 'Entró el ' + fechaFmt(t.fecha) + ' (' + haceCuanto(t.fecha) + ')' }),
        t.entrega ? el('p', { class: 'hero-due', text: 'Entrega prometida: ' + diaCorto(t.entrega) }) : null)),
      estados);

    // Acciones
    const lblEtiqueta = el('span', { text: 'Imprimir etiqueta' });
    const btnEtiqueta = el('button', { type: 'button', class: 'act primary' }, el('span', { class: 'act-i', text: '▤' }), lblEtiqueta);
    btnEtiqueta.addEventListener('click', () => imprimirEtiqueta(t, lblEtiqueta));
    const tieneInforme = t.informe && t.informe.generado;
    wrap.append(el('div', { class: 'acts' },
      btnEtiqueta,
      el('button', { type: 'button', class: 'act', onclick: () => compartirComprobante(t) }, el('span', { class: 'act-i', text: '⎙' }), 'Comprobante A4'),
      el('button', { type: 'button', class: 'act', onclick: () => ir('informe', { id: t.id }) }, el('span', { class: 'act-i', text: '✓' }), tieneInforme ? 'Ver informe' : 'Armar informe'),
      el('button', { type: 'button', class: 'act', onclick: () => avisarListo(t) }, el('span', { class: 'act-i', text: '✆' }), 'Avisar que está listo')));
    wrap.append(el('button', { type: 'button', class: 'linkbtn', text: '¿No imprime? Mandar la etiqueta a la app de Phomemo', onclick: () => compartirEtiqueta(t) }));

    // Informe
    if (tieneInforme) {
      const res = RESULTADOS.find((r) => r.id === t.informe.resultado) || RESULTADOS[0];
      wrap.append(seccion('Informe técnico',
        fila('Resultado', res.nombre),
        fila('Entregado', fechaFmt(t.informe.fechaEntrega)),
        t.informe.total != null ? fila('Importe', fmt(t.informe.total)) : null,
        el('div', { class: 'row-btns' },
          el('button', { type: 'button', class: 'btn small primary', text: 'Compartir PDF', onclick: () => compartirInforme(t) }),
          el('button', { type: 'button', class: 'btn small', text: 'Mensaje al cliente', onclick: () => abrirWhatsApp(t.cliente.tel, mensajeInforme(t)) }))));
    }

    // Datos
    const tel = t.cliente.tel.trim();
    wrap.append(seccion('Cliente',
      fila('Nombre', t.cliente.nombre.trim() || '-'),
      fila('Teléfono', tel || '-'),
      tel ? el('div', { class: 'row-btns' },
        el('button', { type: 'button', class: 'btn small', text: 'WhatsApp', onclick: () => abrirWhatsApp(tel, '') }),
        el('button', { type: 'button', class: 'btn small', text: 'Llamar', onclick: () => llamar(tel) })) : null));
    wrap.append(seccion('Equipo',
      fila('Tipo', equipoNombre(t.equipo.tipo)),
      fila('Marca', t.equipo.marca.trim() || '-'),
      fila('Modelo', t.equipo.modelo.trim() || '-'),
      fila('N° de serie', t.equipo.serie.trim() || '-'),
      fila('Clave', t.clave === 'no' ? 'No tiene' : claveNombre(t.clave) + ' (no anotada)')));
    wrap.append(seccion('Falla que reportó', el('p', { class: 'para', text: t.falla.trim() || '-' })));
    wrap.append(seccion('Al recibirlo',
      fila('Accesorios', accList(t).join(', ') || 'Ninguno'),
      fila('Estado físico', danoList(t, false).join(', ') || 'Sin daños visibles'),
      t.obs.trim() ? fila('Observaciones', t.obs.trim()) : null));

    const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
    if (pres) {
      wrap.append(seccion('Presupuesto aprobado',
        ...pres.lines.map((l) => fila(l.nombre + (l.qty > 1 ? ' ×' + l.qty : ''), l.precio == null ? 'a confirmar' : fmt(l.precio * l.qty))),
        fila(pres.missing ? 'Total parcial' : 'Total', fmt(pres.total), true)));
    }

    wrap.append(el('div', { class: 'danger-zone' },
      botonConfirmar('Borrar esta ficha', '¿Seguro? Tocá de nuevo para borrar', () => {
        borrarTrabajo(t.id); toast('Ficha borrada'); atras();
      })));
  },
};

function seccion(titulo, ...hijos) {
  return el('section', { class: 'blk info' }, el('h2', { text: titulo }), ...hijos);
}
function fila(k, v, fuerte) {
  return el('div', { class: 'kv' + (fuerte ? ' strong' : '') }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
}
