// Fotos del equipo (estado al recibirlo). Se guardan como archivos JPG en el teléfono, no dentro de la ficha,
// para que la app siga rápida. En la ficha queda solo el nombre. Si Drive está conectado, se suben a
// "Mario PC - Respaldos / Fotos / N° <orden> - <cliente>".

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { el, stampISO, toast } from './util.js';

const NATIVE = Capacitor.isNativePlatform();
const LADO = 1600, CALIDAD = 0.72;
const memoria = {}; // en el navegador (pruebas) las fotos quedan en memoria

// Abre la cámara (o la galería) y devuelve los archivos elegidos
export function elegirFotos({ camara = true } = {}) {
  return new Promise((ok) => {
    const inp = el('input', { type: 'file', accept: 'image/*', hidden: true });
    if (camara) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.addEventListener('change', () => { ok(Array.from(inp.files || [])); inp.remove(); });
    document.body.append(inp);
    inp.click();
  });
}

async function achicar(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const k = Math.min(1, LADO / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', CALIDAD);
}

const ruta = (t, archivo) => 'fotos/' + t.id + '/' + archivo;

// Agrega las fotos a la ficha (no la guarda: lo hace quien llama)
export async function agregarFotos(t, files) {
  let n = 0;
  for (const f of files) {
    try {
      const dataUrl = await achicar(f);
      const archivo = 'foto-' + Date.now().toString(36) + '-' + n + '.jpg';
      if (NATIVE) await Filesystem.writeFile({ path: ruta(t, archivo), data: dataUrl.split(',')[1], directory: Directory.Data, recursive: true });
      else memoria[archivo] = dataUrl;
      t.fotos.push({ archivo, fecha: stampISO(), subida: false });
      n++;
    } catch (e) { console.error(e); toast('No pude guardar una de las fotos'); }
  }
  return n;
}

// Dirección para mostrar la foto en un <img>
export async function srcFoto(t, f) {
  if (!NATIVE) return memoria[f.archivo] || '';
  try {
    const r = await Filesystem.getUri({ path: ruta(t, f.archivo), directory: Directory.Data });
    return Capacitor.convertFileSrc(r.uri);
  } catch (e) { return ''; }
}

export async function base64Foto(t, f) {
  if (!NATIVE) return (memoria[f.archivo] || '').split(',')[1] || '';
  const r = await Filesystem.readFile({ path: ruta(t, f.archivo), directory: Directory.Data });
  return typeof r.data === 'string' ? r.data : '';
}

export async function borrarFoto(t, f) {
  t.fotos = t.fotos.filter((x) => x !== f);
  if (!NATIVE) { delete memoria[f.archivo]; return; }
  try { await Filesystem.deleteFile({ path: ruta(t, f.archivo), directory: Directory.Data }); } catch (e) {}
}

export async function borrarFotosDe(t) {
  if (!NATIVE) return;
  try { await Filesystem.rmdir({ path: 'fotos/' + t.id, directory: Directory.Data, recursive: true }); } catch (e) {}
}
