// Clientes para volver a contactar: un año después de un trabajo con limpieza, para la limpieza anual.

import { db, trabajosDelCliente } from './store.js';
import { diasEntre, todayISO } from './util.js';
import { REC_LIMPIEZA } from './catalog.js';

export const DIAS_RECORDATORIO = 365;

function llevaLimpieza(t) {
  const inf = t.informe;
  return !!inf && (inf.recomendaciones.includes(REC_LIMPIEZA) || inf.tareas.includes('Limpieza interna completa'));
}

// Trabajos entregados hace un año o más, con limpieza, sin recordatorio mandado y sin un trabajo más nuevo del mismo cliente
export function paraRecordar() {
  const hoy = todayISO();
  return db.trabajos.filter((t) => {
    if (t.estado !== 'entregado' || t.recordatorio || !t.cliente.tel.trim() || !llevaLimpieza(t)) return false;
    const entregado = t.informe.fechaEntrega || t.fecha;
    const d = diasEntre(entregado, hoy);
    if (d == null || d < DIAS_RECORDATORIO) return false;
    return !trabajosDelCliente(t.cliente.tel, t.id).some((x) => String(x.fecha) > String(entregado));
  }).sort((a, b) => String(a.informe.fechaEntrega).localeCompare(String(b.informe.fechaEntrega)));
}
