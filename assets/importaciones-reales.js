/* Home gallery. Only photographs from Imporlan's own import archive. */
(function () {
  'use strict';
  if (!/^\/(?:test\/)?(?:index\.html)?$/.test(location.pathname)) return;
  var base = new URL('../images/importaciones-reales/', document.currentScript.src).href;
  var boats = [
    { name: 'Yamaha 242 Limited', file: 'yamaha-242-limited.jpg', width: 1193, height: 895, position: '50% 54%', alt: 'Yamaha 242 Limited azul y blanca sobre su carro, en bodega' },
    { name: 'Monterey 180 FS', file: 'monterey-180-fs.jpg', width: 1552, height: 873, position: '50% 50%', alt: 'Monterey azul y blanca amarrada junto a un muelle' },
    { name: 'Crownline', file: 'crownline.jpg', width: 1193, height: 895, position: '50% 57%', alt: 'Crownline cabinada blanca y verde sobre su carro en el puerto' },
    { name: 'Donzi', file: 'donzi.jpg', width: 1600, height: 1200, position: '50% 72%', alt: 'Donzi roja y blanca sobre su carro de transporte' }
  ];

  function mount() {
    if (document.getElementById('algunas-lanchas-importadas')) return true;
    var anchor = document.getElementById('proceso-compra-enhanced');
    if (!anchor) return false;
    var section = document.createElement('section');
    section.id = 'algunas-lanchas-importadas';
    section.setAttribute('aria-labelledby', 'importaciones-reales-title');
    section.innerHTML = '<div class="ir-container"><div class="ir-heading"><span class="ir-eyebrow">Nuestra trayectoria, en imágenes</span><h2 id="importaciones-reales-title">Algunas lanchas <span>importadas</span></h2><p>Embarcaciones que han pasado por Imporlan. Fotografías reales de nuestro archivo de importaciones.</p></div><div class="ir-grid">' + boats.map(function (boat, index) {
      return '<article class="ir-card"><button class="ir-photo" type="button" data-ir-photo="' + index + '" aria-label="Ampliar fotografía de ' + boat.name + '"><img src="' + base + boat.file + '" alt="' + boat.alt + '" width="' + boat.width + '" height="' + boat.height + '" loading="lazy" decoding="async" style="object-position:' + boat.position + '"><span class="ir-enlarge" aria-hidden="true">Ver foto ↗</span></button><div class="ir-caption"><h3>' + boat.name + '</h3><span>Archivo Imporlan</span></div></article>';
    }).join('') + '</div><div class="ir-bottom"><p>Tu próxima embarcación también puede comenzar aquí.</p><a href="/cotizador-importacion/">Cotizar mi importación <span aria-hidden="true">→</span></a></div></div>';
    anchor.insertAdjacentElement('afterend', section);

    var dialog = document.createElement('dialog');
    dialog.className = 'ir-dialog';
    dialog.setAttribute('aria-labelledby', 'ir-dialog-title');
    dialog.innerHTML = '<button type="button" class="ir-close" aria-label="Cerrar fotografía">×</button><img alt=""><p id="ir-dialog-title"></p>';
    document.body.appendChild(dialog);
    section.addEventListener('click', function (event) {
      var button = event.target.closest('[data-ir-photo]');
      if (!button) return;
      var boat = boats[Number(button.dataset.irPhoto)];
      if (typeof dialog.showModal !== 'function') { window.open(base + boat.file, '_blank', 'noopener'); return; }
      dialog.querySelector('img').src = base + boat.file;
      dialog.querySelector('img').alt = boat.alt;
      dialog.querySelector('p').textContent = boat.name + ' · Fotografía real del archivo Imporlan';
      dialog.showModal();
    });
    dialog.querySelector('button').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
    return true;
  }

  function init() {
    if (mount()) return;
    var observer = new MutationObserver(function () { if (mount()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { observer.disconnect(); }, 20000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
