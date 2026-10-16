// Impresión directa en la Phomemo M02 por Bluetooth LE.
// Protocolo (tomado del driver abierto phomemo-tools para la M02):
//   ESC @ (iniciar) · ESC a 1 (centrar) · GS v 0 en bloques de hasta 255 líneas
//   (48 bytes por línea = 384 puntos, bit en 1 = punto negro) · avance de papel al final.
// La impresora recibe por la característica ff02 del servicio ff00.

import { BleClient } from '@capacitor-community/bluetooth-le';
import { esperar } from './util.js';

const u16 = (h) => '0000' + h + '-0000-1000-8000-00805f9b34fb';
const SERVICIO_PHOMEMO = u16('ff00');
const ESCRITURA_PHOMEMO = u16('ff02');
// otros servicios que usan impresoras térmicas chinas parecidas
const SERVICIOS_EXTRA = [u16('ae30'), u16('18f0'), u16('fee7'), '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];

let iniciado = false;
async function iniciar() {
  if (iniciado) return;
  await BleClient.initialize({ androidNeverForLocation: true });
  iniciado = true;
}

// Muestra la lista de dispositivos Bluetooth cercanos para elegir la Phomemo
export async function elegirImpresora() {
  await iniciar();
  const dev = await BleClient.requestDevice({ optionalServices: [SERVICIO_PHOMEMO, ...SERVICIOS_EXTRA] });
  return { deviceId: dev.deviceId, nombre: dev.name || 'Impresora' };
}

async function buscarEscritura(deviceId) {
  const servicios = await BleClient.getServices(deviceId);
  const props = (c) => c.properties || {};
  for (const s of servicios) {
    if (s.uuid.toLowerCase() !== SERVICIO_PHOMEMO) continue;
    const c = s.characteristics.find((x) => x.uuid.toLowerCase() === ESCRITURA_PHOMEMO);
    if (c) return { service: s.uuid, characteristic: c.uuid, sinRespuesta: !!props(c).writeWithoutResponse };
  }
  // si no es la Phomemo de siempre, la primera característica donde se pueda escribir
  for (const s of servicios) {
    for (const c of s.characteristics) {
      const p = props(c);
      if (p.writeWithoutResponse || p.write) return { service: s.uuid, characteristic: c.uuid, sinRespuesta: !!p.writeWithoutResponse };
    }
  }
  throw new Error('sin_escritura');
}

// Intensidad: densidad propia de la M02 (1F 11 02 n, la app oficial manda 04)
// más el tiempo de calentamiento del cabezal (ESC 7, más alto = más oscuro).
export const INTENSIDADES = {
  suave: { densidad: 0x02, calor: 80 },
  normal: { densidad: 0x04, calor: 140 },
  intensa: { densidad: 0x08, calor: 200 },
};

// Canvas de 384 px de ancho → bytes listos para la M02
export function canvasARaster(cv, modo = 'normal', intensidad = 'intensa') {
  const w = cv.width, h = cv.height, bpl = Math.ceil(w / 8);
  const px = cv.getContext('2d').getImageData(0, 0, w, h).data;
  const bits = new Uint8Array(bpl * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      if (l < 128) bits[y * bpl + (x >> 3)] |= 0x80 >> (x & 7);
    }
  }
  const out = [];
  if (modo === 'alternativo') out.push(0x10, 0xff, 0xfe, 0x01);
  const it = INTENSIDADES[intensidad] || INTENSIDADES.intensa;
  out.push(0x1b, 0x40);
  out.push(0x1f, 0x11, 0x02, it.densidad);
  out.push(0x1b, 0x37, 0x07, it.calor, 0x02);
  out.push(0x1b, 0x61, 0x01);
  for (let line = 0; line < h; line += 255) {
    const n = Math.min(255, h - line);
    out.push(0x1d, 0x76, 0x30, 0x00, bpl & 0xff, bpl >> 8, n & 0xff, n >> 8);
    for (let k = line * bpl; k < (line + n) * bpl; k++) out.push(bits[k]);
  }
  if (modo === 'alternativo') out.push(0x1b, 0x4a, 0x50);
  else out.push(0x1b, 0x64, 0x02, 0x1b, 0x64, 0x02);
  return new Uint8Array(out);
}

export async function imprimir(cfgImpresora, cv, onProgreso) {
  const { deviceId, modo, intensidad } = cfgImpresora;
  if (!deviceId) throw new Error('sin_impresora');
  await iniciar();
  const datos = canvasARaster(cv, modo, intensidad);
  await BleClient.connect(deviceId, () => {}, { timeout: 12000 });
  try {
    const w = await buscarEscritura(deviceId);
    let mtu = 23;
    try { mtu = await BleClient.getMtu(deviceId); } catch (e) {}
    const trozo = Math.max(20, Math.min(128, mtu - 3));
    for (let off = 0; off < datos.length; off += trozo) {
      const parte = datos.slice(off, off + trozo);
      const dv = new DataView(parte.buffer);
      if (w.sinRespuesta) {
        await BleClient.writeWithoutResponse(deviceId, w.service, w.characteristic, dv);
        await esperar(12);
      } else {
        await BleClient.write(deviceId, w.service, w.characteristic, dv);
      }
      if (onProgreso) onProgreso(Math.min(1, (off + trozo) / datos.length));
    }
    await esperar(1200); // que termine de imprimir antes de cortar la conexión
  } finally {
    try { await BleClient.disconnect(deviceId); } catch (e) {}
  }
}

export function mensajeError(e) {
  const m = String((e && e.message) || e || '');
  if (/sin_impresora/.test(m)) return 'Primero conectá la Phomemo en Ajustes.';
  if (/sin_escritura/.test(m)) return 'Ese dispositivo no parece una impresora. Elegí la Phomemo en Ajustes.';
  if (/cancel/i.test(m)) return 'Cancelado.';
  if (/disabled|not enabled|apagado/i.test(m)) return 'Prendé el Bluetooth del teléfono y probá de nuevo.';
  if (/permission|denied/i.test(m)) return 'La app necesita permiso de Bluetooth (Dispositivos cercanos).';
  if (/timeout|connect/i.test(m)) return 'No pude conectar con la Phomemo. ¿Está prendida y cerca?';
  return 'No se pudo imprimir (' + m.slice(0, 60) + ').';
}
