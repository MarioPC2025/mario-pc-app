// PDF del presupuesto: el mismo diseño del artefacto "Presupuestador Mario PC".

import { jsPDF } from 'jspdf';
import { fmt } from '../util.js';
import { MARK_COLOR } from '../brand.js';

export function armarPresupuestoPdf(d) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, CW = W - 2 * M;
  const INK = [12, 17, 14], MUTED = [95, 107, 101], LINE = [214, 221, 217], ZEBRA = [243, 246, 244],
    GREEN = [29, 221, 101], GREEN_D = [10, 122, 53], DARK = [7, 9, 10], AMBER = [150, 98, 0];
  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);
  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const font = (style, size) => { doc.setFont('helvetica', style); doc.setFontSize(size); };

  // Encabezado
  fill(DARK); doc.rect(0, 0, W, 34, 'F');
  fill(GREEN); doc.rect(0, 34, W, 1.2, 'F');
  let MW = 16.1;
  try { doc.addImage(MARK_COLOR, 'PNG', M, 10.5, MW, 14.5); } catch (e) { fill(GREEN); doc.circle(M + 2.2, 15.2, 2.2, 'F'); MW = 3; }
  const TX = M + MW + 4;
  font('bold', 24); doc.setTextColor(232, 237, 234); doc.text('MARIO PC', TX, 18);
  font('normal', 9); doc.setTextColor(150, 162, 156); doc.text('Reparación de PC y notebooks', TX, 24.5);
  font('bold', 15); color(GREEN); doc.text('PRESUPUESTO', W - M, 15.5, { align: 'right' });
  font('normal', 9); doc.setTextColor(200, 208, 204);
  doc.text('N° ' + d.numero, W - M, 21.5, { align: 'right' });
  doc.text(d.fecha, W - M, 26.5, { align: 'right' });

  // Datos
  let y = 48;
  function dato(lbl, val, x, yy, maxw) {
    font('bold', 7.5); color(MUTED); doc.text(lbl.toUpperCase(), x, yy, { charSpace: 0.4 });
    font('normal', 11); color(INK);
    const t = doc.splitTextToSize(val, maxw); doc.text(t, x, yy + 5.5);
    return t.length;
  }
  const filas = Math.max(
    dato('Cliente', d.cliente || '-', M, y, 64),
    dato(d.equipoLbl || 'Equipo', d.equipo, M + 70, y, 62),
    dato(d.validoHasta ? 'Válido hasta' : 'Fecha', d.validoHasta || d.fecha, W - M - 40, y, 40));
  y += 11 + filas * 5;

  // Tabla
  const cQ = M + CW - 62, cU = M + CW - 30, cS = M + CW;
  function cabecera() {
    fill(INK); doc.rect(M, y, CW, 8, 'F');
    font('bold', 8); doc.setTextColor(232, 237, 234);
    doc.text('DESCRIPCIÓN', M + 3, y + 5.3, { charSpace: 0.3 });
    doc.text('CANT.', cQ, y + 5.3, { align: 'center', charSpace: 0.3 });
    doc.text('UNITARIO', cU, y + 5.3, { align: 'right', charSpace: 0.3 });
    doc.text('SUBTOTAL', cS - 3, y + 5.3, { align: 'right', charSpace: 0.3 });
    y += 8;
  }
  cabecera();
  if (!d.lines.length) { font('italic', 10); color(MUTED); doc.text('Sin ítems.', M + 3, y + 7); y += 11; }
  d.lines.forEach((l, i) => {
    font('normal', 10);
    const txt = doc.splitTextToSize(l.nombre, cQ - M - 14);
    const h = Math.max(9, txt.length * 4.6 + 4.4);
    if (y + h > H - 60) { doc.addPage(); y = M; cabecera(); }
    if (i % 2 === 0) { fill(ZEBRA); doc.rect(M, y, CW, h, 'F'); }
    color(INK); doc.text(txt, M + 3, y + 5.8);
    doc.text(String(l.qty), cQ, y + 5.8, { align: 'center' });
    if (l.precio == null) {
      font('italic', 10); color(AMBER);
      doc.text('a confirmar', cS - 3, y + 5.8, { align: 'right' });
      color(MUTED); doc.text('-', cU, y + 5.8, { align: 'right' });
    } else {
      color(MUTED); doc.text(fmt(l.precio), cU, y + 5.8, { align: 'right' });
      font('bold', 10); color(INK); doc.text(fmt(l.precio * l.qty), cS - 3, y + 5.8, { align: 'right' });
    }
    y += h;
  });
  stroke(LINE); doc.setLineWidth(0.3); doc.line(M, y, M + CW, y);

  // Total
  y += 8;
  const bw = 78, bx = M + CW - bw;
  fill(ZEBRA); doc.rect(bx, y, bw, 20, 'F');
  fill(GREEN); doc.rect(bx, y, 1.6, 20, 'F');
  font('bold', 8); color(MUTED); doc.text(d.missing ? 'TOTAL PARCIAL' : 'TOTAL', bx + 6, y + 7, { charSpace: 0.4 });
  font('bold', 20); color(GREEN_D); doc.text(fmt(d.total), bx + bw - 4, y + 14.5, { align: 'right' });
  y += 20;
  if (d.missing) {
    y += 5; font('italic', 8.5); color(AMBER);
    doc.text('Los ítems "a confirmar" se suman al total cuando se definan.', M + CW, y, { align: 'right' });
  }

  // Condiciones
  const cond = [];
  if (d.validez > 0) cond.push(['Validez', d.validez + (d.validez == 1 ? ' día' : ' días') + ' desde la fecha de emisión']);
  if (d.garantia) cond.push(['Garantía', d.garantia]);
  if (d.pagos) cond.push(['Formas de pago', d.pagos]);
  if (cond.length) {
    y += 14;
    if (y + cond.length * 7 + 10 > H - 30) { doc.addPage(); y = M; }
    font('bold', 8); color(INK); doc.text('CONDICIONES', M, y, { charSpace: 0.4 });
    stroke(GREEN); doc.setLineWidth(0.6); doc.line(M, y + 2, M + 22, y + 2);
    y += 8;
    cond.forEach((c) => {
      font('bold', 9.5); color(INK); doc.text(c[0] + ':', M, y);
      const w = doc.getTextWidth(c[0] + ': ');
      font('normal', 9.5); color(MUTED);
      const t = doc.splitTextToSize(c[1], CW - w);
      doc.text(t, M + w, y); y += t.length * 4.6 + 2.2;
    });
  }

  // Pie en cada página
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    stroke(LINE); doc.setLineWidth(0.3); doc.line(M, H - 20, W - M, H - 20);
    font('bold', 8.5); color(INK); doc.text('Mario PC', M, H - 14);
    const contacto = [];
    if (d.web) contacto.push(d.web);
    if (d.ig) contacto.push('Instagram ' + d.ig);
    if (d.whatsapp) contacto.push('WhatsApp ' + d.whatsapp);
    font('normal', 8.5); color(MUTED); doc.text(contacto.join('   ·   '), M + 15, H - 14);
    font('normal', 7.5); doc.text('Presupuesto sin valor fiscal. No válido como factura.', M, H - 9.5);
    if (pages > 1) doc.text(p + ' / ' + pages, W - M, H - 9.5, { align: 'right' });
  }
  return doc.output('blob');
}
