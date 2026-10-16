// Códigos QR: el de la etiqueta (abre la ficha desde el escáner de la app) y el de reseñas del informe.

import qrcode from 'qrcode-generator';

export const PREFIJO_FICHA = 'MPC:';

export function matrizQR(texto, nivel = 'M') {
  const q = qrcode(0, nivel);
  q.addData(String(texto));
  q.make();
  const n = q.getModuleCount();
  return { n, oscuro: (f, c) => q.isDark(f, c) };
}

// Dibuja el QR en un canvas con módulos de tamaño entero (nítido para la térmica)
export function dibujarQR(ctx, texto, x, y, modulo, nivel = 'M') {
  const m = matrizQR(texto, nivel);
  ctx.fillStyle = '#000';
  for (let f = 0; f < m.n; f++) for (let c = 0; c < m.n; c++) if (m.oscuro(f, c)) ctx.fillRect(x + c * modulo, y + f * modulo, modulo, modulo);
  return m.n * modulo;
}

export const modulosQR = (texto, nivel = 'M') => matrizQR(texto, nivel).n;

// Dibuja el QR en un PDF de jsPDF, en milímetros
export function qrEnPdf(doc, texto, x, y, lado, nivel = 'M') {
  const m = matrizQR(texto, nivel);
  const s = lado / m.n;
  doc.setFillColor(0, 0, 0);
  for (let f = 0; f < m.n; f++) {
    let c = 0;
    while (c < m.n) {
      if (!m.oscuro(f, c)) { c++; continue; }
      let fin = c;
      while (fin + 1 < m.n && m.oscuro(f, fin + 1)) fin++;
      doc.rect(x + c * s, y + f * s, (fin - c + 1) * s + 0.01, s + 0.01, 'F');
      c = fin + 1;
    }
  }
}
