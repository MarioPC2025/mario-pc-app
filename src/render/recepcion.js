// Etiqueta para la Phomemo M02 (384 px de ancho, blanco y negro) y comprobante A4 para el cliente.
// Es el mismo diseño del artefacto "Recepción Mario PC", ahora alimentado con la ficha del trabajo.

import { ACCESORIOS, DANOS, equipoNombre, claveNombre } from '../catalog.js';
import { fechaFmt, diaCorto, fmt } from '../util.js';
import { PREFIJO_FICHA, dibujarQR, modulosQR } from '../qr.js';
import { MARK_ETIQUETA, MARK_A4 } from '../brand.js';
import { FD, FB, FM, wrapLines, limitLines, toBW, cargarImagen } from './canvas.js';

let MK = null;
export async function prepararLogos() {
  if (!MK) MK = { label: await cargarImagen(MARK_ETIQUETA), a4: await cargarImagen(MARK_A4) };
  return MK;
}

export function accList(t) {
  const out = ACCESORIOS.filter((a) => t.acc.includes(a));
  if (t.accOtro.trim()) out.push(t.accOtro.trim());
  return out;
}
export function danoList(t, corto) {
  const out = DANOS.filter((d) => t.danos.includes(d.id)).map((d) => (corto ? d.corto : d.nombre));
  if (t.danoOtro.trim()) out.push(t.danoOtro.trim());
  return out;
}
export function equipoTexto(t) {
  return [equipoNombre(t.equipo.tipo), t.equipo.marca.trim(), t.equipo.modelo.trim()].filter(Boolean).join(' ');
}

/* ---------- Etiqueta ---------- */
function labelRows(t, cfg) {
  let cliente = t.cliente.nombre.trim();
  if (cfg.etiqueta.tel && t.cliente.tel.trim()) cliente = (cliente ? cliente + ' · ' : '') + t.cliente.tel.trim();
  const clave = t.clave === 'no' ? 'No' : 'Sí (' + claveNombre(t.clave) + ')';
  return [
    { k: 'CLIENTE', t: cliente || '-', max: 1 },
    { k: 'EQUIPO', t: equipoTexto(t), max: 1 },
    { k: 'FALLA', t: t.falla.trim() || '-', max: 3 },
    { k: 'ACCES.', t: accList(t).join(', ') || 'Ninguno', max: 1 },
    { k: 'CLAVE', t: clave, max: 1 },
    { k: 'DAÑOS', t: danoList(t, true).join(', ') || 'Sin daños visibles', max: 2 },
  ];
}

