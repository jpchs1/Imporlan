(function() {
  'use strict';

  var USD_TO_CLP = 950;
  var PER_PAGE = 20;
  var allListings = [];
  var filteredListings = [];
  var currentPage = 1;
  var boatTraderBoats = [];

  function convertPrice(usd) {
    return Math.round(usd * USD_TO_CLP);
  }

  function formatUSD(val) {
    if (!val || val <= 0) return '';
    return 'USD $' + Number(val).toLocaleString('en-US');
  }

  function formatCLP(val) {
    if (!val || val <= 0) return '';
    return '$' + Number(val).toLocaleString('es-CL') + ' CLP';
  }

  function formatPriceDisplay(precio, moneda) {
    if (!precio || precio <= 0) return 'Consultar';
    if (moneda === 'CLP') {
      var clp = Number(precio);
      var usd = Math.round(clp / USD_TO_CLP);
      return {
        main: '$' + clp.toLocaleString('es-CL') + ' CLP',
        secondary: '~' + formatUSD(usd)
      };
    }
    var usdVal = Number(precio);
    return {
      main: formatUSD(usdVal),
      secondary: '~' + formatCLP(convertPrice(usdVal))
    };
  }

  function timeAgo(dateStr) {
    if (!dateStr) return '';
    var date = new Date(dateStr);
    var now = new Date();
    var diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Hace un momento';
    if (diff < 3600) return 'Hace ' + Math.floor(diff / 60) + ' min';
    if (diff < 86400) return 'Hace ' + Math.floor(diff / 3600) + ' horas';
    var days = Math.floor(diff / 86400);
    if (days === 1) return 'Hace 1 dia';
    if (days < 30) return 'Hace ' + days + ' dias';
    return 'Hace ' + Math.floor(days / 30) + ' meses';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  async function fetchWithRetry(url, retries) {
    if (retries === undefined) retries = 3;
    for (var i = 0; i < retries; i++) {
      try {
        var response = await fetch(url);
        if (response.ok) return await response.json();
        if (response.status >= 500 && i < retries - 1) {
          await new Promise(function(r) { setTimeout(r, 1000 * (i + 1)); });
          continue;
        }
        return null;
      } catch (e) {
        if (i < retries - 1) {
          await new Promise(function(r) { setTimeout(r, 1000 * (i + 1)); });
        }
      }
    }
    return null;
  }

  function getApiBase() {
    var path = window.location.pathname;
    if (path.indexOf('/test/') !== -1) return '/test/api';
    return '/api';
  }

  async function loadListings() {
    var data = await fetchWithRetry(getApiBase() + '/marketplace_api.php?action=list');
    if (data && data.listings) return data.listings;
    return [];
  }

  async function loadBoatTraderCarousel() {
    var data = await fetchWithRetry(getApiBase() + '/boattrader_scraper.php?action=daily_top');
    if (data && data.boats) return data.boats;
    return [];
  }

  var PERIODO_LABELS = {
    'hora': 'Hora',
    'medio_dia': '1/2 Dia',
    'dia': 'Dia',
    'semana': 'Semana',
    'mes': 'Mes'
  };

  function getFiltersFromUI() {
    var filters = {};
    var tipoPub = document.getElementById('filter-tipo-publicacion');
    if (tipoPub && tipoPub.value) filters.tipo_publicacion = tipoPub.value;

    var tipo = document.getElementById('filter-tipo');
    if (tipo && tipo.value) filters.tipo = tipo.value;

    var anoMin = document.getElementById('filter-ano-min');
    if (anoMin && anoMin.value) filters.ano_min = parseInt(anoMin.value);

    var anoMax = document.getElementById('filter-ano-max');
    if (anoMax && anoMax.value) filters.ano_max = parseInt(anoMax.value);

    var precioMin = document.getElementById('filter-precio-min');
    if (precioMin && precioMin.value) filters.precio_min = parseFloat(precioMin.value);

    var precioMax = document.getElementById('filter-precio-max');
    if (precioMax && precioMax.value) filters.precio_max = parseFloat(precioMax.value);

    var eslora = document.getElementById('filter-eslora');
    if (eslora && eslora.value) filters.eslora = eslora.value;

    var ubicacion = document.getElementById('filter-ubicacion');
    if (ubicacion && ubicacion.value) filters.ubicacion = ubicacion.value;

    var estado = document.getElementById('filter-estado');
    if (estado && estado.value) filters.estado = estado.value;

    var condicion = document.getElementById('filter-condicion');
    if (condicion && condicion.value) filters.condicion = condicion.value;

    var horasMin = document.getElementById('filter-horas-min');
    if (horasMin && horasMin.value) filters.horas_min = parseInt(horasMin.value);

    var horasMax = document.getElementById('filter-horas-max');
    if (horasMax && horasMax.value) filters.horas_max = parseInt(horasMax.value);

    var search = document.getElementById('mp-search-input');
    if (search && search.value.trim()) filters.keyword = search.value.trim().toLowerCase();

    return filters;
  }

  function applyFilters(listings, filters) {
    return listings.filter(function(l) {
      if (filters.tipo && l.tipo !== filters.tipo) return false;

      if (filters.ano_min && (!l.ano || l.ano < filters.ano_min)) return false;
      if (filters.ano_max && (!l.ano || l.ano > filters.ano_max)) return false;

      var precio = parseFloat(l.precio) || 0;
      if (l.moneda === 'CLP') precio = precio / USD_TO_CLP;
      if (filters.precio_min && precio < filters.precio_min) return false;
      if (filters.precio_max && precio > filters.precio_max) return false;

      if (filters.eslora && l.eslora) {
        var search = filters.eslora.toLowerCase();
        if (l.eslora.toLowerCase().indexOf(search) === -1) return false;
      } else if (filters.eslora && !l.eslora) {
        return false;
      }

      if (filters.ubicacion && l.ubicacion) {
        if (l.ubicacion.indexOf(filters.ubicacion) === -1) return false;
      } else if (filters.ubicacion && !l.ubicacion) {
        return false;
      }

      if (filters.estado && l.estado !== filters.estado) return false;
      if (filters.condicion && l.condicion !== filters.condicion) return false;

      var horas = parseInt(l.horas) || 0;
      if (filters.horas_min && horas < filters.horas_min) return false;
      if (filters.horas_max && horas > filters.horas_max) return false;

      if (filters.tipo_publicacion) {
        var tipoPub = l.tipo_publicacion || 'venta';
        if (tipoPub !== filters.tipo_publicacion) return false;
      }

      if (filters.keyword) {
        var searchText = [l.nombre, l.tipo, l.ubicacion, l.descripcion, l.estado, l.condicion]
          .filter(Boolean).join(' ').toLowerCase();
        if (searchText.indexOf(filters.keyword) === -1) return false;
      }

      return true;
    });
  }

  function applySorting(listings) {
    var sortSelect = document.getElementById('mp-sort');
    var sortValue = sortSelect ? sortSelect.value : 'recientes';

    var sorted = listings.slice();
    switch (sortValue) {
      case 'precio_asc':
        sorted.sort(function(a, b) {
          var pa = a.moneda === 'CLP' ? (parseFloat(a.precio) / USD_TO_CLP) : parseFloat(a.precio);
          var pb = b.moneda === 'CLP' ? (parseFloat(b.precio) / USD_TO_CLP) : parseFloat(b.precio);
          return (pa || 0) - (pb || 0);
        });
        break;
      case 'precio_desc':
        sorted.sort(function(a, b) {
          var pa = a.moneda === 'CLP' ? (parseFloat(a.precio) / USD_TO_CLP) : parseFloat(a.precio);
          var pb = b.moneda === 'CLP' ? (parseFloat(b.precio) / USD_TO_CLP) : parseFloat(b.precio);
          return (pb || 0) - (pa || 0);
        });
        break;
      case 'ano_desc':
        sorted.sort(function(a, b) { return (b.ano || 0) - (a.ano || 0); });
        break;
      case 'ano_asc':
        sorted.sort(function(a, b) { return (a.ano || 0) - (b.ano || 0); });
        break;
      default:
        sorted.sort(function(a, b) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }
    return sorted;
  }

  function paginate(items, page, perPage) {
    if (!perPage) perPage = PER_PAGE;
    var start = (page - 1) * perPage;
    return {
      items: items.slice(start, start + perPage),
      totalPages: Math.ceil(items.length / perPage),
      total: items.length,
      page: page
    };
  }

  function updateUrlParams(filters) {
    var params = new URLSearchParams();
    Object.keys(filters).forEach(function(key) {
      if (filters[key] !== undefined && filters[key] !== '' && filters[key] !== null) {
        params.set(key, filters[key]);
      }
    });
    if (currentPage > 1) params.set('page', currentPage);
    var qs = params.toString();
    var newUrl = window.location.pathname + (qs ? '?' + qs : '');
    window.history.replaceState(null, '', newUrl);
  }

  function restoreFiltersFromUrl() {
    var params = new URLSearchParams(window.location.search);
    var fields = {
      'tipo': 'filter-tipo',
      'ano_min': 'filter-ano-min',
      'ano_max': 'filter-ano-max',
      'precio_min': 'filter-precio-min',
      'precio_max': 'filter-precio-max',
      'eslora': 'filter-eslora',
      'ubicacion': 'filter-ubicacion',
      'estado': 'filter-estado',
      'condicion': 'filter-condicion',
      'horas_min': 'filter-horas-min',
      'horas_max': 'filter-horas-max',
      'keyword': 'mp-search-input'
    };
    params.forEach(function(value, key) {
      if (fields[key]) {
        var el = document.getElementById(fields[key]);
        if (el) el.value = value;
      }
      if (key === 'page') currentPage = parseInt(value) || 1;
    });
  }

  function saveFiltersToStorage(filters) {
    try {
      localStorage.setItem('mp_filters', JSON.stringify(filters));
    } catch (e) { /* ignore */ }
  }

  function restoreFiltersFromStorage() {
    try {
      var saved = localStorage.getItem('mp_filters');
      if (!saved) return;
      var filters = JSON.parse(saved);
      var fields = {
        'tipo': 'filter-tipo',
        'ano_min': 'filter-ano-min',
        'ano_max': 'filter-ano-max',
        'precio_min': 'filter-precio-min',
        'precio_max': 'filter-precio-max',
        'eslora': 'filter-eslora',
        'ubicacion': 'filter-ubicacion',
        'estado': 'filter-estado',
        'condicion': 'filter-condicion',
        'horas_min': 'filter-horas-min',
        'horas_max': 'filter-horas-max',
        'keyword': 'mp-search-input'
      };
      Object.keys(filters).forEach(function(key) {
        if (fields[key] && filters[key]) {
          var el = document.getElementById(fields[key]);
          if (el) el.value = filters[key];
        }
      });
    } catch (e) { /* ignore */ }
  }

  var svgCalendar = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  var svgClock = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  var svgPin = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var svgRuler = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20"/><path d="M6 8v8"/><path d="M10 10v4"/><path d="M14 10v4"/><path d="M18 8v8"/></svg>';
  var svgBoat = '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M12 2v4"/></svg>';

  function formatArriendoPeriodos(periodos) {
    if (!periodos || typeof periodos !== 'object') return '';
    var items = [];
    Object.keys(periodos).forEach(function(key) {
      if (periodos[key] && parseFloat(periodos[key]) > 0) {
        var label = PERIODO_LABELS[key] || key;
        items.push('<span class="mp-arriendo-periodo-item">$' + Number(periodos[key]).toLocaleString('es-CL') + ' CLP/' + label.toLowerCase() + '</span>');
      }
    });
    return items.length > 0 ? '<div class="mp-arriendo-periodos">' + items.join('') + '</div>' : '';
  }

  function renderCard(listing) {
    var fotos = listing.fotos || [];
    var mainPhoto = fotos.length > 0 ? fotos[0] : '';
    var isArriendo = listing.tipo_publicacion === 'arriendo';
    var priceInfo = formatPriceDisplay(listing.precio, listing.moneda);
    var priceMain = typeof priceInfo === 'string' ? priceInfo : priceInfo.main;
    var priceSec = typeof priceInfo === 'string' ? '' : priceInfo.secondary;

    var imgHtml = mainPhoto
      ? '<img class="mp-card-img" data-src="' + escapeHtml(mainPhoto) + '" alt="' + escapeHtml(listing.nombre) + '" loading="lazy">'
      : '<div class="mp-card-img-placeholder">' + svgBoat + '</div>';

    var badgeTipoPub = isArriendo
      ? '<span class="mp-badge mp-badge-arriendo">EN ARRIENDO</span>'
      : '<span class="mp-badge mp-badge-venta">EN VENTA</span>';
    var badgeEstado = listing.estado === 'Nueva'
      ? '<span class="mp-badge mp-badge-new">Nueva</span>'
      : '<span class="mp-badge mp-badge-used">Usada</span>';
    var badgeCondicion = listing.condicion
      ? '<span class="mp-badge mp-badge-condition">' + escapeHtml(listing.condicion) + '</span>'
      : '';

    var arriendoHtml = '';
    if (isArriendo && listing.arriendo_periodos) {
      arriendoHtml = formatArriendoPeriodos(listing.arriendo_periodos);
    }

    return '<div class="mp-card' + (isArriendo ? ' mp-card-arriendo' : '') + '" data-id="' + listing.id + '">' +
      '<div class="mp-card-img-wrap">' + imgHtml +
        '<div class="mp-card-badges">' + badgeTipoPub + badgeEstado + badgeCondicion + '</div>' +
      '</div>' +
      '<div class="mp-card-body">' +
        (listing.tipo ? '<div class="mp-card-type">' + escapeHtml(listing.tipo) + '</div>' : '') +
        '<div class="mp-card-title" title="' + escapeHtml(listing.nombre) + '">' + escapeHtml(listing.nombre) + '</div>' +
        '<div class="mp-card-meta">' +
          (listing.ano ? '<span class="mp-card-meta-item">' + svgCalendar + ' ' + listing.ano + '</span>' : '') +
          (listing.horas ? '<span class="mp-card-meta-item">' + svgClock + ' ' + listing.horas + ' hrs</span>' : '') +
          (listing.eslora ? '<span class="mp-card-meta-item">' + svgRuler + ' ' + escapeHtml(listing.eslora) + '</span>' : '') +
          (listing.ubicacion ? '<span class="mp-card-meta-item">' + svgPin + ' ' + escapeHtml(listing.ubicacion) + '</span>' : '') +
        '</div>' +
        '<div class="mp-card-price">' + priceMain + '</div>' +
        (priceSec ? '<div class="mp-card-price-clp">' + priceSec + '</div>' : '') +
        arriendoHtml +
        '<div class="mp-card-actions">' +
          '<button class="mp-card-btn mp-card-btn-primary" data-action="details" data-id="' + listing.id + '">Ver Detalles</button>' +
          '<button class="mp-card-btn mp-card-btn-outline" data-action="contact" data-id="' + listing.id + '">' + (isArriendo ? 'Consultar Arriendo' : 'Contactar') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function renderGrid() {
    var container = document.getElementById('mp-grid');
    if (!container) return;

    var filters = getFiltersFromUI();
    filteredListings = applyFilters(allListings, filters);
    filteredListings = applySorting(filteredListings);

    saveFiltersToStorage(filters);
    updateUrlParams(filters);

    var countEl = document.getElementById('mp-count');
    if (countEl) {
      countEl.innerHTML = 'Mostrando <strong>' + filteredListings.length + '</strong> de <strong>' + allListings.length + '</strong> embarcaciones';
    }

    var paged = paginate(filteredListings, currentPage);

    if (paged.items.length === 0) {
      container.innerHTML = '<div class="mp-empty-state" style="grid-column: 1 / -1;">' +
        '<div class="mp-empty-state-icon">' + svgBoat + '</div>' +
        '<h3>No encontramos embarcaciones con esos filtros</h3>' +
        '<p>Intenta ajustar los filtros o limpiar la busqueda para ver todas las publicaciones.</p>' +
      '</div>';
      renderPagination(0);
      return;
    }

    container.innerHTML = paged.items.map(renderCard).join('');
    renderPagination(paged.totalPages);
    observeImages();
    addSchemaMarkup(paged.items);
  }

  function renderPagination(totalPages) {
    var container = document.getElementById('mp-pagination');
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<button class="mp-page-btn" data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '>&laquo;</button>';

    for (var i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
        html += '<button class="mp-page-btn' + (i === currentPage ? ' active' : '') + '" data-page="' + i + '">' + i + '</button>';
      } else if (i === currentPage - 3 || i === currentPage + 3) {
        html += '<span style="color:#94a3b8;padding:0 4px;">...</span>';
      }
    }

    html += '<button class="mp-page-btn" data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '>&raquo;</button>';
    container.innerHTML = html;
  }

  function observeImages() {
    var images = document.querySelectorAll('.mp-card-img[data-src]');
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var img = entry.target;
            img.src = img.getAttribute('data-src');
            img.removeAttribute('data-src');
            img.onerror = function() {
              img.parentElement.innerHTML = '<div class="mp-card-img-placeholder">' + svgBoat + '</div>';
            };
            observer.unobserve(img);
          }
        });
      }, { rootMargin: '100px' });
      images.forEach(function(img) { observer.observe(img); });
    } else {
      images.forEach(function(img) {
        img.src = img.getAttribute('data-src');
        img.removeAttribute('data-src');
      });
    }
  }

  function addSchemaMarkup(items) {
    var existing = document.getElementById('mp-schema');
    if (existing) existing.remove();

    var products = items.map(function(l) {
      var precio = parseFloat(l.precio) || 0;
      var currency = l.moneda || 'USD';
      return {
        '@type': 'Product',
        name: l.nombre || '',
        description: (l.descripcion || '').substring(0, 200),
        image: (l.fotos && l.fotos[0]) || '',
        offers: {
          '@type': 'Offer',
          price: precio,
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          itemCondition: l.estado === 'Nueva' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition'
        }
      };
    });

    var schema = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: products.map(function(p, idx) {
        return { '@type': 'ListItem', position: idx + 1, item: p };
      })
    };

    var script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'mp-schema';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  function renderCarousel() {
    var container = document.getElementById('mp-carousel-track');
    var section = document.getElementById('mp-carousel-section');
    if (!container || !section) return;

    if (boatTraderBoats.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    container.innerHTML = boatTraderBoats.map(function(boat) {
      var price = boat.price ? formatUSD(boat.price) : 'Consultar';
      var img = boat.image_url || '';
      var title = boat.make && boat.model ? boat.make + ' ' + boat.model : boat.title;
      if (title && title.length > 40) title = title.substring(0, 37) + '...';

      return '<div class="mp-carousel-card" data-url="' + escapeHtml(boat.url || '') + '">' +
        (img ? '<img class="mp-carousel-card-img" src="' + escapeHtml(img) + '" alt="' + escapeHtml(boat.title) + '" loading="lazy" onerror="this.style.display=\'none\'">' : '<div class="mp-carousel-card-img" style="height:160px;background:#1e293b;display:flex;align-items:center;justify-content:center;color:#475569;">' + svgBoat + '</div>') +
        '<div class="mp-carousel-card-body">' +
          '<span class="mp-carousel-badge">Importar con Imporlan</span>' +
          (boat.make ? '<div class="mp-carousel-card-make">' + escapeHtml(boat.make) + '</div>' : '') +
          '<div class="mp-carousel-card-title">' + escapeHtml(title) + '</div>' +
          '<div class="mp-carousel-card-meta">' +
            (boat.year ? '<span>' + svgCalendar + ' ' + boat.year + '</span>' : '') +
            (boat.hours ? '<span>' + svgClock + ' ' + boat.hours + ' hrs</span>' : '') +
            (boat.location ? '<span>' + svgPin + ' ' + escapeHtml(boat.location) + '</span>' : '') +
          '</div>' +
          '<div class="mp-carousel-card-price">' + price + '</div>' +
          '<a class="mp-carousel-card-cta" href="' + escapeHtml(boat.url || '#') + '" target="_blank" rel="noopener">Ver en BoatTrader &rarr;</a>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openDetailModal(listingId) {
    var listing = allListings.find(function(l) { return String(l.id) === String(listingId); });
    if (!listing) return;

    var overlay = document.getElementById('mp-modal-overlay');
    if (!overlay) return;

    var fotos = listing.fotos || [];
    var currentPhoto = 0;
    var priceInfo = formatPriceDisplay(listing.precio, listing.moneda);
    var priceMain = typeof priceInfo === 'string' ? priceInfo : priceInfo.main;
    var priceSec = typeof priceInfo === 'string' ? '' : priceInfo.secondary;

    var galleryHtml = '';
    if (fotos.length > 0) {
      galleryHtml = '<div class="mp-modal-gallery">' +
        '<img id="mp-modal-img" src="' + escapeHtml(fotos[0]) + '" alt="' + escapeHtml(listing.nombre) + '">' +
        (fotos.length > 1 ? '<button class="mp-gallery-nav prev" id="mp-gallery-prev">&lsaquo;</button>' +
          '<button class="mp-gallery-nav next" id="mp-gallery-next">&rsaquo;</button>' : '') +
        '<span class="mp-gallery-counter" id="mp-gallery-counter">1 / ' + fotos.length + '</span>' +
        '<button class="mp-modal-close" id="mp-modal-close-gallery">&times;</button>' +
      '</div>';
    } else {
      galleryHtml = '<div class="mp-modal-gallery" style="display:flex;align-items:center;justify-content:center;color:#64748b;">' +
        svgBoat + '<button class="mp-modal-close" id="mp-modal-close-gallery">&times;</button></div>';
    }

    var isArriendo = listing.tipo_publicacion === 'arriendo';
    var specs = [];
    specs.push({ label: 'Modalidad', value: isArriendo ? 'Arriendo' : 'Venta' });
    if (listing.tipo) specs.push({ label: 'Tipo', value: listing.tipo });
    if (listing.ano) specs.push({ label: 'Ano', value: listing.ano });
    if (listing.eslora) specs.push({ label: 'Eslora', value: listing.eslora });
    if (listing.horas) specs.push({ label: 'Horas de Motor', value: listing.horas + ' hrs' });
    if (listing.estado) specs.push({ label: 'Estado', value: listing.estado });
    if (listing.condicion) specs.push({ label: 'Condicion', value: listing.condicion });
    if (listing.ubicacion) specs.push({ label: 'Ubicacion', value: listing.ubicacion });
    if (listing.moneda) specs.push({ label: 'Moneda', value: listing.moneda });

    var specsHtml = specs.length > 0
      ? '<div class="mp-modal-specs">' + specs.map(function(s) {
          return '<div class="mp-spec-item"><span class="mp-spec-label">' + escapeHtml(s.label) + '</span><span class="mp-spec-value">' + escapeHtml(String(s.value)) + '</span></div>';
        }).join('') + '</div>'
      : '';

    var modalHtml = galleryHtml +
      '<div class="mp-modal-body">' +
        '<h2 class="mp-modal-title">' + escapeHtml(listing.nombre) + '</h2>' +
        '<p class="mp-modal-subtitle">' + [listing.tipo, listing.ano, listing.ubicacion].filter(Boolean).join(' &middot; ') + ' &middot; ' + timeAgo(listing.created_at) + '</p>' +
        '<div class="mp-modal-price">' + priceMain + '</div>' +
        (priceSec ? '<div class="mp-modal-price-clp">' + priceSec + '</div>' : '') +
        specsHtml +
        (isArriendo && listing.arriendo_periodos ? '<div class="mp-modal-arriendo-section"><h4>Tarifas de Arriendo</h4>' + formatArriendoPeriodos(listing.arriendo_periodos) + '</div>' : '') +
        (listing.descripcion ? '<div class="mp-modal-description"><h4>Descripcion</h4><p>' + escapeHtml(listing.descripcion) + '</p></div>' : '') +
        '<div class="mp-modal-seller">' +
          '<div class="mp-modal-seller-name">Publicado por: ' + escapeHtml(listing.user_name || 'Usuario') + '</div>' +
          '<div class="mp-modal-seller-date">Publicado ' + timeAgo(listing.created_at) + '</div>' +
        '</div>' +
        '<div class="mp-modal-actions">' +
          '<button class="mp-modal-btn mp-modal-btn-primary" data-action="contact-modal" data-id="' + listing.id + '">' + (isArriendo ? 'Consultar Arriendo' : 'Contactar Vendedor') + '</button>' +
          '<a class="mp-modal-btn mp-modal-btn-secondary" href="https://wa.me/56920382479?text=' + encodeURIComponent('Hola, me interesa la embarcacion ' + listing.nombre + ' publicada en Imporlan Marketplace.') + '" target="_blank">Cotizar Importacion</a>' +
          '<button class="mp-modal-btn mp-modal-btn-outline" data-action="share" data-id="' + listing.id + '">Compartir</button>' +
        '</div>' +
      '</div>';

    var modal = overlay.querySelector('.mp-modal');
    modal.innerHTML = modalHtml;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (fotos.length > 1) {
      var prevBtn = document.getElementById('mp-gallery-prev');
      var nextBtn = document.getElementById('mp-gallery-next');
      var imgEl = document.getElementById('mp-modal-img');
      var counterEl = document.getElementById('mp-gallery-counter');

      function updateGallery() {
        imgEl.src = fotos[currentPhoto];
        counterEl.textContent = (currentPhoto + 1) + ' / ' + fotos.length;
      }

      if (prevBtn) prevBtn.onclick = function(e) {
        e.stopPropagation();
        currentPhoto = (currentPhoto - 1 + fotos.length) % fotos.length;
        updateGallery();
      };
      if (nextBtn) nextBtn.onclick = function(e) {
        e.stopPropagation();
        currentPhoto = (currentPhoto + 1) % fotos.length;
        updateGallery();
      };
    }

    var closeGallery = document.getElementById('mp-modal-close-gallery');
    if (closeGallery) closeGallery.onclick = closeModal;
  }

  function closeModal() {
    var overlay = document.getElementById('mp-modal-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  function handleCardAction(action, id) {
    if (action === 'details') {
      openDetailModal(id);
    } else if (action === 'contact' || action === 'contact-modal') {
      var listing = allListings.find(function(l) { return String(l.id) === String(id); });
      if (listing) {
        var isArr = listing.tipo_publicacion === 'arriendo';
        var msg = isArr
          ? 'Hola, me interesa arrendar la embarcacion ' + (listing.nombre || '') + ' publicada en Imporlan Marketplace.'
          : 'Hola, me interesa la embarcacion ' + (listing.nombre || '') + ' publicada en Imporlan Marketplace.';
        window.open('https://wa.me/56920382479?text=' + encodeURIComponent(msg), '_blank');
      }
    } else if (action === 'share') {
      var url = window.location.origin + '/marketplace/?listing=' + id;
      if (navigator.share) {
        navigator.share({ title: 'Embarcacion en Imporlan', url: url });
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
        alert('Enlace copiado al portapapeles');
      }
    }
  }

  async function handleLeadSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var email = form.querySelector('[name="email"]');
    var nombre = form.querySelector('[name="nombre"]');
    if (!email || !email.value) return;

    var checks = form.querySelectorAll('[name="interes"]:checked');
    var intereses = [];
    checks.forEach(function(c) { intereses.push(c.value); });

    var submitBtn = form.querySelector('.mp-leads-submit');
    if (submitBtn) submitBtn.textContent = 'Enviando...';

    try {
      var response = await fetch(getApiBase() + '/marketplace_api.php?action=lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.value,
          nombre: nombre ? nombre.value : '',
          intereses: intereses.join(', ')
        })
      });
      var result = document.getElementById('mp-leads-result');
      if (result) {
        result.innerHTML = '<div class="mp-leads-success">Registrado exitosamente. Te enviaremos oportunidades semanales.</div>';
      }
      form.style.display = 'none';
    } catch (err) {
      if (submitBtn) submitBtn.textContent = 'Suscribirme';
      alert('Error al registrar. Intenta nuevamente.');
    }
  }

  function bindEvents() {
    document.addEventListener('click', function(e) {
      var target = e.target;

      if (target.closest('.mp-card') && !target.closest('.mp-card-btn')) {
        var card = target.closest('.mp-card');
        openDetailModal(card.getAttribute('data-id'));
        return;
      }

      if (target.closest('[data-action]')) {
        var btn = target.closest('[data-action]');
        handleCardAction(btn.getAttribute('data-action'), btn.getAttribute('data-id'));
        return;
      }

      if (target.closest('[data-page]')) {
        var pageBtn = target.closest('[data-page]');
        var page = parseInt(pageBtn.getAttribute('data-page'));
        if (page >= 1) {
          currentPage = page;
          renderGrid();
          var main = document.querySelector('.mp-main');
          if (main) main.scrollIntoView({ behavior: 'smooth' });
        }
        return;
      }

      if (target.closest('.mp-carousel-card')) {
        var card = target.closest('.mp-carousel-card');
        var url = card.getAttribute('data-url');
        if (url && !target.closest('.mp-carousel-card-cta')) {
          window.open(url, '_blank');
        }
        return;
      }

      if (target.classList.contains('mp-modal-overlay') || target.id === 'mp-modal-overlay') {
        closeModal();
        return;
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeModal();
    });

    var filterInputs = document.querySelectorAll('.mp-filter-select, .mp-filter-input');
    filterInputs.forEach(function(el) {
      el.addEventListener('change', function() {
        currentPage = 1;
        renderGrid();
      });
    });

    var searchInput = document.getElementById('mp-search-input');
    var searchTimer;
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function() {
          currentPage = 1;
          renderGrid();
        }, 300);
      });
    }

    var searchBtn = document.getElementById('mp-search-btn');
    if (searchBtn) {
      searchBtn.addEventListener('click', function() {
        currentPage = 1;
        renderGrid();
      });
    }

    var sortSelect = document.getElementById('mp-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', function() {
        currentPage = 1;
        renderGrid();
      });
    }

    var clearBtn = document.getElementById('mp-filters-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function() {
        var filterInputs = document.querySelectorAll('.mp-filter-select, .mp-filter-input');
        filterInputs.forEach(function(el) { el.value = ''; });
        var searchInput = document.getElementById('mp-search-input');
        if (searchInput) searchInput.value = '';
        currentPage = 1;
        try { localStorage.removeItem('mp_filters'); } catch (e) {}
        renderGrid();
      });
    }

    var mobileToggle = document.getElementById('mp-mobile-filter-toggle');
    var filtersPanel = document.getElementById('mp-filters-panel');
    if (mobileToggle && filtersPanel) {
      mobileToggle.addEventListener('click', function() {
        filtersPanel.classList.toggle('active');
        mobileToggle.textContent = filtersPanel.classList.contains('active') ? 'Ocultar Filtros' : 'Mostrar Filtros';
      });
    }

    var leadsForm = document.getElementById('mp-leads-form');
    if (leadsForm) {
      leadsForm.addEventListener('submit', handleLeadSubmit);
    }

    var carouselContainer = document.getElementById('mp-carousel-container');
    if (carouselContainer) {
      var leftArrow = carouselContainer.querySelector('.mp-carousel-arrow.left');
      var rightArrow = carouselContainer.querySelector('.mp-carousel-arrow.right');
      var track = document.getElementById('mp-carousel-track');
      if (leftArrow && track) {
        leftArrow.addEventListener('click', function() {
          track.scrollBy({ left: -300, behavior: 'smooth' });
        });
      }
      if (rightArrow && track) {
        rightArrow.addEventListener('click', function() {
          track.scrollBy({ left: 300, behavior: 'smooth' });
        });
      }
    }

    var publishBtn = document.getElementById('mp-publish-sticky');
    if (publishBtn) {
      publishBtn.addEventListener('click', function() {
        var token = localStorage.getItem('imporlan_token');
        var path = window.location.pathname;
        var panelUrl = path.indexOf('/test/') !== -1 ? '/panel-test/' : '/panel/';
        if (token) {
          window.location.href = panelUrl + '#/marketplace/publicar';
        } else {
          sessionStorage.setItem('imporlan_redirect_after_login', panelUrl + '#/marketplace/publicar');
          window.location.href = panelUrl + '#/register';
        }
      });
    }

    var publishArriendoBtn = document.getElementById('mp-publish-sticky-arriendo');
    if (publishArriendoBtn) {
      publishArriendoBtn.addEventListener('click', function() {
        var token = localStorage.getItem('imporlan_token');
        var path = window.location.pathname;
        var panelUrl = path.indexOf('/test/') !== -1 ? '/panel-test/' : '/panel/';
        if (token) {
          window.location.href = panelUrl + '#/marketplace/publicar?modo=arriendo';
        } else {
          sessionStorage.setItem('imporlan_redirect_after_login', panelUrl + '#/marketplace/publicar?modo=arriendo');
          window.location.href = panelUrl + '#/register';
        }
      });
    }
  }

  function updateSocialProof() {
    var countEl = document.getElementById('mp-social-count');
    if (countEl && allListings.length > 0) {
      countEl.textContent = allListings.length + ' embarcaciones activas';
    }
  }

  async function init() {
    var gridEl = document.getElementById('mp-grid');
    if (!gridEl) return;

    gridEl.innerHTML = '<div class="mp-loading" style="grid-column:1/-1;"><div class="mp-spinner"></div></div>';

    var urlParams = new URLSearchParams(window.location.search);
    if (urlParams.toString()) {
      restoreFiltersFromUrl();
    } else {
      restoreFiltersFromStorage();
    }

    bindEvents();

    try {
      var results = await Promise.allSettled([
        loadListings(),
        loadBoatTraderCarousel()
      ]);

      allListings = results[0].status === 'fulfilled' ? results[0].value : [];
      boatTraderBoats = results[1].status === 'fulfilled' ? results[1].value : [];
    } catch (e) {
      allListings = [];
      boatTraderBoats = [];
    }

    if (allListings.length === 0) {
      gridEl.innerHTML = '<div class="mp-error" style="grid-column:1/-1;">' +
        '<div class="mp-empty-state-icon">' + svgBoat + '</div>' +
        '<h3>Error al cargar embarcaciones</h3>' +
        '<p>No pudimos conectar con el servidor. Intenta nuevamente.</p>' +
        '<button class="mp-error-btn" onclick="location.reload()">Reintentar</button>' +
      '</div>';
    } else {
      renderGrid();
    }

    renderCarousel();
    updateSocialProof();

    var listingParam = urlParams.get('listing');
    if (listingParam) {
      setTimeout(function() { openDetailModal(listingParam); }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
