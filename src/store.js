// Todo lo que la app guarda queda en el teléfono (SharedPreferences de Android).
// Lo único que sale es el respaldo: a mano (archivo) o automático a tu Google Drive (ver drive.js).

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { uid, stampISO, todayISO, waNumber } from './util.js';

const NATIVE = Capacitor.isNativePlatform();
const K = { cfg: 'cfg', contador: 'contador', trabajos: 'trabajos', presupuestos: 'presupuestos', meta: 'meta' };

async function rawGet(key) {
  if (NATIVE) { const r = await Preferences.get({ key }); return r.value; }
  try { return localStorage.getItem('mpc_' + key); } catch (e) { return null; }
}
async function rawSet(key, value) {
  if (NATIVE) return Preferences.set({ key, value });
  try { localStorage.setItem('mpc_' + key, value); } catch (e) {}
}
async function getJSON(key, def) {
  try { const v = await rawGet(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
}
const setJSON = (key, v) => rawSet(key, JSON.stringify(v));

/* ---------- Valores de fábrica (tus precios y ajustes al 16/10/2026) ---------- */
export function defaultCfg() {
  return {
    negocio: { wsp: '11 2399-9259', ig: '@mariopc.com.ar', web: 'mariopc.com.ar', garantiaDias: 7, resenas: 'https://maps.app.goo.gl/NZ7zbYxNTpa6Mxpr6' },
    precios: {
      mo: {
        bateria: { celular: 20000, notebook: 25000 },
        pantalla: { celular: 30000, notebook: 40000 },
        reparacion: { aio: 40000, celular: 30000, escritorio: 40000, notebook: 40000 },
        ssd: { aio: 75000, escritorio: 75000, notebook: 75000 },
        limpieza: { aio: 20000, escritorio: 20000, notebook: 20000 },
        windows: {},
        respaldo: { aio: 20000, celular: 20000, escritorio: 20000, notebook: 20000 },
        componentes: { aio: 20000, escritorio: 20000, notebook: 20000 },
      },
      repuestos: [
        { id: 'd2', nombre: 'SSD 480 GB', precio: null },
        { id: 'd3', nombre: 'SSD 960 GB', precio: null },
        { id: 'd4', nombre: 'Memoria RAM', precio: null },
        { id: 'd5', nombre: 'Pantalla notebook', precio: null },
        { id: 'd6', nombre: 'Pantalla celular', precio: null },
        { id: 'd7', nombre: 'Batería notebook', precio: null },
        { id: 'd8', nombre: 'Batería celular', precio: null },
      ],
    },
    tareasPropias: [],
    drive: { url: '' },
    retiro: { dias: 30, porDia: 2000 },
    diezmo: { pct: 10, dados: {} }, // dados: { 'AAAA-MM': fecha en que lo diste }
    presupuesto: { validez: 7, pagos: 'Efectivo o Mercado Pago' },
    etiqueta: { largo: 80, giro: 'ccw', tel: true },
    impresora: { deviceId: '', nombre: '', modo: 'normal', intensidad: 'intensa' },
  };
}
const ULTIMO_DE_FABRICA = 77;

function normalizeCfg(raw) {
  const d = defaultCfg();
  if (!raw || typeof raw !== 'object') return d;
  const o = JSON.parse(JSON.stringify(d));
  const n = raw.negocio || {};
  for (const k of ['wsp', 'ig', 'web', 'resenas']) if (typeof n[k] === 'string') o.negocio[k] = n[k];
  if (isFinite(+n.garantiaDias) && n.garantiaDias !== '' && n.garantiaDias != null) o.negocio.garantiaDias = Math.max(0, Math.min(365, +n.garantiaDias));
  const p = raw.precios || {};
  // los servicios nuevos que no estaban en el respaldo arrancan con el precio de fábrica
  if (p.mo && typeof p.mo === 'object') o.precios.mo = Object.assign({}, d.precios.mo, p.mo);
  if (Array.isArray(p.repuestos)) {
    o.precios.repuestos = p.repuestos.filter((r) => r && typeof r === 'object').map((r) => ({
      id: String(r.id || uid('r')), nombre: String(r.nombre || ''),
      precio: typeof r.precio === 'number' && isFinite(r.precio) ? r.precio : null,
    }));
  }
  const pr = raw.presupuesto || {};
  if (isFinite(+pr.validez) && pr.validez !== '' && pr.validez != null) o.presupuesto.validez = Math.max(0, +pr.validez);
  if (typeof pr.pagos === 'string') o.presupuesto.pagos = pr.pagos;
  const e = raw.etiqueta || {};
  if ([60, 70, 80, 90, 100].includes(+e.largo)) o.etiqueta.largo = +e.largo;
  if (e.giro === 'cw' || e.giro === 'ccw') o.etiqueta.giro = e.giro;
  if (typeof e.tel === 'boolean') o.etiqueta.tel = e.tel;
  if (Array.isArray(raw.tareasPropias)) o.tareasPropias = raw.tareasPropias.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim());
  const rt = raw.retiro || {};
  if (isFinite(+rt.dias) && rt.dias !== '' && rt.dias != null) o.retiro.dias = Math.max(0, Math.min(365, +rt.dias));
  if (isFinite(+rt.porDia) && rt.porDia !== '' && rt.porDia != null) o.retiro.porDia = Math.max(0, +rt.porDia);
  const dz = raw.diezmo || {};
  if (isFinite(+dz.pct) && dz.pct !== '' && dz.pct != null) o.diezmo.pct = Math.max(0, Math.min(100, +dz.pct));
  if (dz.dados && typeof dz.dados === 'object') o.diezmo.dados = Object.assign({}, dz.dados);
  const dr = raw.drive || {};
  if (typeof dr.url === 'string') o.drive.url = dr.url.trim();
  const im = raw.impresora || {};
  if (typeof im.deviceId === 'string') o.impresora.deviceId = im.deviceId;
  if (typeof im.nombre === 'string') o.impresora.nombre = im.nombre;
  if (im.modo === 'normal' || im.modo === 'alternativo') o.impresora.modo = im.modo;
  if (['suave', 'normal', 'intensa'].includes(im.intensidad)) o.impresora.intensidad = im.intensidad;
  return o;
}

/* ---------- Estado en memoria ---------- */
export const db = {
  cfg: defaultCfg(),
  ultimo: ULTIMO_DE_FABRICA,
  trabajos: [],
  presupuestos: [],
  meta: { primeraVez: true, ultimoBackup: null, ultimoDrive: null, errorDrive: null, pendienteDrive: false, migracion: 0 },
};

export async function cargar() {
  db.cfg = normalizeCfg(await getJSON(K.cfg, null));
  const c = await getJSON(K.contador, null);
  db.ultimo = c && isFinite(+c.ultimo) ? +c.ultimo : ULTIMO_DE_FABRICA;
  db.trabajos = await getJSON(K.trabajos, []);
  db.presupuestos = await getJSON(K.presupuestos, []);
  db.meta = Object.assign({ primeraVez: true, ultimoBackup: null, ultimoDrive: null, errorDrive: null, pendienteDrive: false, migracion: 0 }, await getJSON(K.meta, {}));
  if (!Array.isArray(db.trabajos)) db.trabajos = [];
  if (!Array.isArray(db.presupuestos)) db.presupuestos = [];
  if (migrar(db.meta.migracion < 1)) await guardarTodoYa();
}

/* ---------- Arreglos de datos de versiones anteriores ---------- */
// conCfg: además de las fichas, pasa "Despiece" y "Descuento" de repuestos a servicio y descuento.
// Devuelve true si cambió algo.
function migrar(conCfg) {
  let cambio = false;
  for (const t of db.trabajos) {
    if (t.claveValor == null) { t.claveValor = ''; cambio = true; }
    if (!Array.isArray(t.fotos)) { t.fotos = []; cambio = true; }
    // Fichas viejas: lo entregado se toma como cobrado el día de la entrega
    if (!t.pago || typeof t.pago !== 'object') {
      t.pago = pagoVacio();
      if (t.estado === 'entregado' && t.informe && typeof t.informe.total === 'number') {
        Object.assign(t.pago, { pagado: true, pagoMonto: t.informe.total, pagoFecha: t.informe.fechaEntrega || t.fecha });
      }
      cambio = true;
    }
    // El PIN anotado en Observaciones pasa al campo privado (o se borra si el equipo ya se entregó)
    if (t.clave === 'pin' && /^\s*\d{3,10}\s*$/.test(t.obs || '')) {
      if (t.estado !== 'entregado' && !t.claveValor) t.claveValor = t.obs.trim();
      t.obs = ''; cambio = true;
    }
    if (t.estado === 'entregado' && t.claveValor) { t.claveValor = ''; cambio = true; }
    // Con el informe ya armado, el equipo está listo
    if (t.informe && t.informe.generado && (t.estado === 'recibido' || t.estado === 'en_curso')) { t.estado = 'listo'; cambio = true; }
    // Desde cuándo está listo (para el plazo de retiro) y cuándo se entregó
    if (t.estado === 'listo' && !t.listoDesde) { t.listoDesde = String((t.informe && t.informe.generado) || t.actualizado || todayISO()).slice(0, 10); cambio = true; }
    if (t.estado === 'entregado' && !t.entregadoEl) { t.entregadoEl = (t.informe && t.informe.fechaEntrega) || String(t.actualizado || '').slice(0, 10) || todayISO(); cambio = true; }
  }
  if (conCfg) {
    const reps = db.cfg.precios.repuestos;
    const desp = reps.find((r) => /^despiece/i.test(r.nombre.trim()));
    const desc = reps.find((r) => /^descuento$/i.test(r.nombre.trim()));
    if (desp && typeof desp.precio === 'number' && desp.precio > 0) {
      db.cfg.precios.mo.componentes = { aio: desp.precio, escritorio: desp.precio, notebook: desp.precio };
    }
    for (const p of db.presupuestos) {
      if (desp && p.rep && p.rep[desp.id]) {
        const d = (p.devices || []).find((x) => x.tipo !== 'celular');
        if (d && !d.svcs.includes('componentes')) d.svcs.push('componentes');
        delete p.rep[desp.id];
      }
      if (desc && p.rep && p.rep[desc.id]) {
        p.descuento = Math.abs((desc.precio || 0) * p.rep[desc.id]) || null;
        delete p.rep[desc.id];
      }
    }
    db.cfg.precios.repuestos = reps.filter((r) => r !== desp && r !== desc);
    db.meta.migracion = 1;
    cambio = true;
  }
  return cambio;
}

// Guardados con un pequeño retardo para no escribir en cada tecla
const timers = {};
function guardarLuego(key, fn, ms = 400) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => setJSON(key, fn()), ms);
}
// Cualquier cambio deja pendiente el próximo respaldo a Drive
function hayCambios() { if (!db.meta.pendienteDrive) { db.meta.pendienteDrive = true; guardarMeta(); } }
export const guardarCfg = () => { hayCambios(); guardarLuego(K.cfg, () => db.cfg); };
export const guardarTrabajos = () => { hayCambios(); guardarLuego(K.trabajos, () => db.trabajos, 150); };
export const guardarPresupuestos = () => { hayCambios(); guardarLuego(K.presupuestos, () => db.presupuestos, 150); };
export const guardarMeta = () => guardarLuego(K.meta, () => db.meta, 50);
export function guardarUltimo(n) {
  db.ultimo = n;
  setJSON(K.contador, { ultimo: n });
}
// Al salir de la app o mandarla al fondo se escribe todo lo pendiente
export async function guardarTodoYa() {
  for (const k in timers) clearTimeout(timers[k]);
  await Promise.all([
    setJSON(K.cfg, db.cfg), setJSON(K.trabajos, db.trabajos),
    setJSON(K.presupuestos, db.presupuestos), setJSON(K.meta, db.meta),
    setJSON(K.contador, { ultimo: db.ultimo }),
  ]);
}

