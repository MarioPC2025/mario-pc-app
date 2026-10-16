// Compartir archivos (PDF, imágenes, respaldo) y abrir WhatsApp.

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { waNumber, toast } from './util.js';

const NATIVE = Capacitor.isNativePlatform();

function blobABase64(blob) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = () => fail(r.error);
    r.readAsDataURL(blob);
  });
}

// Abre el menú "Compartir" de Android con el archivo (WhatsApp, Drive, app de Phomemo, etc.)
export async function compartirArchivo(blob, nombre, { titulo = '', texto = '' } = {}) {
  if (!NATIVE) { descargarEnNavegador(blob, nombre); return true; }
  try {
    const data = await blobABase64(blob);
    const w = await Filesystem.writeFile({ path: 'compartir/' + nombre, data, directory: Directory.Cache, recursive: true });
    const opts = { title: titulo || nombre, files: [w.uri], dialogTitle: titulo || 'Compartir' };
    if (texto) opts.text = texto;
    await Share.share(opts);
    return true;
  } catch (e) {
    const msg = String((e && e.message) || e);
    if (/cancel/i.test(msg)) return false;
    toast('No se pudo compartir el archivo');
    return false;
  }
}

export async function compartirTexto(texto, titulo = '') {
  if (!NATIVE) {
    try { await navigator.clipboard.writeText(texto); toast('Texto copiado'); } catch (e) {}
    return;
  }
  try { await Share.share({ text: texto, title: titulo, dialogTitle: titulo || 'Compartir' }); } catch (e) {}
}

function descargarEnNavegador(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function abrirUrl(url) {
  if (NATIVE) window.location.href = url;
  else window.open(url, '_blank', 'noopener');
}

// Abre el chat de WhatsApp con el cliente y el texto ya escrito
export function abrirWhatsApp(tel, texto) {
  const n = waNumber(tel);
  const url = (n ? 'https://wa.me/' + n : 'https://wa.me/') + (texto ? '?text=' + encodeURIComponent(texto) : '');
  abrirUrl(url);
}

export function llamar(tel) {
  const d = String(tel || '').replace(/[^\d+]/g, '');
  if (d) abrirUrl('tel:' + d);
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); toast('Copiado'); return; } catch (e) {}
  const ta = document.createElement('textarea');
  ta.value = texto; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  toast(ok ? 'Copiado' : 'No se pudo copiar');
}
