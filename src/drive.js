// Respaldo automático en el Google Drive de Mario.
// Funciona con un script de Google Apps Script que Mario pega una sola vez en su cuenta
// (el código está abajo y se copia desde Ajustes). El script recibe el respaldo y lo guarda
// en la carpeta "Mario PC - Respaldos" de su Drive: un archivo por día, se quedan los últimos 60.
// No hace falta ninguna clave de Google en la app: el link del script es la llave.

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { db, exportarRespaldo, guardarMeta, guardarTodoYa } from './store.js';
import { stampISO } from './util.js';

const NATIVE = Capacitor.isNativePlatform();
const CADA_MIN = 30; // sube como mucho una vez cada media hora, y solo si hubo cambios

export const CODIGO_SCRIPT = `// Respaldo de la app Mario PC en Google Drive
// Guarda cada respaldo en la carpeta "Mario PC - Respaldos" (uno por día, quedan los últimos 60).
const CARPETA = 'Mario PC - Respaldos';
const GUARDAR = 60;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const txt = (e && e.postData && e.postData.contents) || '';
    const data = JSON.parse(txt);
    if (data.app !== 'mariopc-taller') return salida({ ok: false, error: 'No es un respaldo de la app' });
    lock.waitLock(20000);
    const carpeta = carpetaRespaldos();
    const nombre = 'mariopc-respaldo-' + Utilities.formatDate(new Date(), 'America/Argentina/Buenos_Aires', 'yyyy-MM-dd') + '.json';
    const ya = carpeta.getFilesByName(nombre);
    if (ya.hasNext()) ya.next().setContent(txt);
    else carpeta.createFile(nombre, txt, 'application/json');
    limpiar(carpeta);
    return salida({ ok: true, archivo: nombre });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function doGet() {
  carpetaRespaldos();
  return salida({ ok: true, app: 'mariopc-respaldo' });
}

function carpetaRespaldos() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}

function limpiar(carpeta) {
  const archivos = [];
  const it = carpeta.getFiles();
  while (it.hasNext()) { const f = it.next(); if (/^mariopc-respaldo-.*\\.json$/.test(f.getName())) archivos.push(f); }
  archivos.sort((a, b) => b.getName().localeCompare(a.getName()));
  archivos.slice(GUARDAR).forEach((f) => f.setTrashed(true));
}

function salida(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;

export const urlValida = (u) => /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(String(u || '').trim());

function leer(data) {
  if (data && typeof data === 'object') return data;
  try { return JSON.parse(String(data || '')); } catch (e) { return null; }
}

// POST al script. Apps Script contesta con una redirección a otra dirección donde está la respuesta.
async function enviar(url, cuerpo, metodo = 'POST') {
  if (NATIVE) {
    const opts = { url, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, disableRedirects: true, connectTimeout: 20000, readTimeout: 60000 };
    let r = metodo === 'POST' ? await CapacitorHttp.post(Object.assign(opts, { data: cuerpo })) : await CapacitorHttp.get(opts);
    for (let i = 0; i < 3 && r.status >= 300 && r.status < 400; i++) {
      const h = r.headers || {};
      const dest = h.Location || h.location || h.LOCATION;
      if (!dest) break;
      r = await CapacitorHttp.get({ url: dest, connectTimeout: 20000, readTimeout: 60000 });
    }
    return { status: r.status, data: leer(r.data) };
  }
  // En el navegador (pruebas)
  const r = await fetch(url, metodo === 'POST' ? { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'text/plain;charset=utf-8' } } : {});
  return { status: r.status, data: leer(await r.text()) };
}

// Prueba el link (sin subir nada). Devuelve '' si anda, o el motivo si no.
export async function probarLink(url) {
  if (!urlValida(url)) return 'Ese no parece el link de la aplicación web. Tiene que empezar con https://script.google.com/macros/s/ y terminar en /exec.';
  try {
    const r = await enviar(url.trim(), null, 'GET');
    if (r.data && r.data.ok && r.data.app === 'mariopc-respaldo') return '';
    if (r.status === 401 || r.status === 403) return 'Google no deja entrar: revisá que en "Quién tiene acceso" esté "Cualquier usuario".';
    return 'El link respondió algo raro (' + r.status + '). Revisá que hayas pegado el código completo y vuelto a implementar.';
  } catch (e) {
    return 'No pude conectarme. ¿Tenés internet?';
  }
}

let subiendo = null;
// Sube el respaldo. manual: sube aunque no haya cambios ni haya pasado el tiempo.
export function subirADrive({ manual = false } = {}) {
  const url = db.cfg.drive.url;
  if (!url || !urlValida(url)) return Promise.resolve(false);
  if (subiendo) return subiendo;
  if (!manual) {
    if (!db.meta.pendienteDrive) return Promise.resolve(false);
    const ult = db.meta.ultimoDrive ? Date.parse(db.meta.ultimoDrive) : 0;
    if (Date.now() - ult < CADA_MIN * 60000) return Promise.resolve(false);
  }
  subiendo = (async () => {
    try {
      await guardarTodoYa();
      db.meta.pendienteDrive = false; // si algo cambia mientras sube, vuelve a quedar pendiente
      const r = await enviar(url, JSON.stringify(exportarRespaldo()));
      if (!(r.data && r.data.ok)) throw new Error((r.data && r.data.error) || 'respuesta ' + r.status);
      db.meta.ultimoDrive = stampISO();
      db.meta.errorDrive = null;
      guardarMeta();
      return true;
    } catch (e) {
      db.meta.pendienteDrive = true;
      db.meta.errorDrive = String((e && e.message) || e).slice(0, 200);
      guardarMeta();
      return false;
    } finally {
      subiendo = null;
    }
  })();
  return subiendo;
}