/* ---------- Trabajos ---------- */
export const siguienteOrden = () => db.ultimo + 1;

export function trabajoVacio() {
  return {
    id: uid('t'), orden: String(siguienteOrden()), fecha: todayISO(), creado: null, actualizado: null,
    estado: 'recibido',
    cliente: { nombre: '', tel: '' },
    equipo: { tipo: 'notebook', marca: '', modelo: '', serie: '' },
    entrega: '', falla: '', acc: [], accOtro: '', danos: [], danoOtro: '', clave: 'no', claveValor: '', obs: '',
    presupuestoId: null, garantiaDe: null, fotos: [],
    pago: pagoVacio(), listoDesde: null, entregadoEl: null,
    informe: null,
  };
}

// Cobro del trabajo. pagoMonto queda fijo al registrar el pago (incluye la guarda de ese momento).
export function pagoVacio() {
  return { sena: null, senaMedio: 'efectivo', senaFecha: null, pagado: false, pagoMonto: null, pagoMedio: '', pagoFecha: null, sinGuarda: false, gastos: null };
}

export function informeVacio(t) {
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  return {
    resultado: 'reparado', diagnostico: '', tareas: [], tareasOtras: [], repuestos: [], datosEscritorio: false,
    pruebas: [], recomendaciones: [], recomendacionOtra: '',
    total: t.garantiaDe ? 0 : pres && !pres.missing ? pres.total : null, mostrarTotal: true,
    fechaEntrega: todayISO(), generado: null,
  };
}

