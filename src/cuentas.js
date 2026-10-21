// Cuentas de cada trabajo: total, guarda, seña, saldo, costos, ganancia y diezmo.

import { db } from './store.js';
import { diasEntre, todayISO, addDays } from './util.js';

const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

// Lo que sale el trabajo (sin guarda): el importe del informe o, si todavía no hay, el del presupuesto aprobado
export function totalTrabajo(t) {
  if (t.informe && num(t.informe.total) != null) return t.informe.total;
  if (t.garantiaDe) return 0;
  const pres = t.presupuestoId ? db.presupuestos.find((p) => p.id === t.presupuestoId) : null;
  return pres && !pres.missing ? pres.total : null;
}

/* ---------- Plazo de retiro y guarda ---------- */
export const plazoRetiro = () => db.cfg.retiro.dias;
// Días que lleva listo para retirar (hasta hoy, o hasta que se entregó)
export function diasListo(t) {
  if (!t.listoDesde) return null;
  return diasEntre(t.listoDesde, t.entregadoEl || todayISO());
}
// Desde qué fecha corre la guarda
export function guardaDesde(t) {
  return t.listoDesde ? addDays(String(t.listoDesde).slice(0, 10), plazoRetiro() + 1) : null;
}
export function diasGuarda(t) {
  const d = diasListo(t);
  return d == null ? 0 : Math.max(0, d - plazoRetiro());
}
export function montoGuarda(t) {
  if (t.pago && t.pago.sinGuarda) return 0;
  return diasGuarda(t) * (db.cfg.retiro.porDia || 0);
}

/* ---------- Cobro ---------- */
export const sena = (t) => (t.pago && num(t.pago.sena)) || 0;
// Total a cobrar: trabajo + guarda
export function totalACobrar(t) {
  const tt = totalTrabajo(t);
  return tt == null ? null : tt + montoGuarda(t);
}
export function saldo(t) {
  if (t.pago && t.pago.pagado) return 0;
  const tot = totalACobrar(t);
  return tot == null ? null : tot - sena(t);
}
// Todo lo que entró por este trabajo (seña + pago final)
export function cobradoTotal(t) {
  return sena(t) + ((t.pago && t.pago.pagado && num(t.pago.pagoMonto)) || 0);
}
export const faltaCobrar = (t) => t.estado === 'entregado' && !(t.pago && t.pago.pagado);

/* ---------- Costos y ganancia ---------- */
export function costos(t) {
  const reps = ((t.informe && t.informe.repuestos) || []).filter((r) => !r.cliente).reduce((s, r) => s + (num(r.costo) || 0), 0);
  return reps + ((t.pago && num(t.pago.gastos)) || 0);
}
// Ganancia: lo cobrado menos lo que gastaste (incluye la mano de obra)
export const ganancia = (t) => cobradoTotal(t) - costos(t);
export const pctDiezmo = () => db.cfg.diezmo.pct;
export const diezmoDe = (monto) => Math.round(Math.max(0, monto) * pctDiezmo() / 100);

/* ---------- Por mes ---------- */
const mesDe = (iso) => String(iso || '').slice(0, 7);
// Plata que entró en el mes: señas cobradas ese mes + pagos finales de ese mes
export function cobradoEnMes(m) {
  let total = 0;
  for (const t of db.trabajos) {
    if (t.pago && mesDe(t.pago.senaFecha) === m) total += sena(t);
    if (t.pago && t.pago.pagado && mesDe(t.pago.pagoFecha) === m) total += num(t.pago.pagoMonto) || 0;
  }
  return total;
}
// Trabajos cerrados (pagados) en el mes: su ganancia cuenta ese mes
export const cerradosEnMes = (m) => db.trabajos.filter((t) => t.pago && t.pago.pagado && mesDe(t.pago.pagoFecha) === m);
export function gananciaDelMes(m) {
  const ts = cerradosEnMes(m);
  return { trabajos: ts.length, cobrado: ts.reduce((s, t) => s + cobradoTotal(t), 0), costos: ts.reduce((s, t) => s + costos(t), 0), ganancia: ts.reduce((s, t) => s + ganancia(t), 0) };
}
// Meses anteriores con diezmo sin marcar
export function diezmosPendientes() {
  const hoy = mesDe(todayISO());
  const meses = new Set(db.trabajos.filter((t) => t.pago && t.pago.pagado).map((t) => mesDe(t.pago.pagoFecha)).filter((m) => m && m < hoy));
  return [...meses].sort().filter((m) => !db.cfg.diezmo.dados[m] && diezmoDe(gananciaDelMes(m).ganancia) > 0);
}
