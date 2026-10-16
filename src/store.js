// Todo lo que la app guarda queda en el teléfono (SharedPreferences de Android).
// Nada se manda a internet. El respaldo es un archivo que Mario exporta a mano.

import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { uid, stampISO, todayISO } from './util.js';

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
      },
      repuestos: [
        { id: 'd2', nombre: 'SSD 480 GB', precio: null },
        { id: 'd3', nombre: 'SSD 960 GB', precio: null },
        { id: 'd4', nombre: 'Memoria RAM', precio: null },
        { id: 'd5', nombre: 'Pantalla notebook', precio: null },
        { id: 'd6', nombre: 'Pantalla celular', precio: null },
        { id: 'd7', nombre: 'Batería notebook', precio: null },
        { id: 'd8', nombre: 'Batería celular', precio: null },
        { id: 'iqw94rw4', nombre: 'Despiece (cambio de componentes)', precio: 70000 },
        { id: 'ivpb8vnt', nombre: 'Descuento', precio: -40000 },
      ],
    },
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
  if (p.mo && typeof p.mo === 'object') o.precios.mo = p.mo;
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
  meta: { primeraVez: true, ultimoBackup: null },
};

export async function cargar() {
  db.cfg = normalizeCfg(await getJSON(K.cfg, null));
  const c = await getJSON(K.contador, null);
  db.ultimo = c && isFinite(+c.ultimo) ? +c.ultimo : ULTIMO_DE_FABRICA;
  db.trabajos = await getJSON(K.trabajos, []);
  db.presupuestos = await getJSON(K.presupuestos, []);
  db.meta = Object.assign({ primeraVez: true, ultimoBackup: null }, await getJSON(K.meta, {}));
  if (!Array.isArray(db.trabajos)) db.trabajos = [];
  if (!Array.isArray(db.presupuestos)) db.presupuestos = [];
}

// Guardados con un pequeño retardo para no escribir en cada tecla
const timers = {};
function guardarLuego(key, fn, ms = 400) {
  clearTimeout(timers[key]);
  timers[key] = setTimeout(() => setJSON(key, fn()), ms);
}
export const guardarCfg = () => guardarLuego(K.cfg, () => db.cfg);
export const guardarTrabajos = () => guardarLuego(K.trabajos, () => db.trabajos, 150);
export const guardarPresupuestos = () => guardarLuego(K.presupuestos, () => db.presupuestos, 150);
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
    entrega: '', falla: '', acc: [], accOtro: '', danos: [], danoOtro: '', clave: 'no', obs: '',
    presupuestoId: null,
    informe: null,
  };
}

export function informeVacio(t) {
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  return {
    resultado: 'reparado', diagnostico: '', tareas: [], tareasOtras: [], repuestos: [],
    pruebas: [], metricas: [], recomendaciones: [], recomendacionOtra: '',
    total: pres && !pres.missing ? pres.total : null, mostrarTotal: true,
    fechaEntrega: todayISO(), generado: null,
  };
}

export function guardarTrabajo(t) {
  t.actualizado = stampISO();
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
export function exportarRespaldo() {
  return {
    app: 'mariopc-taller', formato: 1, exportado: stampISO(),
    cfg: db.cfg, ultimo: db.ultimo, trabajos: db.trabajos, presupuestos: db.presupuestos,
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
  await guardarTodoYa();
}
