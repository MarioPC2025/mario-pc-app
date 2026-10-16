// Informe técnico de reparación: reemplaza a la plantilla de Word.
// Mismo lenguaje visual que el presupuesto (encabezado oscuro, verde de la marca, Helvetica).

import { jsPDF } from 'jspdf';
import { fmt } from '../util.js';
import { MARK_COLOR } from '../brand.js';

const INK = [12, 17, 14], MUTED = [95, 107, 101], LINE = [214, 221, 217], ZEBRA = [243, 246, 244],
  GREEN = [29, 221, 101], GREEN_D = [10, 122, 53], DARK = [7, 9, 10], AMBER = [176, 116, 0], RED = [190, 52, 40];

// Si no entra en una hoja, se vuelve a armar más compacto (hasta 3 intentos)
export function armarInformePdf(d) {
  let doc = null;
  for (const k of [1, 0.9, 0.82]) {
    doc = armar(d, k);
    if (doc.getNumberOfPages() === 1) break;
  }
  return doc.output('blob');
}

function armar(d, k) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const v = (x) => x * k;
  const W = 210, H = 297, M = 16, CW = W - 2 * M, BOTTOM = H - 26;
  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size * (k < 1 ? 0.5 + k / 2 : 1)); };
  let y = 0;

  /* ---------- Encabezados ---------- */
  function encabezado() {
    fill(DARK); doc.rect(0, 0, W, 34, 'F');
    fill(GREEN); doc.rect(0, 34, W, 1.2, 'F');
    let MW = 16.1;
    try { doc.addImage(MARK_COLOR, 'PNG', M, 10.5, MW, 14.5); } catch (e) { MW = 0; }
    const TX = M + MW + 4;
    font('bold', 24); doc.setTextColor(232, 237, 234); doc.text('MARIO PC', TX, 18);
    font('normal', 9); doc.setTextColor(150, 162, 156); doc.text('Reparación de PC y notebooks', TX, 24.5);
    font('bold', 15); color(GREEN); doc.text('INFORME TÉCNICO', W - M, 15.5, { align: 'right' });
    font('normal', 9); doc.setTextColor(200, 208, 204);
    doc.text('Orden N° ' + d.orden, W - M, 21.5, { align: 'right' });
    doc.text('Entregado el ' + d.fechaEntrega, W - M, 26.5, { align: 'right' });
    y = v(46);
  }
  function encabezadoChico() {
    fill(DARK); doc.rect(0, 0, W, 14, 'F');
    fill(GREEN); doc.rect(0, 14, W, 0.8, 'F');
    font('bold', 11); doc.setTextColor(232, 237, 234); doc.text('MARIO PC', M, 9.2);
    font('normal', 8.5); doc.setTextColor(200, 208, 204);
    doc.text('Informe técnico · Orden N° ' + d.orden + ' (continuación)', W - M, 9.2, { align: 'right' });
    y = 24;
  }
  function lugar(h) { if (y + h > BOTTOM) { doc.addPage(); encabezadoChico(); } }

  function seccion(titulo, primeraAltura) {
    lugar(v(12) + (primeraAltura || 8));
    y += v(4);
    font('bold', 8.5); color(INK); doc.text(titulo.toUpperCase(), M, y, { charSpace: 0.5 });
    stroke(GREEN); doc.setLineWidth(0.7); doc.line(M, y + 2, M + 22, y + 2);
    y += v(8);
  }
  function parrafo(texto, size = 10.5, col = INK) {
    font('normal', size); color(col);
    const lh = v(size * 0.43);
    doc.splitTextToSize(texto, CW).forEach((l) => { lugar(lh + 1); doc.text(l, M, y); y += lh; });
    y += v(2);
  }
  function tilde(x, yy) {
    fill(GREEN); doc.roundedRect(x, yy - 3.4, 4.2, 4.2, 0.9, 0.9, 'F');
    stroke(DARK); doc.setLineWidth(0.55); doc.setLineCap('round'); doc.setLineJoin('round');
    doc.lines([[0.75, 0.85], [1.55, -2.0]], x + 0.95, yy - 1.45, [1, 1], 'S', false);
    doc.setLineCap('butt');
  }
  function flecha(x, yy, w) {
    stroke(MUTED); doc.setLineWidth(0.4);
    doc.line(x, yy, x + w, yy);
    doc.line(x + w - 1.4, yy - 1.1, x + w, yy); doc.line(x + w - 1.4, yy + 1.1, x + w, yy);
  }

  encabezado();

  /* ---------- Datos ---------- */
  function dato(lbl, val, x, maxw) {
    font('bold', 7.5); color(MUTED); doc.text(lbl.toUpperCase(), x, y, { charSpace: 0.4 });
    font('normal', 10.5); color(INK);
    const t = doc.splitTextToSize(val || '-', maxw); doc.text(t, x, y + 5.3);
    return t.length;
  }
  const filas = Math.max(
    dato('Cliente', d.cliente, M, 52),
    dato('Equipo', d.equipo, M + 56, 62),
    dato('Recibido', d.fechaRecepcion, M + 124, 26),
    dato('Entregado', d.fechaEntrega, M + 152, 26));
  y += v(6) + filas * 4.6;
  if (d.serie) { font('normal', 8.5); color(MUTED); doc.text('N° de serie: ' + d.serie, M, y); y += 4; }
  y += v(3);

  /* ---------- Resultado ---------- */
  const tono = d.resultado.id === 'sin_arreglo' ? RED : (d.resultado.id === 'parcial' || d.resultado.id === 'diagnostico') ? AMBER : GREEN;
  font('normal', 9.5);
  const fr = doc.splitTextToSize(d.resultado.frase, CW - 14);
  const rh = v(15) + fr.length * v(4.2);
  fill(ZEBRA); doc.rect(M, y, CW, rh, 'F');
  fill(tono); doc.rect(M, y, 1.8, rh, 'F');
  font('bold', 7.5); color(MUTED); doc.text('RESULTADO', M + 7, y + 6.5, { charSpace: 0.5 });
  font('bold', 15); color(tono === GREEN ? GREEN_D : tono); doc.text(d.resultado.nombre, M + 7, y + v(13));
  font('normal', 9.5); color(INK); doc.text(fr, M + 7, y + v(18.5));
  y += rh + v(4);

  /* ---------- Secciones ---------- */
  if (d.falla) { seccion('Lo que me contaste'); parrafo(d.falla, 10.5, MUTED); }
  if (d.diagnostico) { seccion('Diagnóstico'); parrafo(d.diagnostico); }

  if (d.tareas.length) {
    seccion('Qué hice');
    const colW = CW / 2 - 3;
    font('normal', 10);
    // en dos columnas, rellenando por filas
    for (let i = 0; i < d.tareas.length; i += 2) {
      const a = doc.splitTextToSize(d.tareas[i], colW - 8);
      const b = d.tareas[i + 1] ? doc.splitTextToSize(d.tareas[i + 1], colW - 8) : [];
      const h = Math.max(a.length, b.length) * v(4.4) + v(2.6);
      lugar(h);
      font('normal', 10); color(INK);
      tilde(M, y); doc.text(a, M + 6.5, y);
      if (b.length) { tilde(M + colW + 6, y); doc.text(b, M + colW + 12.5, y); }
      y += h;
    }
    y += 1;
  }

  if (d.repuestos.length) {
    seccion('Repuestos instalados', 16);
    fill(INK); doc.rect(M, y, CW, 7, 'F');
    font('bold', 7.5); doc.setTextColor(232, 237, 234);
    doc.text('REPUESTO', M + 3, y + 4.7, { charSpace: 0.3 });
    doc.text('DETALLE', M + 70, y + 4.7, { charSpace: 0.3 });
    y += 7;
    d.repuestos.forEach((r, i) => {
      font('normal', 10);
      const n = doc.splitTextToSize(r.nombre || '-', 62), t = doc.splitTextToSize(r.detalle || '-', CW - 73);
      const h = Math.max(n.length, t.length) * v(4.4) + v(4);
      lugar(h);
      if (i % 2 === 0) { fill(ZEBRA); doc.rect(M, y, CW, h, 'F'); }
      font('bold', 10); color(INK); doc.text(n, M + 3, y + 5.4);
      font('normal', 10); color(MUTED); doc.text(t, M + 70, y + 5.4);
      y += h;
    });
    y += 3;
  }

  if (d.metricas.length) {
    seccion('Antes y después', 16);
    const cA = M + 92, cD = M + 140;
    font('bold', 7.5); color(MUTED);
    doc.text('MEDICIÓN', M, y, { charSpace: 0.3 });
    doc.text('ANTES', cA, y, { charSpace: 0.3 });
    doc.text('DESPUÉS', cD, y, { charSpace: 0.3 });
    y += 3;
    d.metricas.forEach((m) => {
      const h = v(9);
      lugar(h);
      stroke(LINE); doc.setLineWidth(0.3); doc.line(M, y, M + CW, y);
      font('normal', 10); color(INK); doc.text(doc.splitTextToSize(m.nombre || '-', 86)[0], M, y + 6);
      color(MUTED); doc.text(doc.splitTextToSize(m.antes || '-', 36)[0], cA, y + 6);
      flecha(cD - 12, y + 4.6, 7);
      font('bold', 11); color(GREEN_D); doc.text(doc.splitTextToSize(m.despues || '-', CW - (cD - M))[0], cD, y + 6);
      y += h;
    });
    stroke(LINE); doc.line(M, y, M + CW, y);
    y += 4;
  }

  if (d.pruebas.length) {
    seccion('Lo que probé antes de entregarlo');
    const colW = CW / 3;
    for (let i = 0; i < d.pruebas.length; i += 3) {
      lugar(7);
      for (let j = 0; j < 3 && i + j < d.pruebas.length; j++) {
        const x = M + j * colW;
        tilde(x, y);
        font('normal', 9.5); color(INK);
        doc.text(doc.splitTextToSize(d.pruebas[i + j], colW - 8)[0], x + 6.5, y);
      }
      y += v(6.6);
    }
    y += 1;
  }

  if (d.recomendaciones.length) {
    seccion('Mis recomendaciones');
    d.recomendaciones.forEach((r) => {
      font('normal', 10.5);
      const t = doc.splitTextToSize(r, CW - 7);
      lugar(t.length * v(4.5) + v(2));
      fill(GREEN); doc.circle(M + 1.4, y - 1.3, 1.1, 'F');
      color(INK); doc.text(t, M + 6, y);
      y += t.length * v(4.5) + v(2);
    });
    y += 1;
  }

  /* ---------- Garantía e importe ---------- */
  const conImporte = d.mostrarTotal && d.total != null;
  lugar(v(32));
  y += v(3);
  const gw = conImporte ? CW - 68 : CW;
  fill(ZEBRA); doc.rect(M, y, gw, 28, 'F');
  fill(GREEN); doc.rect(M, y, 1.8, 28, 'F');
  font('bold', 7.5); color(MUTED); doc.text('GARANTÍA', M + 7, y + 6.5, { charSpace: 0.5 });
  if (d.garantiaDias > 0) {
    font('bold', 13); color(INK); doc.text('Hasta el ' + d.garantiaHasta, M + 7, y + 13.5);
    font('normal', 8.8); color(MUTED);
    const gt = d.garantiaDias + (d.garantiaDias == 1 ? ' día' : ' días') + ' sobre el trabajo realizado.' +
      (d.wsp ? ' Si algo no anda bien, escribime por WhatsApp al ' + d.wsp + '.' : '');
    doc.text(doc.splitTextToSize(gt, gw - 12), M + 7, y + 19);
  } else {
    font('normal', 10); color(INK); doc.text('Sin garantía para este trabajo.', M + 7, y + 13.5);
  }
  if (conImporte) {
    const bx = M + CW - 64;
    fill(DARK); doc.rect(bx, y, 64, 28, 'F');
    font('bold', 7.5); doc.setTextColor(150, 162, 156); doc.text('IMPORTE TOTAL', bx + 6, y + 6.5, { charSpace: 0.5 });
    font('bold', 20); color(GREEN); doc.text(fmt(d.total), bx + 60, y + 19, { align: 'right' });
  }
  y += 32;

  /* ---------- Pie en cada página ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE); doc.setLineWidth(0.3); doc.line(M, H - 20, W - M, H - 20);
    font('bold', 8.5); color(INK); doc.text('Mario PC', M, H - 14);
    const contacto = [];
    if (d.web) contacto.push(d.web);
    if (d.ig) contacto.push('Instagram ' + d.ig);
    if (d.wsp) contacto.push('WhatsApp ' + d.wsp);
    font('normal', 8.5); color(MUTED); doc.text(contacto.join('   ·   '), M + 15, H - 14);
    font('normal', 7.5); doc.text('Gracias por confiar en Mario PC. Documento sin valor fiscal.', M, H - 9.5);
    if (pages > 1) doc.text(p + ' / ' + pages, W - M, H - 9.5, { align: 'right' });
  }
  return doc;
}