export function drawLabel(t, cfg) {
  const W = cfg.etiqueta.largo * 8, H = 384, M = 10;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff'; c.fillRect(0, 0, W, H); c.fillStyle = '#000'; c.textBaseline = 'alphabetic';
  // cabecera
  const num = String(t.orden || '-');
  c.font = '400 62px ' + FB;
  const nw = c.measureText(num).width, bw = Math.max(130, Math.round(nw + 78)), bh = 72;
  c.fillRect(M, M, bw, bh);
  c.fillStyle = '#fff'; c.font = '700 20px ' + FD; c.fillText('N°', M + 12, M + 30);
  c.font = '400 62px ' + FB; c.fillText(num, M + 56, M + 58);
  c.fillStyle = '#000';
  let tx = M + bw + 16;
  if (MK && MK.label) { c.drawImage(MK.label, tx, M + 10); tx += MK.label.naturalWidth + 10; }
  c.font = '400 46px ' + FB; const tw = c.measureText('MARIO PC').width; c.fillText('MARIO PC', tx, M + 36);
  // fecha: la versión más completa que entre (dd/mm/aaaa, dd/mm/aa o dd/mm)
  c.font = '700 20px ' + FD; const sw2 = c.measureText('Servicio técnico').width;
  const d0 = fechaFmt(t.fecha), dc = [d0, d0.slice(0, 6) + d0.slice(8), d0.slice(0, 5)];
  let ds = null, dy = M + 26;
  c.font = '700 22px ' + FM;
  const cabe = (txt, izq) => W - M - c.measureText(txt).width > izq + 14;
  for (let i = 0; i < dc.length && ds === null; i++) if (cabe(dc[i], tx + tw)) ds = dc[i];
  if (ds === null) { dy = M + 62; for (let i = 0; i < dc.length && ds === null; i++) if (cabe(dc[i], tx + sw2)) ds = dc[i]; }
  if (ds !== null) {
    c.font = '700 20px ' + FD; c.fillText('Servicio técnico', tx, M + 62);
    c.font = '700 22px ' + FM; c.textAlign = 'right'; c.fillText(ds, W - M, dy); c.textAlign = 'left';
  } else { c.font = '700 22px ' + FM; c.fillText(d0, tx, M + 62); }
  c.fillRect(M, M + bh + 10, W - 2 * M, 3);
  // filas a la izquierda, QR a la derecha y, si hay fecha prometida, la entrega abajo
  const top = M + bh + 10 + 3 + 14;
  const entrega = t.entrega ? diaCorto(t.entrega) : '';
  const pieH = entrega ? 44 : 0;
  const bottom = H - M - pieH;
  const qrTexto = PREFIJO_FICHA + t.id;
  const n = modulosQR(qrTexto);
  const valueX = M + 112;
  // el QR más grande que deje al menos 210 px para el texto
  const altoQR = H - M - top + 4;
  const modulo = Math.max(3, Math.min(Math.floor(altoQR / n), Math.floor((W - valueX - M - 16 - 210) / n)));
  const lado = n * modulo;
  const qrX = W - M - lado, qrY = top - 4 + Math.round((altoQR - lado) / 2);
  dibujarQR(c, qrTexto, qrX, qrY, modulo);
  const avail = bottom - 8 - top;
  const maxW = qrX - 16 - valueX, rows = labelRows(t, cfg);
  function layout(fs, cap) {
    c.font = '700 ' + fs + 'px ' + FD;
    const lh = Math.round(fs * 1.2), out = [];
    let h = 0;
    rows.forEach((r) => {
      const mx = cap && cap[r.k] ? cap[r.k] : r.max;
      const lines = limitLines(c, wrapLines(c, r.t, maxW), mx, maxW);
      out.push({ k: r.k, lines }); h += lines.length * lh + 6;
    });
    return { out, h: h - 6, lh, fs };
  }
  let lay = null;
  for (const sz of [26, 24, 22, 21, 20, 19, 18, 17]) { lay = layout(sz); if (lay.h <= avail) break; }
  if (lay.h > avail) lay = layout(17, { FALLA: 2, 'DAÑOS': 1 });
  let y = top;
  lay.out.forEach((r) => {
    const base = y + Math.round(lay.fs * 0.92);
    c.font = '700 ' + Math.max(15, Math.round(lay.fs * 0.72)) + 'px ' + FD; c.fillText(r.k, M, base);
    c.font = '700 ' + lay.fs + 'px ' + FD;
    r.lines.forEach((l, j) => c.fillText(l, valueX, base + j * lay.lh));
    y += r.lines.length * lay.lh + 6;
  });
  // entrega prometida
  if (entrega) {
    const ey = H - M - 6;
    c.fillRect(M, ey - 40, qrX - 16 - M, 2);
    c.font = '700 18px ' + FD; c.fillText('ENTREGA', M, ey - 6);
    c.font = '400 40px ' + FB; c.fillText(entrega.toUpperCase(), valueX, ey);
  }
  toBW(cv);
  return cv;
}

// La Phomemo imprime a lo ancho del papel (384 px): la etiqueta horizontal se gira 90°
export function rotarParaImpresora(src, antihorario) {
  const out = document.createElement('canvas'); out.width = src.height; out.height = src.width;
  const c = out.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#fff'; c.fillRect(0, 0, out.width, out.height); c.imageSmoothingEnabled = false;
  if (antihorario) { c.translate(0, src.width); c.rotate(-Math.PI / 2); }
  else { c.translate(src.height, 0); c.rotate(Math.PI / 2); }
  c.drawImage(src, 0, 0);
  toBW(out);
  return out;
}