export function guardarTrabajo(t) {
  t.actualizado = stampISO();
  // La clave del cliente no se guarda una vez que el equipo se entregó
  if (t.estado === 'entregado' || t.clave === 'no') t.claveValor = '';
  // Fechas de "listo" (para el plazo de retiro) y de entrega
  if (t.estado === 'listo' && !t.listoDesde) t.listoDesde = todayISO();
  if (t.estado === 'recibido' || t.estado === 'en_curso') t.listoDesde = null;
  if (t.estado === 'entregado' && !t.entregadoEl) t.entregadoEl = todayISO();
  if (t.estado !== 'entregado') t.entregadoEl = null;
  // Si el presupuesto quedó sin teléfono, se completa con el de la ficha
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  if (pres && !(pres.tel || '').trim() && t.cliente.tel.trim()) { pres.tel = t.cliente.tel.trim(); guardarPresupuestos(); }
  const i = db.trabajos.findIndex((x) => x.id === t.id);
  if (i < 0) {
    t.creado = t.creado || stampISO();
    db.trabajos.unshift(t);
    const n = parseInt(t.orden, 10);
    if (isFinite(n) && n > db.ultimo) guardarUltimo(n);
  } else db.trabajos[i] = t;
  guardarTrabajos();
}
export function borrarTrabajo(id) {
  db.trabajos = db.trabajos.filter((x) => x.id !== id);
  guardarTrabajos();
}
export const trabajoPorId = (id) => db.trabajos.find((x) => x.id === id) || null;

