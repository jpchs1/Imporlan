// HTML de render.php → PDF A4 con el Chromium de la sesión.
// Uso: NODE_PATH=$(npm root -g) node pdf.mjs entrada.html salida.pdf
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
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
// Una sola hoja, como la de la web. Con forma de pago y la sección de
// opcionales (toma de medidas e instalación, JP 29-sep-2026) la cotización
// manual pasaba a una segunda hoja con sólo el «¿Listo para avanzar?»: se
// achica un poco hasta que entre, y si ni así, sale en dos y se avisa.
const paginas = (buf) => (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length;
let pdf, escala;
for (escala of [1, 0.96, 0.92, 0.88, 0.84]) {
  pdf = await p.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, scale: escala });
  if (paginas(pdf) <= 1) break;
}
writeFileSync(salida, pdf);
if (paginas(pdf) > 1) console.error('Ojo: la cotización quedó en ' + paginas(pdf) + ' hojas.');
else if (escala < 1) console.log('Escala', escala, 'para que entre en una hoja.');
await b.close();
console.log('PDF:', salida);
