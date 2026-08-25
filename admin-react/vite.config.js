import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const target = process.env.BUILD_TARGET || 'admin';

const configs = {
  admin: {
    base: '/panel/admin/',
    outDir: '../panel/admin',
    entry: 'admin.html',
    bridge: 'tracking-bridge-admin.js',
  },
  user: {
    base: './',
    outDir: '../panel/user',
    entry: 'index.html',
    bridge: 'tracking-bridge-user.js',
  },
  // Destino real del panel de clientes. Se usa SOLO cuando se decida cambiar
  // /panel/ del bundle antiguo al codigo fuente; ver PANEL-CLIENTE.md.
  'user-prod': {
    base: '/panel/',
    outDir: '../panel',
    entry: 'index.html',
    bridge: 'tracking-bridge-user.js',
    // NUNCA vaciar el directorio: panel/ contiene admin/, user/ y los 22
    // scripts que hoy le dan sus funciones al panel vivo. Un emptyOutDir aca
    // borraria el panel entero de un build.
    emptyOutDir: false,
  },
};

const cfg = configs[target];

/**
 * El puente de tracking parchea window.fetch para corregir la posicion de los
 * barcos, y tiene que cargar ANTES del bundle de React.
 *
 * Antes se agregaba a mano en el HTML ya compilado, con dos consecuencias: el
 * build siguiente borraba la etiqueta junto con el archivo, y en /panel/admin/
 * la etiqueta nunca llego a existir, asi que el puente del admin estuvo ahi
 * sin que nadie lo cargara. Emitirlo desde el build lo deja resuelto en los
 * tres destinos.
 */
function trackingBridge() {
  const origen = new URL('./bridges/' + cfg.bridge, import.meta.url);
  const codigo = readFileSync(origen, 'utf8');
  // El nombre no lleva hash porque el archivo se referencia por ruta fija; la
  // version en la query es la que invalida la cache del navegador.
  const version = createHash('sha256').update(codigo).digest('hex').slice(0, 8);
  const ruta = cfg.base + 'assets/tracking-bridge.js?v=' + version;

  return {
    name: 'imporlan-tracking-bridge',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'assets/tracking-bridge.js', source: codigo });
    },
    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { src: ruta },
        injectTo: 'head-prepend',
      }];
    },
  };
}

/**
 * El panel de administracion se compila desde admin.html, pero se entra por
 * /panel/admin/, asi que el servidor necesita un index.html. Hasta ahora se
 * copiaba a mano y cada build lo borraba, dejando la URL en 404 hasta que
 * alguien se daba cuenta.
 */
function copiarComoIndex() {
  return {
    name: 'imporlan-copiar-index',
    apply: 'build',
    enforce: 'post',
    writeBundle() {
      if (cfg.entry === 'index.html') return;
      const dir = resolve(import.meta.dirname, cfg.outDir);
      writeFileSync(resolve(dir, 'index.html'), readFileSync(resolve(dir, cfg.entry)));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), trackingBridge(), copiarComoIndex()],
  base: cfg.base,
  build: {
    outDir: cfg.outDir,
    emptyOutDir: cfg.emptyOutDir !== false,
    rollupOptions: {
      input: cfg.entry,
    },
  },
  server: {
    port: target === 'admin' ? 5173 : 5174,
    proxy: {
      '/api': {
        target: 'https://www.imporlan.cl',
        changeOrigin: true,
      }
    }
  }
})
