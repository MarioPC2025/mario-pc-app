// Ajustes: datos del negocio, precios, etiqueta, impresora y respaldo.

import { Capacitor } from '@capacitor/core';
import { el, campo, dinero, toast, uid, haceCuanto, todayISO, botonConfirmar } from '../util.js';
import { db, guardarCfg, guardarUltimo, exportarRespaldo, marcarRespaldo, importarRespaldo, trabajoVacio } from '../store.js';
import { EQUIPOS, SERVICIOS } from '../catalog.js';
import { conectarImpresora, imprimirEtiqueta } from '../acciones.js';
import { compartirArchivo } from '../files.js';
import { setTitulo, recargar } from '../nav.js';

const VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export const vistaAjustes = {
  tab: 'ajustes',
  render(main, params) {
    setTitulo('Ajustes', '');
    const c = db.cfg;
    const wrap = el('div', { class: 'wrap form' });
    main.append(wrap);
    const s = (t, ...h) => el('section', { class: 'blk', id: 'aj-' + t.id }, el('h2', { text: t.nombre }), ...h);

    // Negocio
    const g = (k, label, attrs) => campo(label, Object.assign({ value: c.negocio[k] }, attrs), (v) => { c.negocio[k] = v; guardarCfg(); }).wrap;
    const garantia = campo('Garantía (días)', { type: 'number', inputmode: 'numeric', min: '0', max: '365', value: c.negocio.garantiaDias }, (v) => {
      const n = parseInt(v, 10); c.negocio.garantiaDias = isFinite(n) && n > 0 ? Math.min(n, 365) : 0; guardarCfg();
    }).wrap;
    wrap.append(s({ id: 'negocio', nombre: 'Tu negocio' },
      el('div', { class: 'two' }, g('wsp', 'Tu WhatsApp', { type: 'tel', inputmode: 'tel', maxlength: '24' }), g('ig', 'Instagram', { maxlength: '40' }), g('web', 'Web', { maxlength: '40' }), garantia),
      el('p', { class: 'hint', text: 'Salen en el pie del presupuesto, del comprobante y del informe. La garantía se usa en los tres.' })));

    // Presupuesto
    wrap.append(s({ id: 'pres', nombre: 'Presupuesto' }, el('div', { class: 'two' },
      campo('Validez (días)', { type: 'number', inputmode: 'numeric', min: '0', max: '90', value: c.presupuesto.validez }, (v) => { const n = parseInt(v, 10); c.presupuesto.validez = isFinite(n) && n > 0 ? n : 0; guardarCfg(); }).wrap,
      campo('Formas de pago', { maxlength: '80', value: c.presupuesto.pagos }, (v) => { c.presupuesto.pagos = v; guardarCfg(); }).wrap),
      el('p', { class: 'hint', text: 'Con validez en 0, esa línea no aparece.' })));

    // Precios: mano de obra
    const mo = el('div');
    SERVICIOS.forEach((sv) => {
      const grid = el('div', { class: 'mo-grid' });
      sv.aplica.forEach((eid) => {
        const eq = EQUIPOS.find((e) => e.id === eid);
        const v = c.precios.mo[sv.id] && c.precios.mo[sv.id][eid];
        grid.append(el('div', { class: 'field' }, el('label', { text: eq.nombre }), dinero(typeof v === 'number' ? v : null, (n) => {
          if (!c.precios.mo[sv.id]) c.precios.mo[sv.id] = {};
          if (n == null) delete c.precios.mo[sv.id][eid]; else c.precios.mo[sv.id][eid] = n;
          guardarCfg();
        })));
      });
      mo.append(el('div', { class: 'mo-svc' }, el('h3', { text: sv.nombre }), grid));
    });
    // Repuestos
    const rep = el('div', { class: 'rows' });
    function pintarRep() {
      rep.replaceChildren(...c.precios.repuestos.map((r, i) => {
        const nm = el('input', { type: 'text', maxlength: '60', value: r.nombre, placeholder: 'Repuesto', 'aria-label': 'Nombre del repuesto', autocomplete: 'off' });
        nm.addEventListener('input', () => { r.nombre = nm.value; guardarCfg(); });
        return el('div', { class: 'libre' }, nm, dinero(r.precio, (n) => { r.precio = n; guardarCfg(); }),
          el('button', { type: 'button', class: 'btn icon', 'aria-label': 'Quitar repuesto', text: '×', onclick: () => { c.precios.repuestos.splice(i, 1); guardarCfg(); pintarRep(); } }));
      }), el('button', { type: 'button', class: 'btn ghost small', text: '+ Agregar repuesto', onclick: () => { c.precios.repuestos.push({ id: uid('r'), nombre: '', precio: null }); guardarCfg(); pintarRep(); } }));
    }
    pintarRep();
    wrap.append(s({ id: 'precios', nombre: 'Precios' },
      el('p', { class: 'hint', text: 'Mano de obra por servicio y tipo de equipo. Vacío = "a confirmar" en el presupuesto.' }), mo,
      el('h3', { class: 'sub', text: 'Repuestos' }), rep));

    // Etiqueta
    const largo = el('select', { 'aria-label': 'Largo de la etiqueta' }, ...[60, 70, 80, 90, 100].map((n) => el('option', { value: String(n), text: n + ' mm' })));
    largo.value = String(c.etiqueta.largo);
    largo.addEventListener('change', () => { c.etiqueta.largo = parseInt(largo.value, 10) || 80; guardarCfg(); });
    const giro = el('select', { 'aria-label': 'Giro' }, el('option', { value: 'ccw', text: 'Antihorario (como tu etiqueta actual)' }), el('option', { value: 'cw', text: 'Horario' }));
    giro.value = c.etiqueta.giro;
    giro.addEventListener('change', () => { c.etiqueta.giro = giro.value === 'cw' ? 'cw' : 'ccw'; guardarCfg(); });
    wrap.append(s({ id: 'etiqueta', nombre: 'Etiqueta' },
      el('div', { class: 'two' }, el('div', { class: 'field' }, el('label', { text: 'Largo' }), largo), el('div', { class: 'field' }, el('label', { text: 'Giro de la imagen' }), giro)),
      el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: c.etiqueta.tel, onchange: (e) => { c.etiqueta.tel = e.target.checked; guardarCfg(); } }), el('span', { text: 'Poner el teléfono del cliente en la etiqueta' }))));

    // Impresora
    const im = c.impresora;
    const prueba = el('button', { type: 'button', class: 'btn', text: 'Imprimir etiqueta de prueba' });
    prueba.addEventListener('click', () => {
      const t = Object.assign(trabajoVacio(), { orden: '000', fecha: todayISO(), falla: 'Etiqueta de prueba. Si la ves bien, ya está todo listo.' });
      t.cliente.nombre = 'Prueba'; t.equipo.marca = 'Mario'; t.equipo.modelo = 'PC';
      imprimirEtiqueta(t, prueba);
    });
    const intens = el('div', { class: 'seg seg3', role: 'radiogroup', 'aria-label': 'Intensidad de impresión' });
    [['suave', 'Suave'], ['normal', 'Normal'], ['intensa', 'Intensa']].forEach(([id, n]) => {
      const inp = el('input', { type: 'radio', name: 'intensidad', checked: (im.intensidad || 'intensa') === id });
      inp.addEventListener('change', () => { if (inp.checked) { im.intensidad = id; guardarCfg(); } });
      intens.append(el('label', { class: 'opt' }, inp, el('span', { text: n })));
    });
    const modo = el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: im.modo === 'alternativo', onchange: (e) => { im.modo = e.target.checked ? 'alternativo' : 'normal'; guardarCfg(); } }),
      el('span', { text: 'Modo alternativo (probalo solo si conecta pero no imprime)' }));
    wrap.append(s({ id: 'impresora', nombre: 'Impresora Phomemo' },
      el('p', { class: im.deviceId ? 'state ok' : 'state', text: im.deviceId ? 'Conectada: ' + im.nombre : 'Sin conectar' }),
      el('div', { class: 'stack' },
        el('button', { type: 'button', class: 'btn primary', text: im.deviceId ? 'Elegir otra impresora' : 'Conectar la Phomemo', onclick: async () => { if (await conectarImpresora()) recargar(); } }),
        im.deviceId ? el('div', { class: 'field' }, el('label', { text: 'Intensidad de impresión' }), intens,
          el('p', { class: 'hint', text: 'Intensa es la equivalente a "dedicated" de la app de Phomemo: sale más negra.' })) : null,
        im.deviceId ? prueba : null, im.deviceId ? modo : null,
        im.deviceId ? el('button', { type: 'button', class: 'btn ghost small', text: 'Olvidar esta impresora', onclick: () => { im.deviceId = ''; im.nombre = ''; guardarCfg(); recargar(); } }) : null),
      el('p', { class: 'hint', text: 'Prendé la Phomemo y tené el Bluetooth del teléfono activado. No hace falta emparejarla desde Android: se elige acá.' })));

    // Numeración
    const prox = campo('Próximo N° de orden', { type: 'number', inputmode: 'numeric', min: '1', value: db.ultimo + 1 }, (v) => {
      const n = parseInt(v, 10); if (isFinite(n) && n > 0) guardarUltimo(n - 1);
    });
    wrap.append(s({ id: 'num', nombre: 'Numeración' }, prox.wrap, el('p', { class: 'hint', text: 'Sube solo con cada ficha nueva. Cambialo solo si tenés que saltear o corregir números.' })));

    // Datos
    const ult = db.meta.ultimoBackup;
    const archivo = el('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    archivo.addEventListener('change', async () => {
      const f = archivo.files && archivo.files[0];
      archivo.value = '';
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        const n = Array.isArray(data.trabajos) ? data.trabajos.length : 0;
        if (!window.confirm('Esto reemplaza todo lo que hay en la app por el respaldo (' + n + ' trabajos). ¿Seguimos?')) return;
        await importarRespaldo(data);
        toast('Respaldo cargado'); recargar();
      } catch (e) { toast('Ese archivo no es un respaldo de la app', 3500); }
    });
    wrap.append(s({ id: 'datos', nombre: 'Tus datos' },
      el('p', { class: 'hint', text: 'Todo queda guardado solo en este teléfono: ' + db.trabajos.length + ' trabajos y ' + db.presupuestos.length + ' presupuestos. Nada se sube a internet.' }),
      el('p', { class: ult ? 'state ok' : 'state warn', text: ult ? 'Último respaldo: ' + haceCuanto(ult) : 'Todavía no hiciste ningún respaldo' }),
      el('div', { class: 'stack' },
        el('button', { type: 'button', class: 'btn primary', text: 'Hacer respaldo', onclick: async () => {
          const blob = new Blob([JSON.stringify(exportarRespaldo(), null, 1)], { type: 'application/json' });
          const ok = await compartirArchivo(blob, 'mariopc-respaldo-' + todayISO() + '.json', { titulo: 'Respaldo Mario PC' });
          if (ok) { marcarRespaldo(); recargar(); }
        } }),
        el('button', { type: 'button', class: 'btn', text: 'Cargar un respaldo', onclick: () => archivo.click() }), archivo),
      el('p', { class: 'hint', text: 'El respaldo es un archivo que guardás donde quieras (tu Drive, un mail a vos mismo, la compu). Tiene datos de tus clientes: no lo compartas.' })));

    wrap.append(el('p', { class: 'foot', text: 'Mario PC · versión ' + VERSION + (Capacitor.isNativePlatform() ? '' : ' (navegador)') }));

    if (params.ir) setTimeout(() => { const t = document.getElementById('aj-' + params.ir); if (t) t.scrollIntoView({ block: 'start' }); }, 50);
  },
};

export { botonConfirmar };
