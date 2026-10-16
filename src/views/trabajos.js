// Pantalla principal: los equipos que entraron, del más nuevo al más viejo.

import { el, fechaCorta, haceCuanto, diasEntre, todayISO } from '../util.js';
import { db } from '../store.js';
import { ESTADOS, estadoCorto } from '../catalog.js';
import { equipoTexto } from '../render/recepcion.js';
import { ir, setTitulo, setAcciones } from '../nav.js';

let filtro = 'activos';
let busqueda = '';

export const vistaTrabajos = {
  tab: 'trabajos',
  render(main) {
    setTitulo('Trabajos', '');
    const lista = el('div', { class: 'cards' });
    const buscar = el('input', { type: 'search', class: 'search', placeholder: 'Buscar por nombre, N°, equipo o teléfono', value: busqueda, 'aria-label': 'Buscar trabajos', autocomplete: 'off' });
    buscar.addEventListener('input', () => { busqueda = buscar.value; pintarLista(); });

    const filtros = [
      { id: 'activos', nombre: 'En el taller' },
      { id: 'listo', nombre: 'Listos' },
      { id: 'entregado', nombre: 'Entregados' },
      { id: 'todos', nombre: 'Todos' },
    ];
    const chips = el('div', { class: 'filter-row', role: 'tablist' });
    function pintarChips() {
      chips.replaceChildren(...filtros.map((f) => {
        const n = contar(f.id);
        return el('button', { type: 'button', class: 'fchip', role: 'tab', 'aria-selected': String(filtro === f.id), onclick: () => { filtro = f.id; pintarChips(); pintarLista(); } },
          f.nombre, n ? el('span', { class: 'fcount', text: String(n) }) : null);
      }));
    }
    function contar(id) {
      return db.trabajos.filter((t) => pasa(t, id)).length;
    }
    function pasa(t, id) {
      if (id === 'todos') return true;
      if (id === 'activos') return t.estado === 'recibido' || t.estado === 'en_curso';
      return t.estado === id;
    }
    function coincide(t) {
      const q = busqueda.trim().toLowerCase();
      if (!q) return true;
      return [t.orden, t.cliente.nombre, t.cliente.tel, t.equipo.marca, t.equipo.modelo, t.equipo.serie, t.falla]
        .some((v) => String(v || '').toLowerCase().includes(q));
    }
    function pintarLista() {
      const q = busqueda.trim();
      const items = db.trabajos.filter((t) => (q ? true : pasa(t, filtro)) && coincide(t));
      lista.replaceChildren();
      if (!db.trabajos.length) {
        lista.append(el('div', { class: 'empty' },
          el('p', { class: 'empty-t', text: 'Todavía no recibiste equipos en la app' }),
          el('p', { class: 'hint', text: 'Cuando entre uno, tocá "Recibir equipo". Se imprime la etiqueta, sale el comprobante y queda guardado acá.' })));
        return;
      }
      if (!items.length) { lista.append(el('p', { class: 'hint pad', text: q ? 'No encontré nada con eso.' : 'No hay trabajos en esta lista.' })); return; }
      items.forEach((t) => lista.append(tarjeta(t)));
    }
    pintarChips(); pintarLista();

    const aviso = avisoRespaldo();
    main.append(el('div', { class: 'wrap' }, aviso, buscar, chips, lista));
    main.append(el('button', { type: 'button', class: 'fab', onclick: () => ir('recepcion', {}) }, el('span', { 'aria-hidden': 'true', text: '+' }), 'Recibir equipo'));
    setAcciones([]);
  },
};

function tarjeta(t) {
  const dias = diasEntre(t.fecha, todayISO());
  const demora = (t.estado === 'recibido' || t.estado === 'en_curso') && dias >= 7;
  return el('button', { type: 'button', class: 'card job', onclick: () => ir('trabajo', { id: t.id }) },
    el('span', { class: 'job-n' }, el('small', { text: 'N°' }), String(t.orden)),
    el('span', { class: 'job-main' },
      el('span', { class: 'job-cli', text: t.cliente.nombre.trim() || 'Sin nombre' }),
      el('span', { class: 'job-eq', text: equipoTexto(t) }),
      el('span', { class: 'job-meta' },
        el('span', { class: 'badge b-' + t.estado, text: estadoCorto(t.estado) }),
        el('span', { class: demora ? 'warn' : '', text: (t.estado === 'entregado' && t.informe ? 'Entregado ' + fechaCorta(t.informe.fechaEntrega) : 'Entró ' + haceCuanto(t.fecha)) }),
        t.informe && t.informe.generado ? el('span', { class: 'mini', text: 'Informe' }) : null)));
}

function avisoRespaldo() {
  if (db.trabajos.length < 3) return null;
  const ult = db.meta.ultimoBackup;
  const dias = ult ? diasEntre(ult, todayISO()) : null;
  if (dias != null && dias < 30) return null;
  return el('div', { class: 'notice' },
    el('p', { text: ult ? 'Tu último respaldo fue ' + haceCuanto(ult) + '. Si perdés el teléfono, se pierden las fichas.' : 'Todavía no hiciste un respaldo. Si perdés el teléfono, se pierden las fichas.' }),
    el('button', { type: 'button', class: 'btn small', text: 'Hacer respaldo', onclick: () => ir('ajustes', { ir: 'datos' }, { raiz: true }) }));
}

export { ESTADOS };
