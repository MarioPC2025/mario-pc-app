// Utilidades chicas que usan todas las pantallas.

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

// Crea un elemento: el('div', {class:'x', onclick:fn}, hijo1, 'texto', [hijos])
export function el(tag, attrs, ...kids) {
  const n = document.createElement(tag);
  if (attrs) {
    for (const k in attrs) {
      const v = attrs[k];
      if (v === false || v == null) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'value') n.value = v;
      else if (k === 'checked') n.checked = !!v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(add);
    else n.append(c.nodeType ? c : document.createTextNode(String(c)));
  };
  kids.forEach(add);
  return n;
}

export function uid(p = 'i') {
  return p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Dinero ---------- */
export function fmt(n) {
  n = Number(n) || 0;
  return (n < 0 ? '-$ ' : '$ ') + Math.abs(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}
export function inputFmt(n) {
  return n == null ? '' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 });
}
export function parseMoney(s) {
  s = String(s || '').trim();
  if (!s) return null;
  const neg = /^-/.test(s);
  s = s.replace(/[^\d,]/g, '').replace(',', '.');
  if (!s) return null;
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

/* ---------- Teléfono / WhatsApp (Argentina) ---------- */
export function waNumber(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('54')) d = d.slice(2);
  d = d.replace(/^0+/, '');
  if (d.length === 11 && d.charAt(0) === '9') return '54' + d;
  if (d.length === 12) {
    for (const p of [2, 3, 4]) {
      if (d.slice(p, p + 2) === '15') { d = d.slice(0, p) + d.slice(p + 2); break; }
    }
  }
  if (d.length === 10) return '549' + d;
  return '';
}

/* ---------- Fechas (siempre hora de Buenos Aires) ---------- */
const TZ = 'America/Argentina/Buenos_Aires';
export function todayISO() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}
export function fechaFmt(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
export function fechaCorta(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? m[3] + '/' + m[2] : '';
}
export function addDays(iso, n) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || todayISO());
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.toISOString().slice(0, 10);
}
export function diasEntre(aIso, bIso) {
  const a = Date.parse((aIso || '').slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse((bIso || '').slice(0, 10) + 'T00:00:00Z');
  if (!isFinite(a) || !isFinite(b)) return null;
  return Math.round((b - a) / 86400000);
}
export function haceCuanto(iso) {
  const d = diasEntre(iso, todayISO());
  if (d == null) return '';
  if (d <= 0) return 'hoy';
  if (d === 1) return 'ayer';
  if (d < 30) return 'hace ' + d + ' días';
  const m = Math.round(d / 30);
  return m <= 1 ? 'hace un mes' : 'hace ' + m + ' meses';
}
export function stampISO() {
  return new Date().toISOString();
}

/* ---------- Avisos ---------- */
let toastTimer = null;
export function toast(t, ms = 2600) {
  const n = $('#toast');
  n.textContent = t;
  n.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => n.classList.remove('show'), ms);
}

// Botón que pide un segundo toque para confirmar (para borrar cosas)
export function botonConfirmar(texto, textoConfirmar, accion, cls = 'btn danger-ghost') {
  let armado = false, t = null;
  const b = el('button', { type: 'button', class: cls, text: texto });
  b.addEventListener('click', () => {
    if (!armado) {
      armado = true; b.textContent = textoConfirmar; b.classList.add('armed');
      t = setTimeout(() => { armado = false; b.textContent = texto; b.classList.remove('armed'); }, 3500);
      return;
    }
    clearTimeout(t); armado = false; b.textContent = texto; b.classList.remove('armed');
    accion();
  });
  return b;
}

export function limpiarNombreArchivo(s) {
  return String(s).replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

// Campo de texto con etiqueta, devuelve {wrap, input}
export function campo(label, attrs = {}, oninput) {
  const id = attrs.id || uid('f');
  const tag = attrs.multiline ? 'textarea' : 'input';
  const a = Object.assign({ id, autocomplete: 'off' }, attrs);
  delete a.multiline;
  if (tag === 'input' && !a.type) a.type = 'text';
  const input = el(tag, a);
  if (oninput) input.addEventListener('input', () => oninput(input.value, input));
  const wrap = el('div', { class: 'field' }, el('label', { for: id, text: label }), input);
  return { wrap, input };
}

export function dinero(val, onVal, attrs = {}) {
  const i = el('input', Object.assign({ type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '0', value: inputFmt(val) }, attrs));
  i.addEventListener('input', () => onVal(parseMoney(i.value)));
  i.addEventListener('change', () => { i.value = inputFmt(parseMoney(i.value)); });
  return el('div', { class: 'money' }, el('span', { text: '$' }), i);
}
