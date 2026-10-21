// Recepción de equipos: la ficha que antes era el artefacto "Recepción Mario PC".

import { el, campo, debounce, toast, addDays, sumarHabiles, diaCorto, fechaCorta, fechaFmt, dinero, todayISO } from '../util.js';
import { db, trabajoVacio, guardarTrabajo, trabajoPorId, siguienteOrden, trabajosDelCliente, pagoVacio } from '../store.js';
import { EQUIPOS, ACCESORIOS, DANOS, CLAVES, equipoNombre } from '../catalog.js';
import { lienzoEtiqueta, lienzoComprobante } from '../acciones.js';
import { ir, atras, setTitulo } from '../nav.js';

export const vistaRecepcion = {
  tab: (p) => (p.id ? 'trabajos' : 'recibir'),
  render(main, params) {
    const editando = params.id ? trabajoPorId(params.id) : null;
    const t = editando ? JSON.parse(JSON.stringify(editando)) : Object.assign(trabajoVacio(), params.prefill ? JSON.parse(JSON.stringify(params.prefill)) : {});
    if (!editando) t.orden = String(siguienteOrden());
    let sucio = false, guardado = false;
    vistaRecepcion.antesDeSalir = () => {
      if (!sucio || guardado) return true;
      return window.confirm('¿Salir sin guardar la ficha?');
    };
    setTitulo(editando ? 'Editar ficha' : 'Recibir equipo', editando ? 'Orden N° ' + t.orden : '');

    const cambio = () => { sucio = true; vistaPrevia(); };

    // Encabezado: N° y fecha
    const orden = campo('N° de orden', { inputmode: 'numeric', maxlength: '6', value: t.orden, class: 'big-num' }, (v, i) => {
      const d = v.replace(/\D/g, ''); i.value = d; t.orden = d; cambio(); barN.textContent = 'N° ' + (d || '-');
    });
    const fecha = campo('Fecha', { type: 'date', value: t.fecha }, (v) => { t.fecha = v; cambio(); });

    // Cliente
    const nombre = campo('Nombre y apellido', { maxlength: '60', value: t.cliente.nombre, autocapitalize: 'words' }, (v) => { t.cliente.nombre = v; cambio(); });
    const tel = campo('Teléfono / WhatsApp', { type: 'tel', inputmode: 'tel', maxlength: '24', value: t.cliente.tel, placeholder: '11 5555 1234' }, (v) => { t.cliente.tel = v; cambio(); pintarHistorial(); });
    // Si el cliente ya vino antes, se avisa (y se puede completar el nombre)
    const historial = el('div', { class: 'hist-hint', hidden: true });
    function pintarHistorial() {
      const prev = trabajosDelCliente(t.cliente.tel, t.id);
      historial.hidden = !prev.length;
      if (!prev.length) { historial.replaceChildren(); return; }
      const u = prev[0];
      const txt = 'Ya vino ' + (prev.length === 1 ? '1 vez' : prev.length + ' veces') + '. Última: N° ' + u.orden + ', ' +
        [equipoNombre(u.equipo.tipo), u.equipo.marca].filter((x) => String(x).trim()).join(' ') + ' (' + fechaCorta(u.fecha) + ').';
      const nom = u.cliente.nombre.trim();
      historial.replaceChildren(el('p', { text: txt }),
        nom && !t.cliente.nombre.trim() ? el('button', { type: 'button', class: 'btn small', text: 'Usar nombre: ' + nom, onclick: () => {
          t.cliente.nombre = nom; nombre.input.value = nom; cambio(); pintarHistorial();
        } }) : null);
    }
    pintarHistorial();

    // Equipo
    const tipos = radios('tipo-eq', EQUIPOS, () => t.equipo.tipo, (v) => { t.equipo.tipo = v; cambio(); });
    const marca = campo('Marca', { maxlength: '30', value: t.equipo.marca, autocapitalize: 'words' }, (v) => { t.equipo.marca = v; cambio(); });
    const modelo = campo('Modelo', { maxlength: '40', value: t.equipo.modelo }, (v) => { t.equipo.modelo = v; cambio(); });
    const serie = campo('N° de serie / IMEI', { maxlength: '32', value: t.equipo.serie, autocapitalize: 'characters' }, (v) => { t.equipo.serie = v; cambio(); });

    // Entrega prometida: opcional, con atajos
    if (t.entrega == null) t.entrega = '';
    const entrega = campo('Fecha', { type: 'date', value: t.entrega }, (v) => { t.entrega = v; cambio(); pintarAtajos(); });
    const atajos = el('div', { class: 'chips' });
    function pintarAtajos() {
      const base = t.fecha || undefined;
      const ops = [['Sin fecha', ''], ['Mañana', addDays(base, 1)], ['3 días hábiles', sumarHabiles(base, 3)], ['1 semana', addDays(base, 7)]];
      atajos.replaceChildren(...ops.map(([n, v]) => el('button', {
        type: 'button', class: 'fchip', 'aria-pressed': String((t.entrega || '') === v),
        onclick: () => { t.entrega = v; entrega.input.value = v; cambio(); pintarAtajos(); },
      }, n, v ? el('span', { class: 'fcount', text: diaCorto(v) }) : null)));
    }
    pintarAtajos();
    const falla = campo('Falla que reporta', { multiline: true, rows: '3', maxlength: '240', value: t.falla, placeholder: 'Qué le pasa al equipo, con las palabras del cliente' }, (v) => { t.falla = v; cambio(); });

    const acc = chips(ACCESORIOS.map((a) => ({ id: a, nombre: a })), t.acc, cambio);
    const accOtro = campo('Otro accesorio', { maxlength: '40', value: t.accOtro }, (v) => { t.accOtro = v; cambio(); });
    const danos = chips(DANOS, t.danos, cambio);
    const danoOtro = campo('Otro daño', { maxlength: '40', value: t.danoOtro, placeholder: 'Algo corto que no esté en la lista' }, (v) => { t.danoOtro = v; cambio(); });
    if (t.claveValor == null) t.claveValor = '';
    const claveCampo = campo('La clave (solo queda en la app)', { maxlength: '60', value: t.claveValor, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' }, (v) => { t.claveValor = v; sucio = true; });
    function pintarClave() {
      claveCampo.wrap.hidden = t.clave === 'no';
      claveCampo.input.setAttribute('inputmode', t.clave === 'pin' ? 'numeric' : 'text');
      claveCampo.input.placeholder = t.clave === 'pin' ? 'Ej: 1234' : t.clave === 'patron' ? 'Ej: L desde arriba a la izquierda' : 'La contraseña del equipo';
    }
    const claves = radios('clave', CLAVES, () => t.clave, (v) => { t.clave = v; if (v === 'no') { t.claveValor = ''; claveCampo.input.value = ''; } pintarClave(); cambio(); });
    pintarClave();
    // Seña
    if (!t.pago) t.pago = pagoVacio();
    const senaMonto = el('div', { class: 'field' }, el('label', { text: 'Monto' }), dinero(t.pago.sena, (v) => {
      t.pago.sena = v == null || v === 0 ? null : Math.abs(v);
      t.pago.senaFecha = t.pago.sena ? (t.pago.senaFecha || todayISO()) : null;
      cambio();
    }));
    const senaMedio = radios('sena-medio', [{ id: 'efectivo', nombre: 'Efectivo' }, { id: 'mp', nombre: 'Mercado Pago' }], () => t.pago.senaMedio || 'efectivo', (v) => { t.pago.senaMedio = v; cambio(); });
    const obs = campo('Observaciones', { multiline: true, rows: '2', maxlength: '200', value: t.obs, placeholder: 'Opcional. Sale en el comprobante A4: no anotes la clave acá' }, (v) => { t.obs = v; cambio(); });

    // Vista previa
    const pvTabs = el('div', { class: 'seg2', role: 'tablist' });
    const pvSlot = el('div', { class: 'paper' });
    let pv = 'etiqueta';
    function pintarTabs() {
      pvTabs.replaceChildren(...[['etiqueta', 'Etiqueta'], ['a4', 'Comprobante A4']].map(([id, n]) =>
        el('button', { type: 'button', role: 'tab', 'aria-selected': String(pv === id), text: n, onclick: () => { pv = id; pintarTabs(); vistaPreviaYa(); } })));
    }
    async function vistaPreviaYa() {
      const cv = pv === 'etiqueta' ? await lienzoEtiqueta(t) : await lienzoComprobante(t);
      pvSlot.classList.toggle('a4', pv === 'a4');
      pvSlot.replaceChildren(cv);
    }
    const vistaPrevia = debounce(vistaPreviaYa, 250);
    pintarTabs(); vistaPreviaYa();

    const barN = el('strong', { text: 'N° ' + t.orden });
    const guardarBtn = el('button', { type: 'button', class: 'btn primary', text: editando ? 'Guardar cambios' : 'Guardar ficha', onclick: guardar });

    function guardar() {
      const n = parseInt(t.orden, 10);
      if (!isFinite(n) || n <= 0) { toast('Poné el número de orden'); orden.input.focus(); return; }
      const dup = db.trabajos.find((x) => x.id !== t.id && String(parseInt(x.orden, 10)) === String(n));
      if (dup && !window.confirm('Ya hay una ficha con el N° ' + n + ' (' + (dup.cliente.nombre || 'sin nombre') + '). ¿Guardar igual?')) return;
      t.orden = String(n);
      guardarTrabajo(t);
      guardado = true;
      if (editando) { toast('Cambios guardados'); atras(); }
      else ir('trabajo', { id: t.id, recien: true }, { reemplazar: true });
    }

    main.append(el('div', { class: 'wrap form' },
      t.garantiaDe ? el('div', { class: 'notice ok' }, el('p', { text: 'Reclamo de garantía del trabajo N° ' + t.garantiaDe.orden + ' (' + fechaFmt(t.garantiaDe.fecha) + '). Sale así en el comprobante y el informe arranca sin cargo.' })) : null,
      el('div', { class: 'two head2' }, orden.wrap, fecha.wrap),
      bloque('Cliente', el('div', { class: 'two' }, nombre.wrap, tel.wrap), historial),
      bloque('Equipo', tipos, el('div', { class: 'two' }, marca.wrap, modelo.wrap), serie.wrap),
      bloque('Falla', falla.wrap),
      bloque('Entrega prometida', atajos, entrega.wrap, el('p', { class: 'hint', text: 'Opcional. Si la ponés, sale grande en la etiqueta.' })),
      bloque('Accesorios que deja', acc, accOtro.wrap, el('p', { class: 'hint', text: 'Si no tildás nada, figura "Ninguno".' })),
      bloque('Estado físico al recibir', danos, danoOtro.wrap, el('p', { class: 'hint', text: 'Si no tildás nada, figura "Sin daños visibles".' })),
      bloque('Clave de acceso', claves, claveCampo.wrap, el('p', { class: 'hint', text: 'La clave no sale en la etiqueta, el comprobante ni el respaldo, y se borra sola cuando marcás el equipo como entregado.' })),
      bloque('Seña', el('div', { class: 'two' }, senaMonto, el('div', { class: 'field' }, el('label', { text: 'Forma de pago' }), senaMedio)),
        el('p', { class: 'hint', text: 'Opcional. Sale en el comprobante, con el aviso de que no se devuelve si cancela el trabajo.' })),
      bloque('Observaciones', obs.wrap),
      bloque('Vista previa', pvTabs, pvSlot)),
      el('div', { class: 'bar' }, el('div', { class: 't' }, el('span', { class: 'lbl', text: editando ? 'Editando' : 'Nueva ficha' }), barN), guardarBtn));

    return () => { vistaRecepcion.antesDeSalir = null; };
  },
};

export function bloque(titulo, ...hijos) {
  return el('section', { class: 'blk' }, el('h2', { text: titulo }), ...hijos);
}

export function radios(name, items, get, set) {
  const box = el('div', { class: 'seg', role: 'radiogroup' });
  const grupo = name + '-' + Math.random().toString(36).slice(2, 8); // un solo nombre para todo el grupo
  items.forEach((it) => {
    const inp = el('input', { type: 'radio', name: grupo, value: it.id, checked: get() === it.id });
    inp.addEventListener('change', () => { if (inp.checked) set(it.id); });
    box.append(el('label', { class: 'opt' }, inp, el('span', { text: it.nombre })));
  });
  return box;
}

// Casillas tipo "chip". arr se modifica en el lugar.
export function chips(items, arr, onChange) {
  const box = el('div', { class: 'chips' });
  items.forEach((it) => {
    const inp = el('input', { type: 'checkbox', checked: arr.includes(it.id) });
    inp.addEventListener('change', () => {
      const i = arr.indexOf(it.id);
      if (inp.checked && i < 0) arr.push(it.id);
      if (!inp.checked && i > -1) arr.splice(i, 1);
      onChange();
    });
    box.append(el('label', { class: 'opt chip' }, inp, el('span', { text: it.nombre })));
  });
  return box;
}
