// Escáner de QR con la cámara: apuntás a la etiqueta y se abre la ficha.

import jsQR from 'jsqr';
import { el, toast } from './util.js';

export function abrirEscaner(onCodigo) {
  let stream = null, raf = 0, vivo = true;
  const video = el('video', { playsinline: true, muted: true, autoplay: true });
  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  const estado = el('p', { class: 'scan-hint', text: 'Apuntá al QR de la etiqueta' });
  const caja = el('div', { class: 'scan', role: 'dialog', 'aria-label': 'Escanear etiqueta' },
    video, el('div', { class: 'scan-frame', 'aria-hidden': 'true' }), estado,
    el('button', { type: 'button', class: 'btn scan-close', text: 'Cerrar', onclick: () => cerrar() }));
  document.body.append(caja);

  const onBack = (e) => { e.preventDefault(); cerrar(); };
  document.addEventListener('mpc-back', onBack);

  function cerrar() {
    vivo = false;
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach((tr) => tr.stop());
    document.removeEventListener('mpc-back', onBack);
    caja.remove();
  }

  function leer() {
    if (!vivo) return;
    if (video.readyState >= 2 && video.videoWidth) {
      // se analiza una versión achicada: más rápido y alcanza para un QR impreso
      const esc = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
      lienzo.width = Math.round(video.videoWidth * esc);
      lienzo.height = Math.round(video.videoHeight * esc);
      ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
      const img = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
      const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (r && r.data) {
        if (navigator.vibrate) navigator.vibrate(60);
        cerrar();
        onCodigo(r.data);
        return;
      }
    }
    raf = requestAnimationFrame(leer);
  }

  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
    .then((s) => {
      if (!vivo) { s.getTracks().forEach((tr) => tr.stop()); return; }
      stream = s; video.srcObject = s; video.play().catch(() => {});
      raf = requestAnimationFrame(leer);
    })
    .catch(() => {
      cerrar();
      toast('No pude abrir la cámara. Revisá que la app tenga permiso de Cámara.', 4000);
    });
}
