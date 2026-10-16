# Mario PC — app del taller

App para Android que junta en un solo lugar:

- **Presupuesto**: lo armás, lo mandás por WhatsApp o en PDF, y si lo aprueban pasa directo a recepción.
- **Recepción**: la ficha del equipo, la etiqueta para la Phomemo M02 (impresión directa por Bluetooth) y el comprobante A4 para el cliente.
- **Informe técnico**: el PDF que se entrega con el equipo (diagnóstico, qué se hizo, repuestos, antes y después, pruebas, recomendaciones y garantía).
- **Trabajos**: el historial de equipos con su estado (Recibido → En reparación → Listo → Entregado).

Todo queda guardado **solo en el teléfono**. No usa internet ni cuentas. El respaldo se hace a mano desde Ajustes → Tus datos.

## Instalar o actualizar

1. En el teléfono, abrí este repo en GitHub → **Releases** → la versión más nueva → tocá el archivo `MarioPC-1.0.N.apk`.
2. La primera vez, Android pide permiso para "instalar apps desconocidas" desde el navegador: aceptalo.
3. Para actualizar, instalá el APK nuevo encima. Los datos se mantienen (todas las versiones van firmadas con la misma clave).

Cada cambio que se sube a `main` compila un APK nuevo solo (pestaña **Actions**, tarda unos 5 minutos).

## Cómo está armada

- `src/`: el código de la app (JavaScript sin frameworks). `views/` son las pantallas, `render/` arma la etiqueta, el comprobante y los PDF, `printer.js` habla con la Phomemo, `store.js` guarda los datos.
- `web/`: el HTML y los estilos.
- `android/`: el proyecto Android que genera Capacitor. `android/app/mariopc.keystore` es la clave de firma: **no la borres ni la cambies**, o el APK nuevo no se va a poder instalar encima del viejo.
- `scripts/build.mjs`: arma la carpeta `www/` que va dentro del APK.

Para probar en la compu: `npm ci && npm run build` y abrir `www/index.html` con un servidor local (por ejemplo `npx serve www`).

## Impresora

La Phomemo se conecta desde Ajustes → Impresora Phomemo (no hace falta emparejarla desde Android). Usa el protocolo raster de la M02 por Bluetooth LE (servicio `ff00`, característica `ff02`). Si conecta pero no imprime, probá el "Modo alternativo". Si nada funciona, la ficha tiene el botón para mandar la imagen de la etiqueta a la app oficial de Phomemo.