// Otros trabajos del mismo cliente (mismo número de WhatsApp), del más nuevo al más viejo
export function trabajosDelCliente(tel, menosId) {
  const n = waNumber(tel);
  if (!n) return [];
  return db.trabajos.filter((x) => x.id !== menosId && waNumber(x.cliente.tel) === n)
    .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}
// ¿Este cliente ya dejó una reseña en Google en algún trabajo?
export const clienteDejoResena = (t) => trabajosDelCliente(t.cliente.tel, t.id).some((x) => x.resenaDejo) || !!t.resenaDejo;

/* ---------- Presupuestos ---------- */
export function guardarPresupuesto(p) {
  p.actualizado = stampISO();
  const i = db.presupuestos.findIndex((x) => x.id === p.id);
  if (i < 0) db.presupuestos.unshift(p); else db.presupuestos[i] = p;
  guardarPresupuestos();
}
export function borrarPresupuesto(id) {
  db.presupuestos = db.presupuestos.filter((x) => x.id !== id);
  guardarPresupuestos();
}

/* ---------- Respaldo ---------- */
// Las claves de los clientes nunca salen del teléfono: el respaldo va sin ellas.
export function exportarRespaldo() {
  return {
    app: 'mariopc-taller', formato: 1, exportado: stampISO(),
    cfg: db.cfg, ultimo: db.ultimo,
    trabajos: db.trabajos.map((t) => (t.claveValor ? Object.assign({}, t, { claveValor: '' }) : t)),
    presupuestos: db.presupuestos,
  };
}
export function marcarRespaldo() {
  db.meta.ultimoBackup = stampISO();
  guardarMeta();
}
export async function importarRespaldo(data) {
  if (!data || data.app !== 'mariopc-taller' || !Array.isArray(data.trabajos)) throw new Error('formato');
  db.cfg = normalizeCfg(data.cfg);
  db.ultimo = isFinite(+data.ultimo) ? +data.ultimo : db.ultimo;
  db.trabajos = data.trabajos;
  db.presupuestos = Array.isArray(data.presupuestos) ? data.presupuestos : [];
  migrar(true);
  await guardarTodoYa();
}
