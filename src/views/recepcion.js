// Recepción de equipos: la ficha que antes era el artefacto "Recepción Mario PC".

import { el, campo, debounce, toast } from '../util.js';
import { db, trabajoVacio, guardarTrabajo, trabajoPorId, siguienteOrden } from '../store.js';
import { EQUIPOS, ACCESORIOS, DANOS, CLAVES } from '../catalog.js';
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
    const tel = campo('Teléfono / WhatsApp', { type: 'tel', inputmode: 'tel', maxlength: '24', value: t.cliente.tel, placeholder: '11 5555 1234' }, (v) => { t.cliente.tel = v; cambio(); });

    // Equipo
    const tipos = radios('tipo-eq', EQUIPOS, () => t.equipo.tipo, (v) => { t.equipo.tipo = v; cambio(); });
    const marca = campo('Marca', { maxlength: '30', value: t.equipo.marca, autocapitalize: 'words' }, (v) => { t.equipo.marca = v; cambio(); });
    const modelo = campo('Modelo', { maxlength: '40', value: t.equipo.modelo }, (v) => { t.equipo.modelo = v; cambio(); });
    const serie = campo('N° de serie / IMEI', { maxlength: '32', value: t.equipo.serie, autocapitalize: 'characters' }, (v) => { t.equipo.serie = v; cambio(); });

    const falla = campo('Falla que reporta', { multiline: true, rows: '3', maxlength: '240', value: t.falla, placeholder: 'Qué le pasa al equipo, con las palabras del cliente' }, (v) => { t.falla = v; cambio(); });

    const acc = chips(ACCESORIOS.map((a) => ({ id: a, nombre: a })), t.acc, cambio);
    const accOtro = campo('Otro accesorio', { maxlength: '40', value: t.accOtro }, (v) => { t.accOtro = v; cambio(); });
    const danos = chips(DANOS, t.danos, cambio);
    const danoOtro = campo('Otro daño', { maxlength: '40', value: t.danoOtro, placeholder: 'Algo corto que no esté en la lista' }, (v) => { t.danoOtro = v; cambio(); });
    const claves = radios('clave', CLAVES, () => t.clave, (v) => { t.clave = v; cambio(); });
    const obs = campo('Observaciones', { multiline: true, rows: '2', maxlength: '200', value: t.obs, placeholder: 'Opcional. Sale solo en el comprobante A4' }, (v) => { t.obs = v; cambio(); });

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
      el('div', { class: 'two head2' }, orden.wrap, fecha.wrap),
      bloque('Cliente', el('div', { class: 'two' }, nombre.wrap, tel.wrap)),
      bloque('Equipo', tipos, el('div', { class: 'two' }, marca.wrap, modelo.wrap), serie.wrap),
      bloque('Falla', falla.wrap),
      bloque('Accesorios que deja', acc, accOtro.wrap, el('p', { class: 'hint', text: 'Si no tildás nada, figura "Ninguno".' })),
      bloque('Estado físico al recibir', danos, danoOtro.wrap, el('p', { class: 'hint', text: 'Si no tildás nada, figura "Sin daños visibles".' })),
      bloque('Clave de acceso', claves, el('p', { class: 'hint', text: 'Solo se anota si tiene o no. La clave no se escribe ni se imprime.' })),
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
