// Ficha de un trabajo: estado, acciones y todos los datos.

import { el, fmt, fechaFmt, fechaCorta, haceCuanto, botonConfirmar, toast, diaCorto } from '../util.js';
import { db, trabajoPorId, guardarTrabajo, borrarTrabajo, trabajosDelCliente, clienteDejoResena } from '../store.js';
import { ESTADOS, equipoNombre, claveNombre, estadoCorto, RESULTADOS } from '../catalog.js';
import { accList, danoList } from '../render/recepcion.js';
import { imprimirEtiqueta, verComprobante, enviarComprobante, compartirEtiqueta, verInforme, avisarListo, mensajeInforme, marcarResenaPedida } from '../acciones.js';
import { abrirWhatsApp, llamar } from '../files.js';
import { ir, atras, setTitulo, setAcciones, hoja, recargar } from '../nav.js';
import { seccionRetiro, seccionCobro, seccionGanancia, seccionFotos, botonGarantia, registrarPago } from './cobro.js';
import { borrarFotosDe } from '../fotos.js';

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
      wrap.append(el('div', { class: 'notice ok' }, el('p', { text: 'Ficha guardada. Imprimí la etiqueta, sacale fotos al equipo y pasale el comprobante al cliente.' })));
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
      const teniaClave = !!t.claveValor;
      t.estado = id; guardarTrabajo(t); pintarEstados();
      if (id === 'entregado' && teniaClave) { toast('Entregado. Borré la clave del cliente'); pintarClave(); }
      if (id === 'listo') hoja('Equipo listo', (cerrar) => [
        el('p', { class: 'sheet-p', text: '¿Le aviso a ' + (t.cliente.nombre.trim() || 'el cliente') + ' por WhatsApp que ya puede retirarlo?' }),
        el('div', { class: 'stack' },
          el('button', { type: 'button', class: 'btn primary', text: 'Avisar por WhatsApp', onclick: () => { cerrar(); avisarListo(t); } }),
          el('button', { type: 'button', class: 'btn', text: 'Ahora no', onclick: cerrar })),
      ]);
      if (id === 'entregado' && t.informe && t.informe.generado && !(t.pago && t.pago.pagado)) registrarPago(t, recargar);
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
        t.entrega ? el('p', { class: 'hero-due', text: 'Entrega prometida: ' + diaCorto(t.entrega) }) : null,
        t.garantiaDe ? el('button', { type: 'button', class: 'garantia-tag', text: 'Garantía del N° ' + t.garantiaDe.orden, onclick: () => ir('trabajo', { id: t.garantiaDe.id }) }) : null)),
      estados);
    const retiro = seccionRetiro(t);
    if (retiro) wrap.append(retiro);

    // Acciones
    const lblEtiqueta = el('span', { text: 'Imprimir etiqueta' });
    const btnEtiqueta = el('button', { type: 'button', class: 'act primary' }, el('span', { class: 'act-i', text: '▤' }), lblEtiqueta);
    btnEtiqueta.addEventListener('click', () => imprimirEtiqueta(t, lblEtiqueta));
    const tieneInforme = t.informe && t.informe.generado;
    wrap.append(el('div', { class: 'acts' },
      btnEtiqueta,
      el('button', { type: 'button', class: 'act', onclick: () => verComprobante(t) }, el('span', { class: 'act-i', text: '⎙' }), 'Comprobante A4'),
      el('button', { type: 'button', class: 'act', onclick: () => ir('informe', { id: t.id }) }, el('span', { class: 'act-i', text: '✓' }), tieneInforme ? 'Ver informe' : 'Armar informe'),
      el('button', { type: 'button', class: 'act', onclick: () => avisarListo(t) }, el('span', { class: 'act-i', text: '✆' }), 'Avisar que está listo')));
    wrap.append(el('button', { type: 'button', class: 'linkbtn', text: 'Mandar el comprobante por WhatsApp (sin firmas), sin vista previa', onclick: () => enviarComprobante(t) }));
    wrap.append(el('button', { type: 'button', class: 'linkbtn', text: '¿No imprime? Mandar la etiqueta a la app de Phomemo', onclick: () => compartirEtiqueta(t) }));
    const gar = botonGarantia(t);
    if (gar) wrap.append(gar);

    // Informe
    if (tieneInforme) {
      const res = RESULTADOS.find((r) => r.id === t.informe.resultado) || RESULTADOS[0];
      // Reseña en Google: cuándo se pidió y si la dejó
      const resena = el('div');
      const pintarResena = () => {
        const otraVez = !t.resenaDejo && clienteDejoResena(t);
        resena.replaceChildren(
          fila('Reseña en Google', t.resenaDejo ? 'La dejó' : otraVez ? 'Ya dejó en otro trabajo' : t.resenaPedida ? 'Pedida el ' + fechaCorta(t.resenaPedida) : 'Sin pedir'),
          el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: !!t.resenaDejo, onchange: (e) => { t.resenaDejo = e.target.checked; guardarTrabajo(t); pintarResena(); } }),
            el('span', { text: 'Ya dejó la reseña' })));
      };
      pintarResena();
      wrap.append(seccion('Informe técnico',
        fila('Resultado', res.nombre),
        fila('Entregado', fechaFmt(t.informe.fechaEntrega)),
        t.informe.total != null ? fila('Importe', fmt(t.informe.total)) : null,
        resena,
        el('div', { class: 'row-btns' },
          el('button', { type: 'button', class: 'btn small primary', text: 'Ver PDF', onclick: () => verInforme(t, () => pintarResena()) }),
          el('button', { type: 'button', class: 'btn small', text: 'Mensaje al cliente', onclick: () => { abrirWhatsApp(t.cliente.tel, mensajeInforme(t)); marcarResenaPedida(t); pintarResena(); } }))));
    }

    // Clave: oculta hasta tocar "Ver"
    const claveBox = el('div');
    function pintarClave(ver) {
      if (t.clave === 'no') { claveBox.replaceChildren(fila('Clave', 'No tiene')); return; }
      if (!t.claveValor) { claveBox.replaceChildren(fila('Clave', claveNombre(t.clave) + (t.estado === 'entregado' ? ' (borrada al entregar)' : ' (no anotada)'))); return; }
      claveBox.replaceChildren(el('div', { class: 'kv' }, el('span', { class: 'k', text: 'Clave (' + claveNombre(t.clave) + ')' }),
        el('span', { class: 'v clave-v' }, el('span', { class: ver ? 'clave-on' : '', text: ver ? t.claveValor : '••••' }),
          el('button', { type: 'button', class: 'btn small', text: ver ? 'Ocultar' : 'Ver', onclick: () => pintarClave(!ver) }))));
    }
    pintarClave(false);

    // Cobro y ganancia
    wrap.append(seccionCobro(t));
    if (tieneInforme || (t.pago && t.pago.pagado)) wrap.append(seccionGanancia(t));

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
      claveBox));
    wrap.append(seccion('Falla que reportó', el('p', { class: 'para', text: t.falla.trim() || '-' })));
    wrap.append(seccion('Al recibirlo',
      fila('Accesorios', accList(t).join(', ') || 'Ninguno'),
      fila('Estado físico', danoList(t, false).join(', ') || 'Sin daños visibles'),
      t.obs.trim() ? fila('Observaciones', t.obs.trim()) : null));
    wrap.append(seccionFotos(t));

    const otros = trabajosDelCliente(t.cliente.tel, t.id);
    if (otros.length) {
      wrap.append(seccion('Otros trabajos de este cliente', ...otros.slice(0, 8).map((x) => el('button', { type: 'button', class: 'hist-row', onclick: () => ir('trabajo', { id: x.id }) },
        el('span', { class: 'hist-n', text: 'N° ' + x.orden }),
        el('span', { class: 'hist-eq', text: [equipoNombre(x.equipo.tipo), x.equipo.marca].filter((v) => String(v).trim()).join(' ') + ' · ' + fechaCorta(x.fecha) + '/' + String(x.fecha).slice(2, 4) }),
        el('span', { class: 'badge b-' + x.estado, text: estadoCorto(x.estado) })))));
    }

    const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
    if (pres) {
      wrap.append(seccion('Presupuesto aprobado',
        ...pres.lines.map((l) => fila(l.nombre + (l.qty > 1 ? ' ×' + l.qty : ''), l.precio == null ? 'a confirmar' : fmt(l.precio * l.qty))),
        fila(pres.missing ? 'Total parcial' : 'Total', fmt(pres.total), true)));
    }

    wrap.append(el('div', { class: 'danger-zone' },
      botonConfirmar('Borrar esta ficha', '¿Seguro? Tocá de nuevo para borrar', () => {
        borrarFotosDe(t); borrarTrabajo(t.id); toast('Ficha borrada'); atras();
      })));
  },
};

function seccion(titulo, ...hijos) {
  return el('section', { class: 'blk info' }, el('h2', { text: titulo }), ...hijos);
}
function fila(k, v, fuerte) {
  return el('div', { class: 'kv' + (fuerte ? ' strong' : '') }, el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v }));
}
