// Ajustes: datos del negocio, precios, etiqueta, impresora y respaldo.

import { Capacitor } from '@capacitor/core';
import { el, campo, dinero, toast, uid, haceCuanto, todayISO, botonConfirmar, fmt } from '../util.js';
import { db, guardarCfg, guardarMeta, guardarUltimo, exportarRespaldo, marcarRespaldo, importarRespaldo, trabajoVacio } from '../store.js';
import { EQUIPOS, SERVICIOS } from '../catalog.js';
import { conectarImpresora, imprimirEtiqueta } from '../acciones.js';
import { compartirArchivo, copiar, abrirUrl } from '../files.js';
import { CODIGO_SCRIPT, probarLink, subirADrive, urlValida } from '../drive.js';
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
      g('resenas', 'Link para reseñas de Google', { type: 'url', inputmode: 'url', maxlength: '200' }),
      el('p', { class: 'hint', text: 'Salen en el pie del presupuesto, del comprobante y del informe. La garantía se usa en los tres. El link de reseñas va como QR en el informe y en el mensaje al cliente; si lo dejás vacío, no aparece.' })));

    // Retiro del equipo y guarda
    const mensual = el('p', { class: 'hint' });
    const pintarMensual = () => { mensual.textContent = 'Equivale a ' + fmt(c.retiro.porDia * 30) + ' por mes. Sale en el comprobante y se suma solo al total si el equipo no se retira a tiempo.'; };
    pintarMensual();
    wrap.append(s({ id: 'retiro', nombre: 'Retiro y guarda' }, el('div', { class: 'two' },
      campo('Días para retirar', { type: 'number', inputmode: 'numeric', min: '0', max: '365', value: c.retiro.dias }, (v) => { const n = parseInt(v, 10); c.retiro.dias = isFinite(n) && n > 0 ? Math.min(n, 365) : 0; guardarCfg(); }).wrap,
      el('div', { class: 'field' }, el('label', { text: 'Guarda por día' }), dinero(c.retiro.porDia, (v) => { c.retiro.porDia = v == null ? 0 : Math.abs(v); guardarCfg(); pintarMensual(); }))),
      mensual));

    // Diezmo
    wrap.append(s({ id: 'diezmo', nombre: 'Diezmo' },
      campo('Porcentaje sobre la ganancia', { type: 'number', inputmode: 'numeric', min: '0', max: '100', value: c.diezmo.pct }, (v) => { const n = parseFloat(String(v).replace(',', '.')); c.diezmo.pct = isFinite(n) && n >= 0 ? Math.min(n, 100) : 0; guardarCfg(); }).wrap,
      el('p', { class: 'hint', text: 'Se calcula sobre la ganancia de cada mes (lo cobrado menos lo que gastaste en repuestos y otros gastos). Lo ves y lo marcás como dado en Resumen.' })));

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
      el('h3', { class: 'sub', text: 'Repuestos' }),
      el('p', { class: 'hint', text: 'Podés dejarlos sin precio y ponerlo en cada presupuesto, según lo que consigas.' }), rep));

    // Tareas propias del informe
    const tps = el('div', { class: 'rows' });
    function pintarTps() {
      if (!c.tareasPropias.length) { tps.replaceChildren(el('p', { class: 'hint', text: 'Todavía no agregaste tareas propias. Se suman desde el informe, con "Otra tarea".' })); return; }
      tps.replaceChildren(...c.tareasPropias.map((x, i) => el('div', { class: 'inline-row tp-row' }, el('span', { text: x }),
        el('button', { type: 'button', class: 'btn icon', 'aria-label': 'Sacar ' + x, text: '×', onclick: () => { c.tareasPropias.splice(i, 1); guardarCfg(); pintarTps(); } }))));
    }
    pintarTps();
    wrap.append(s({ id: 'informe', nombre: 'Tareas del informe' },
      el('p', { class: 'hint', text: 'Las que agregaste a mano. Aparecen como tildes en todos los informes.' }), tps));

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

    // Respaldo automático en Google Drive
    wrap.append(s({ id: 'drive', nombre: 'Respaldo en Google Drive' }, ...seccionDrive()));

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
      el('p', { class: 'hint', text: 'Todo queda guardado en este teléfono: ' + db.trabajos.length + ' trabajos y ' + db.presupuestos.length + ' presupuestos.' + (c.drive.url ? ' Además se respalda solo en tu Google Drive.' : ' Lo único que sale es el respaldo.') }),
      el('p', { class: ult ? 'state ok' : 'state warn', text: ult ? 'Último respaldo: ' + haceCuanto(ult) : 'Todavía no hiciste ningún respaldo' }),
      el('div', { class: 'stack' },
        el('button', { type: 'button', class: 'btn primary', text: 'Hacer respaldo', onclick: async () => {
          const blob = new Blob([JSON.stringify(exportarRespaldo(), null, 1)], { type: 'application/json' });
          const ok = await compartirArchivo(blob, 'mariopc-respaldo-' + todayISO() + '.json', { titulo: 'Respaldo Mario PC' });
          if (ok) { marcarRespaldo(); recargar(); }
        } }),
        el('button', { type: 'button', class: 'btn', text: 'Cargar un respaldo', onclick: () => archivo.click() }), archivo),
      el('p', { class: 'hint', text: 'El respaldo es un archivo que guardás donde quieras. Tiene datos de tus clientes (nunca las claves): no lo compartas. Las fotos no van en este archivo: se respaldan en tu Drive.' })));

    wrap.append(el('p', { class: 'foot', text: 'Mario PC · versión ' + VERSION + (Capacitor.isNativePlatform() ? '' : ' (navegador)') }));

    if (params.ir) setTimeout(() => { const t = document.getElementById('aj-' + params.ir); if (t) t.scrollIntoView({ block: 'start' }); }, 50);
  },
};