/* ---------- Comprobante A4 (200 dpi) ---------- */
const AVISO = 'Antes de dejar el equipo, hacé una copia de seguridad (backup) de tus archivos. Mario PC no se hace responsable por la pérdida de información guardada en el equipo. Si el trabajo requiere formatear, reinstalar el sistema o cambiar el disco, los datos pueden perderse.';
const SENA = 'Si cancelás el trabajo después de dejar la seña, la seña no se devuelve: cubre los repuestos encargados y el trabajo ya hecho.';
// Condiciones que salen en el comprobante: [título, texto]
const plata = (n) => fmt(n).replace(' ', '\u00a0');
export function condiciones(cfg) {
  const out = [['Tus datos', AVISO]];
  const r = cfg.retiro;
  if (r && r.dias > 0) {
    out.push(['Retiro del equipo', 'Cuando te avise que está listo, tenés ' + r.dias + ' días para retirarlo.' +
      (r.porDia > 0 ? ' Pasado ese plazo se cobra un cargo por guarda de ' + plata(r.porDia) + ' por día (' + plata(r.porDia * 30) + '\u00a0por mes), que se suma al total del trabajo.' : '') +
      ' El equipo se entrega solo con el pago completo.']);
  }
  out.push(['Seña', SENA]);
  const g = cfg.negocio.garantiaDias;
  if (g > 0) out.push(['Garantía', g + (g == 1 ? ' día' : ' días') + ' sobre el trabajo realizado.']);
  return out;
}

