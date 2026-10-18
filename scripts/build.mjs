// Arma la carpeta www/ que Capacitor mete dentro del APK.
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, copyFileSync } from 'node:fs';

const fuentes = {
  'dm-sans-400.woff2': '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2',
  'dm-sans-500.woff2': '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2',
  'dm-sans-700.woff2': '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2',
  'bebas-neue-400.woff2': '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2',
  'space-mono-400.woff2': '@fontsource/space-mono/files/space-mono-latin-400-normal.woff2',
  'space-mono-700.woff2': '@fontsource/space-mono/files/space-mono-latin-700-normal.woff2',
};

rmSync('www', { recursive: true, force: true });
mkdirSync('www/fonts', { recursive: true });
cpSync('web', 'www', { recursive: true });
for (const [dst, src] of Object.entries(fuentes)) copyFileSync('node_modules/' + src, 'www/fonts/' + dst);

// pdf.js para la vista previa de los PDF: se carga aparte, recién cuando se abre una vista previa
mkdirSync('www/pdfjs', { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) copyFileSync('node_modules/pdfjs-dist/legacy/build/' + f, 'www/pdfjs/' + f);
cpSync('node_modules/pdfjs-dist/standard_fonts', 'www/pdfjs/standard_fonts', { recursive: true });

const version = '1.0.' + (process.env.GITHUB_RUN_NUMBER || '0');
await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  target: ['chrome90'],
  minify: true,
  sourcemap: false,
  outfile: 'www/app.js',
  define: { __APP_VERSION__: JSON.stringify(version) },
  // jsPDF trae soporte opcional para HTML/SVG que no usamos
  external: ['html2canvas', 'dompurify', 'canvg'],
  logLevel: 'info',
});
console.log('www listo, versión ' + version);
