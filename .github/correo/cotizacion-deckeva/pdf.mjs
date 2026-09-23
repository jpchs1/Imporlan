// HTML de render.php → PDF A4 con el Chromium de la sesión.
// Uso: NODE_PATH=$(npm root -g) node pdf.mjs entrada.html salida.pdf
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const [, , entrada, salida] = process.argv;
if (!entrada || !salida) { console.error('uso: node pdf.mjs entrada.html salida.pdf'); process.exit(1); }
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('file://' + resolve(entrada));
await p.waitForLoadState('networkidle');
// La plantilla deja 38pt de margen inferior para DOMPDF (el pie es fixed). En
// Chromium el pie fixed va al borde de la hoja: sin margen, y el cuerpo deja
// ese espacio con padding para que el pie no lo tape.
await p.addStyleTag({ content: '@page { margin: 0 } body { padding-bottom: 46pt }' });
await p.pdf({ path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true });
await b.close();
console.log('PDF:', salida);