function drawA4(t, cfg, k, firmas = true) {
  const PW = 1654, PH = 2339, u = PW / 210;
  const cv = document.createElement('canvas'); cv.width = PW; cv.height = PH;
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, PW, PH); c.fillStyle = '#000'; c.textBaseline = 'alphabetic';
  const mm = (v) => v * u;
  const X = mm(14), CW = PW - 2 * X;
  let y = mm(12);
  const F = (w, s, fam, kk) => { c.font = w + ' ' + Math.round(mm(s * (kk || 1))) + 'px ' + fam; };
  // cabecera
  let mkx = X;
  if (MK && MK.a4) { const mkh = mm(22), mkw = mkh * MK.a4.naturalWidth / MK.a4.naturalHeight; c.drawImage(MK.a4, X, y, mkw, mkh); mkx = X + mkw + mm(5); }
  F('400', 17, FB); c.fillText('MARIO PC', mkx, y + mm(13));
  F('400', 4.2, FD); c.fillText('Reparación de PC y notebooks', mkx, y + mm(20));
  const bx = PW - X - mm(46), by = y;
  c.fillRect(bx, by, mm(46), mm(22));
  c.fillStyle = '#fff'; F('700', 3.8, FD); c.fillText('N°', bx + mm(4), by + mm(8));
  F('400', 15, FB); c.fillText(String(t.orden || '-'), bx + mm(14), by + mm(17.5));
  c.fillStyle = '#000';
  c.fillRect(X, y + mm(25), CW, mm(1));
  F('700', 3.6, FM); c.fillText('COMPROBANTE DE RECEPCIÓN DE EQUIPO', X, y + mm(33));
  c.textAlign = 'right'; c.fillText('Fecha: ' + fechaFmt(t.fecha), PW - X, y + mm(33)); c.textAlign = 'left';
  y += mm(41);
  const sigTop = PH - mm(46);
  function sec(title) {
    y += mm(5 * k); F('700', 3.3, FM, k); c.fillStyle = '#000'; c.fillText(title.toUpperCase(), X, y);
    y += mm(1.8 * k); c.fillRect(X, y, CW, Math.max(1.5, mm(0.3))); y += mm(5 * k);
  }
  function drawField(x, wmm, label, val, max) {
    const w = mm(wmm);
    let off = 0;
    if (label) { F('700', 2.7, FM, k); c.fillStyle = '#555'; c.fillText(label.toUpperCase(), x, y + mm(2.7 * k)); c.fillStyle = '#000'; off = mm(2.7 * k); }
    F('700', 4.4, FD, k);
    const lines = limitLines(c, wrapLines(c, val, w), max || 2, w), lh = mm(5.8 * k), ly = y + off + mm(5.4 * k);
    lines.forEach((l, i) => c.fillText(l, x, ly + i * lh));
    return off + mm(5.4 * k) + (lines.length - 1) * lh + mm(1.8 * k);
  }
  function row(fields) {
    let x = X, hmax = 0;
    fields.forEach((fl) => { fl.x = x; fl.h = drawField(x, fl.w, fl.label, fl.val, fl.max); hmax = Math.max(hmax, fl.h); x += mm(fl.w + 4); });
    c.fillStyle = '#bbb';
    fields.forEach((fl) => c.fillRect(fl.x, y + hmax - mm(0.6), mm(fl.w), 2));
    c.fillStyle = '#000'; y += hmax + mm(2.5 * k);
  }
  const dash = (s) => (s && String(s).trim() ? String(s).trim() : '-');
  if (t.garantiaDe) {
    F('700', 4.2, FD, k); c.fillText('Reclamo de garantía del trabajo N° ' + t.garantiaDe.orden + ' (' + fechaFmt(t.garantiaDe.fecha) + ').', X, y + mm(2 * k)); y += mm(5 * k);
  }
  sec('Cliente');
  row([{ w: 112, label: 'Nombre y apellido', val: dash(t.cliente.nombre) }, { w: 66, label: 'Teléfono', val: dash(t.cliente.tel) }]);
  sec('Equipo');
  row([{ w: 44, label: 'Tipo', val: equipoNombre(t.equipo.tipo) }, { w: 44, label: 'Marca', val: dash(t.equipo.marca) }, { w: 86, label: 'Modelo', val: dash(t.equipo.modelo) }]);
  row([{ w: 112, label: 'N° de serie / IMEI', val: dash(t.equipo.serie) }, { w: 66, label: 'Clave de acceso', val: t.clave === 'no' ? 'No tiene' : claveNombre(t.clave) + ' (se borra al entregar)' }]);
  sec('Falla que reporta el cliente');
  F('500', 4.2, FD, k);
  const fl = limitLines(c, wrapLines(c, dash(t.falla), CW - mm(8)), 7, CW - mm(8)), lh = mm(5.8 * k);
  const boxH = Math.max(mm(20 * k), fl.length * lh + mm(6 * k));
  c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(X, y, CW, boxH);
  fl.forEach((l, i) => c.fillText(l, X + mm(4), y + mm(8 * k) + i * lh));
  y += boxH + mm(3 * k);
  sec('Accesorios que deja');
  row([{ w: 182, label: '', val: accList(t).join(', ') || 'Ninguno', max: 2 }]);
  sec('Estado físico al recibir');
  const colW = CW / 3, bsz = mm(4.2 * k), rowH = mm(7.4 * k);
  DANOS.forEach((d, i) => {
    const cx = X + (i % 3) * colW, cy = y + Math.floor(i / 3) * rowH, on = t.danos.includes(d.id);
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(cx, cy, bsz, bsz);
    if (on) {
      c.lineWidth = Math.max(3, mm(0.55)); c.beginPath();
      c.moveTo(cx + bsz * 0.15, cy + bsz * 0.15); c.lineTo(cx + bsz * 0.85, cy + bsz * 0.85);
      c.moveTo(cx + bsz * 0.85, cy + bsz * 0.15); c.lineTo(cx + bsz * 0.15, cy + bsz * 0.85); c.stroke();
    }
    let sz = 3.9 * k;
    const tw = colW - bsz - mm(5);
    do { c.font = (on ? '700 ' : '400 ') + Math.round(mm(sz)) + 'px ' + FD; sz -= 0.2; } while (c.measureText(d.nombre).width > tw && sz > 2.6);
    c.fillStyle = '#000'; c.fillText(d.nombre, cx + bsz + mm(2), cy + bsz * 0.9);
  });
  y += Math.ceil(DANOS.length / 3) * rowH + mm(1 * k);
  if (t.danoOtro.trim()) row([{ w: 182, label: 'Otro observado', val: t.danoOtro.trim() }]);
  F('400', 3, FM, k); c.fillStyle = '#555'; c.fillText('X = observado al recibir el equipo', X, y + mm(2.5 * k)); c.fillStyle = '#000';
  y += mm(6 * k);
  if (t.obs.trim()) { sec('Observaciones'); row([{ w: 182, label: '', val: t.obs.trim(), max: 3 }]); }
  const sn = t.pago && typeof t.pago.sena === 'number' && t.pago.sena > 0 ? t.pago.sena : 0;
  if (sn) {
    sec('Seña');
    row([{ w: 60, label: 'Seña recibida', val: fmt(sn) }, { w: 56, label: 'Forma de pago', val: t.pago.senaMedio === 'mp' ? 'Mercado Pago' : 'Efectivo' }, { w: 58, label: 'Fecha', val: fechaFmt(t.pago.senaFecha || t.fecha) }]);
  }
  // condiciones: datos, retiro y seña
  y += mm(3 * k);
  const conds = condiciones(cfg), alh = mm(5 * k);
  F('400', 3.7, FD, k);
  const bloques = conds.map(([tit, txt]) => wrapLines(c, txt, CW - mm(10)));
  const ah = mm(13 * k) + bloques.reduce((s2, b) => s2 + mm(5.8 * k) + b.length * alh, 0);
  c.fillStyle = '#eeeeee'; c.fillRect(X, y, CW, ah); c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(X, y, CW, ah); c.fillStyle = '#000';
  F('700', 3.3, FM, k); c.fillText('CONDICIONES', X + mm(5), y + mm(6.5 * k));
  let cy = y + mm(12 * k);
  conds.forEach(([tit], i) => {
    F('700', 3.7, FD, k); c.fillText(tit + ':', X + mm(5), cy); cy += mm(5.4 * k);
    F('400', 3.7, FD, k); bloques[i].forEach((l) => { c.fillText(l, X + mm(5), cy); cy += alh; });
    cy += mm(0.4 * k);
  });
  y += ah + mm(4 * k);
  // sin firmas el contenido puede bajar hasta el pie
  const overflow = y > (firmas ? sigTop : PH - mm(24)) - mm(8);
  c.fillStyle = '#000';
  if (firmas) {
    const sw = mm(78);
    c.fillRect(X, sigTop, sw, 2); c.fillRect(PW - X - sw, sigTop, sw, 2);
    F('700', 3, FM); c.fillText('FIRMA Y ACLARACIÓN DEL CLIENTE', X, sigTop + mm(5)); c.fillText('MARIO PC', PW - X - sw, sigTop + mm(5));
  }
  // pie
  c.fillRect(X, PH - mm(24), CW, 2);
  const n = cfg.negocio, contacto = [];
  if (n.wsp.trim()) contacto.push('WhatsApp ' + n.wsp.trim());
  if (n.ig.trim()) contacto.push(n.ig.trim());
  if (n.web.trim()) contacto.push(n.web.trim());
  F('700', 4, FD); c.fillText(contacto.join('   ·   '), X, PH - mm(16));
  F('400', 3.4, FD); c.fillText('Gracias por confiar en Mario PC.', X, PH - mm(10));
  return { cv, overflow };
}

// opts.firmas (por defecto true): dibuja o no los campos de firma del cliente y de Mario PC
export function renderA4(t, cfg, { firmas = true } = {}) {
  let r = null;
  for (const k of [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64]) { r = drawA4(t, cfg, k, firmas); if (!r.overflow) break; }
  return r.cv;
}