function seccionDrive() {
  const c = db.cfg;
  const md = db.meta;
  if (c.drive.url) {
    const estado = md.errorDrive
      ? el('p', { class: 'state warn', text: 'El último intento falló: ' + md.errorDrive })
      : el('p', { class: md.ultimoDrive ? 'state ok' : 'state', text: md.ultimoDrive ? 'Último respaldo en Drive: ' + haceCuanto(md.ultimoDrive) + ' (' + new Date(md.ultimoDrive).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ')' : 'Conectado. Todavía no subió ningún respaldo.' });
    const subir = el('button', { type: 'button', class: 'btn primary', text: 'Subir ahora' });
    subir.addEventListener('click', async () => {
      subir.textContent = 'Subiendo…'; subir.disabled = true;
      const ok = await subirADrive({ manual: true });
      toast(ok ? 'Respaldo guardado en tu Drive' : 'No se pudo subir: ' + (db.meta.errorDrive || 'error'), 4000);
      recargar();
    });
    const viejo = md.scriptViejo ? el('div', { class: 'notice' },
      el('p', { text: 'Para que se suban también las fotos, actualizá el código del script: 1) Copiá el código nuevo. 2) En Apps Script reemplazá todo y guardá. 3) Implementar → Administrar implementaciones → lápiz → Versión: Nueva versión → Implementar. El link no cambia.' }),
      el('div', { class: 'row-btns' },
        el('button', { type: 'button', class: 'btn small', text: 'Copiar código nuevo', onclick: () => copiar(CODIGO_SCRIPT) }),
        el('button', { type: 'button', class: 'btn small', text: 'Ya lo actualicé', onclick: async () => {
          const err = await probarLink(c.drive.url); guardarMeta();
          toast(err || (md.scriptViejo ? 'Todavía responde el código viejo. ¿Hiciste "Nueva versión"?' : 'Listo, ahora se suben las fotos'), 4000);
          if (!md.scriptViejo) subirADrive({ manual: true });
          recargar();
        } }))) : null;
    return [estado, viejo,
      el('p', { class: 'hint', text: 'Se sube solo cuando hay cambios (como mucho cada media hora), al salir de la app o al volver a abrirla. Queda en la carpeta "Mario PC - Respaldos" de tu Drive, un archivo por día, y las fotos de los equipos en la subcarpeta "Fotos".' }),
      el('div', { class: 'stack' }, subir,
        botonConfirmar('Desconectar Drive', '¿Seguro? Tocá de nuevo', () => { c.drive.url = ''; md.ultimoDrive = null; md.errorDrive = null; guardarCfg(); recargar(); }, 'btn ghost small'))];
  }
  // Configuración, una sola vez
  const link = campo('4. Pegá el link de la aplicación web', { type: 'url', inputmode: 'url', placeholder: 'https://script.google.com/macros/s/…/exec' });
  const conectar = el('button', { type: 'button', class: 'btn primary', text: 'Probar y conectar' });
  conectar.addEventListener('click', async () => {
    const u = link.input.value.trim();
    conectar.textContent = 'Probando…'; conectar.disabled = true;
    const err = await probarLink(u);
    conectar.textContent = 'Probar y conectar'; conectar.disabled = false;
    if (err) { toast(err, 5000); return; }
    c.drive.url = u; guardarCfg();
    const ok = await subirADrive({ manual: true });
    toast(ok ? 'Listo: primer respaldo guardado en tu Drive' : 'Conectado, pero el primer respaldo falló: ' + db.meta.errorDrive, 4500);
    recargar();
  });
  link.input.addEventListener('input', () => { link.input.classList.toggle('ok', urlValida(link.input.value)); });
  const paso = (n, txt) => el('li', {}, el('b', { text: n + ' ' }), txt); // la lista va sin números propios
  return [
    el('p', { class: 'hint', text: 'Se configura una sola vez, en unos 5 minutos. Es más cómodo desde la compu, pero se puede desde el teléfono con Chrome en "Sitio de escritorio".' }),
    el('ol', { class: 'pasos' },
      paso('1.', 'Copiá el código del respaldo.'),
      paso('2.', 'Abrí Google Apps Script con tu cuenta de Google, borrá lo que haya en el editor, pegá el código y guardá (ícono del disquete).'),
      paso('3.', 'Tocá Implementar → Nueva implementación → engranaje → Aplicación web. En "Ejecutar como" dejá "Yo" y en "Quién tiene acceso" elegí "Cualquier usuario". Implementar → Autorizar acceso → elegí tu cuenta → Configuración avanzada → Ir a … (no seguro) → Permitir. Copiá la URL de la aplicación web.')),
    el('div', { class: 'stack' },
      el('button', { type: 'button', class: 'btn', text: '1. Copiar el código', onclick: () => copiar(CODIGO_SCRIPT) }),
      el('button', { type: 'button', class: 'btn', text: '2. Abrir Google Apps Script', onclick: () => abrirUrl('https://script.google.com/create') })),
    link.wrap, conectar,
    el('p', { class: 'hint', text: 'El aviso de "app no verificada" es normal: el script es tuyo y lo único que hace es guardar los respaldos en esa carpeta. El link es la llave: no lo compartas.' }),
  ];
}

export { botonConfirmar };
