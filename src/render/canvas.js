// Ayudas para dibujar texto en canvas (etiqueta y comprobante).

export const FD = '"DM Sans",system-ui,"Segoe UI",Roboto,Arial,sans-serif';
export const FB = '"Bebas Neue","Arial Narrow",Impact,sans-serif';
export const FM = '"Space Mono",ui-monospace,Menlo,Consolas,monospace';

export function cargarImagen(src) {
  return new Promise((ok) => {
    const i = new Image();
    i.onload = () => ok(i);
    i.onerror = () => ok(null);
    i.src = src;
  });
}

export function wrapLines(c, text, maxW) {
  text = String(text == null ? '' : text).replace(/[ \t\r\n]+/g, ' ').trim(); // el espacio duro (\u00a0) no corta
  if (!text) return ['-'];
  const words = text.split(' '), lines = [];
  let cur = '';
  words.forEach((w) => {
    while (c.measureText(w).width > maxW && w.length > 1) {
      let cut = w.length;
      while (cut > 1 && c.measureText(w.slice(0, cut)).width > maxW) cut--;
      if (cur) { lines.push(cur); cur = ''; }
      lines.push(w.slice(0, cut)); w = w.slice(cut);
    }
    const t = cur ? cur + ' ' + w : w;
    if (c.measureText(t).width <= maxW) cur = t; else { lines.push(cur); cur = w; }
  });
  if (cur) lines.push(cur);
  return lines;
}
export function ellip(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '…';
}
export function limitLines(c, lines, max, maxW) {
  if (lines.length <= max) return lines;
  const keep = lines.slice(0, max - 1);
  keep.push(ellip(c, lines.slice(max - 1).join(' '), maxW));
  return keep;
}
export function toBW(cv, umbral = 150) {
  const c = cv.getContext('2d'), id = c.getImageData(0, 0, cv.width, cv.height), p = id.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114, v = l < umbral ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = v; p[i + 3] = 255;
  }
  c.putImageData(id, 0, 0);
}
export function toBlobP(cv, type, qual) {
  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('blob'))), type, qual));
}

// PDF de una página A4 con la imagen del canvas (sin librerías)
export async function canvasToPdf(cv) {
  const b = await toBlobP(cv, 'image/jpeg', 0.95);
  const jpg = new Uint8Array(await b.arrayBuffer()), enc = new TextEncoder(), parts = [], pos = [];
  let off = 0;
  const push = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); off += u.length; };
  push('%PDF-1.4\n');
  pos[1] = off; push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  pos[2] = off; push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  pos[3] = off; push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n');
  pos[4] = off; push('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + cv.width + ' /Height ' + cv.height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n');
  push(jpg); push('\nendstream\nendobj\n');
  const content = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
  pos[5] = off; push('5 0 obj\n<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream\nendobj\n');
  const xo = off;
  let xr = 'xref\n0 6\n0000000000 65535 f \n';
  for (let i = 1; i <= 5; i++) xr += String(pos[i]).padStart(10, '0') + ' 00000 n \n';
  push(xr); push('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xo + '\n%%EOF\n');
  return new Blob(parts, { type: 'application/pdf' });
}

// Espera a que las tipografías estén listas antes de dibujar
let fuentesP = null;
export function fuentesListas() {
  if (!fuentesP) {
    const specs = ['700 24px "DM Sans"', '500 24px "DM Sans"', '400 24px "DM Sans"', '400 40px "Bebas Neue"', '700 22px "Space Mono"', '400 22px "Space Mono"'];
    if (!document.fonts || !document.fonts.load) fuentesP = Promise.resolve();
    else fuentesP = Promise.race([Promise.all(specs.map((s) => document.fonts.load(s))), new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
  }
  return fuentesP;
}
