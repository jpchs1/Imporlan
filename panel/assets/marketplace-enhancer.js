/**
 * Marketplace Enhancer for Imporlan Panel
 * Replaces the default Marketplace page with enhanced version:
 * - Currency selector (CLP/USD)
 * - Estado (Nueva/Usada)
 * - Condicion (Excelente -> Para Reparacion)
 * - Horas field
 * - Photo upload (max 8)
 * - User profile image on listings
 * - "Ver Detalles" button with full detail modal
 */
(function () {
  "use strict";

  const API_BASE = window.location.pathname.includes("/panel-test")
    ? "/test/api"
    : window.location.pathname.includes("/test/")
      ? "/test/api"
      : "/api";

  let enhanced = false;
  let enhancing = false;
  let listings = [];
  let filteredListings = [];
  let myListings = [];
  let uploadedPhotos = [];
  let isSubmitting = false;
  let detailModalOpen = false;
  let editPhotos = [];
  let editingId = null;
  var USD_TO_CLP = 950;
  var panelSortValue = 'recientes';

  function getUserData() {
    try {
      const raw = localStorage.getItem("imporlan_user");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  function getToken() {
    return localStorage.getItem("imporlan_token") || "";
  }

  function getHeaders() {
    const user = getUserData();
    const h = {
      Authorization: "Bearer " + getToken(),
    };
    if (user) {
      h["X-User-Email"] = user.email || "";
      h["X-User-Name"] = user.name || "";
    }
    return h;
  }

  function isMarketplacePage() {
    var main = document.querySelector("main");
    if (!main) return false;
    var h1 = main.querySelector("h1");
    if (h1 && h1.textContent.trim() === "Marketplace") return true;
    return false;
  }

  function userInitials(name) {
    if (!name) return "?";
    return name
      .split(" ")
      .map(function (w) {
        return w[0];
      })
      .join("")
      .toUpperCase()
      .substring(0, 2);
  }

  function formatPrice(price, currency) {
    var n = Number(price);
    if (isNaN(n)) return price;
    if (currency === "CLP") {
      return "$" + n.toLocaleString("es-CL") + " CLP";
    }
    return "USD $" + n.toLocaleString("en-US");
  }

  function condicionColor(cond) {
    var map = {
      Excelente: "#059669",
      "Muy Buena": "#0d9488",
      Buena: "#2563eb",
      Regular: "#d97706",
      "Para Reparacion": "#dc2626",
    };
    return map[cond] || "#64748b";
  }

  function estadoBadge(estado) {
    if (estado === "Nueva")
      return '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Nueva</span>';
    return '<span style="background:#e0e7ff;color:#3730a3;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Usada</span>';
  }

  async function apiCall(endpoint, options) {
    var opts = options || {};
    opts.headers = Object.assign({}, getHeaders(), opts.headers || {});
    try {
      var resp = await fetch(API_BASE + "/marketplace_api.php" + endpoint, opts);
      return await resp.json();
    } catch (e) {
      console.error("[Marketplace]", e);
      return null;
    }
  }

  async function loadListings() {
    var data = await apiCall("?action=list");
    if (data && data.listings) listings = data.listings;
  }

  async function loadMyListings() {
    var data = await apiCall("?action=my_listings");
    if (data && data.listings) myListings = data.listings;
  }

  async function uploadPhotoFile(file) {
    var formData = new FormData();
    formData.append("photo", file);
    var user = getUserData();
    var headers = {
      Authorization: "Bearer " + getToken(),
    };
    if (user) {
      headers["X-User-Email"] = user.email || "";
      headers["X-User-Name"] = user.name || "";
    }
    try {
      var resp = await fetch(
        API_BASE + "/marketplace_api.php?action=upload_photo",
        {
          method: "POST",
          headers: headers,
          body: formData,
        }
      );
      return await resp.json();
    } catch (e) {
      console.error("[Marketplace] Upload error", e);
      return null;
    }
  }

  function buildListingCard(item) {
    var img =
      item.fotos && item.fotos.length > 0
        ? item.fotos[0]
        : "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400&h=300&fit=crop";
    var initials = userInitials(item.user_name);
    return (
      '<div class="mkt-card" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;transition:all .3s;cursor:default" onmouseover="this.style.boxShadow=\'0 12px 30px rgba(0,0,0,.12)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.boxShadow=\'none\';this.style.transform=\'none\'">' +
      '<div style="position:relative;height:200px;overflow:hidden;background:#f1f5f9">' +
      '<img src="' +
      img +
      '" alt="' +
      (item.nombre || "") +
      '" style="width:100%;height:100%;object-fit:cover;transition:transform .4s" onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'none\'">' +
      (item.tipo_publicacion === 'arriendo'
        ? '<span style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700">EN ARRIENDO</span>'
        : '<span style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700">EN VENTA</span>') +
      (item.estado === "Nueva"
        ? '<span style="position:absolute;top:10px;left:' + (item.tipo_publicacion === 'arriendo' ? '120' : '100') + 'px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700">NUEVA</span>'
        : "") +
      '<span style="position:absolute;top:10px;right:10px;background:rgba(0,0,0,.6);color:#fff;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">' +
      (item.fotos ? item.fotos.length : 0) +
      " fotos</span>" +
      "</div>" +
      '<div style="padding:16px">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">' +
      '<div style="flex:1;min-width:0">' +
      '<h3 style="font-weight:700;color:#1e293b;font-size:16px;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      (item.nombre || "Sin nombre") +
      "</h3>" +
      '<p style="color:#64748b;font-size:13px;margin:0">' +
      (item.tipo || "") +
      (item.ano ? " - " + item.ano : "") +
      "</p>" +
      "</div>" +
      '<div style="text-align:right;flex-shrink:0;margin-left:8px">' +
      '<div style="display:flex;align-items:center;gap:6px;justify-content:flex-end">' +
      '<span style="font-size:20px;line-height:1">' + (item.moneda === 'CLP' ? '\ud83c\udde8\ud83c\uddf1' : '\ud83c\uddfa\ud83c\uddf8') + '</span>' +
      '<p style="font-weight:700;color:#2563eb;font-size:18px;margin:0;white-space:nowrap">' +
      formatPrice(item.precio, item.moneda) +
      "</p></div>" +
      "</div></div>" +
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' +
      estadoBadge(item.estado) +
      '<span style="background:#f0fdf4;color:' +
      condicionColor(item.condicion) +
      ';padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">' +
      (item.condicion || "N/A") +
      "</span>" +
      (item.horas
        ? '<span style="background:#f8fafc;color:#475569;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600;border:1px solid #e2e8f0">' +
          item.horas +
          " hrs</span>"
        : "") +
      "</div>" +
      '<div style="display:flex;gap:12px;color:#64748b;font-size:13px;margin-bottom:12px">' +
      (item.eslora
        ? '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20L7 4l5 16 5-16 5 16"/></svg>' +
          item.eslora +
          "</span>"
        : "") +
      (item.ubicacion
        ? '<span style="display:flex;align-items:center;gap:4px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
          item.ubicacion +
          "</span>"
        : "") +
      "</div>" +
      '<div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid #f1f5f9;padding-top:12px">' +
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700">' +
      initials +
      "</div>" +
      '<span style="font-size:13px;color:#475569;font-weight:500">' +
      (item.user_name || "Usuario") +
      "</span></div>" +
      '<button onclick="window.__mktShowDetail(' +
      item.id +
      ')" style="background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:8px 18px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.opacity=\'0.9\';this.style.transform=\'scale(1.02)\'" onmouseout="this.style.opacity=\'1\';this.style.transform=\'none\'">Ver Detalles</button>' +
      "</div></div></div>"
    );
  }

  function buildDetailModal(item) {
    if (!item) return "";
    var photos = item.fotos || [];
    var photosHtml = "";
    if (photos.length > 0) {
      photosHtml =
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px">';
      photos.forEach(function (url, idx) {
        if (idx === 0) {
          photosHtml +=
            '<img src="' +
            url +
            '" style="grid-column:1/-1;width:100%;height:300px;object-fit:cover;border-radius:12px;cursor:pointer" onclick="window.open(\'' +
            url +
            "','_blank')\">";
        } else {
          photosHtml +=
            '<img src="' +
            url +
            '" style="width:100%;height:150px;object-fit:cover;border-radius:10px;cursor:pointer" onclick="window.open(\'' +
            url +
            "','_blank')\">";
        }
      });
      photosHtml += "</div>";
    } else {
      photosHtml =
        '<div style="height:200px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:20px;color:#94a3b8;font-size:14px">Sin fotos disponibles</div>';
    }

    var initials = userInitials(item.user_name);
    var createdDate = item.created_at
      ? new Date(item.created_at).toLocaleDateString("es-CL", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

    return (
      '<div id="mkt-detail-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:mktFadeIn .2s ease" onclick="if(event.target===this)window.__mktCloseDetail()">' +
      '<div style="background:#fff;border-radius:20px;max-width:750px;width:100%;max-height:90vh;overflow-y:auto;position:relative;animation:mktSlideUp .3s ease">' +
      '<button onclick="window.__mktCloseDetail()" style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,.5);color:#fff;border:none;width:36px;height:36px;border-radius:50%;font-size:18px;cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;transition:background .2s" onmouseover="this.style.background=\'rgba(0,0,0,.7)\'" onmouseout="this.style.background=\'rgba(0,0,0,.5)\'">&times;</button>' +
      '<div style="padding:24px">' +
      photosHtml +
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">' +
      '<div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#06b6d4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:15px;font-weight:700;flex-shrink:0">' +
      initials +
      "</div>" +
      "<div>" +
      '<p style="font-weight:600;color:#1e293b;margin:0;font-size:15px">' +
      (item.user_name || "Usuario") +
      "</p>" +
      '<p style="color:#94a3b8;font-size:12px;margin:2px 0 0">Publicado ' +
      createdDate +
      "</p>" +
      "</div></div>" +
      '<h2 style="font-size:24px;font-weight:700;color:#0f172a;margin:0 0 8px">' +
      (item.nombre || "") +
      "</h2>" +
      '<p style="font-size:28px;font-weight:700;color:#2563eb;margin:0 0 16px">' +
      formatPrice(item.precio, item.moneda) +
      "</p>" +
      '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:20px">' +
      estadoBadge(item.estado) +
      '<span style="background:#f0fdf4;color:' +
      condicionColor(item.condicion) +
      ';padding:3px 14px;border-radius:9999px;font-size:13px;font-weight:600">' +
      (item.condicion || "N/A") +
      "</span></div>" +
      '<div style="background:#f8fafc;border-radius:14px;padding:20px;margin-bottom:20px">' +
      '<h3 style="font-size:15px;font-weight:600;color:#1e293b;margin:0 0 14px">Especificaciones</h3>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
      buildSpecRow("Tipo", item.tipo) +
      buildSpecRow("Ano", item.ano) +
      buildSpecRow("Eslora", item.eslora) +
      buildSpecRow("Horas de Motor", item.horas ? item.horas + " hrs" : null) +
      buildSpecRow("Ubicacion", item.ubicacion) +
      buildSpecRow("Moneda", item.moneda) +
      "</div></div>" +
      (item.descripcion
        ? '<div style="margin-bottom:20px"><h3 style="font-size:15px;font-weight:600;color:#1e293b;margin:0 0 8px">Descripcion</h3><p style="color:#475569;font-size:14px;line-height:1.7;margin:0;white-space:pre-wrap">' +
          item.descripcion +
          "</p></div>"
        : "") +
      '<div style="display:flex;gap:12px">' +
      '<a href="https://wa.me/56940211459?text=' +
      encodeURIComponent(
        "Hola, me interesa la embarcacion: " +
          (item.nombre || "") +
          " publicada en Imporlan Marketplace"
      ) +
      '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;font-size:14px;transition:opacity .2s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 2C6.477 2 2 6.477 2 12c0 1.89.525 3.66 1.438 5.168L2 22l4.832-1.438A9.955 9.955 0 0012 22c5.523 0 10-4.477 10-10S17.523 2 12 2zm0 18a8 8 0 01-4.286-1.238l-.308-.184-2.87.852.852-2.87-.184-.308A8 8 0 1112 20z"/></svg>Contactar por WhatsApp</a>' +
      '<button onclick="window.__mktOpenChatAbout(\'' + (item.nombre || '').replace(/'/g, "\\'") + '\')" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:14px;border-radius:12px;font-weight:600;font-size:14px;cursor:pointer;transition:opacity .2s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Chatear en la Web</button>' +
      "</div>" +
      "</div></div></div>"
    );
  }

  function buildSpecRow(label, value) {
    if (!value && value !== 0) return "";
    return (
      '<div style="display:flex;flex-direction:column;gap:2px">' +
      '<span style="font-size:12px;color:#94a3b8;font-weight:500">' +
      label +
      "</span>" +
      '<span style="font-size:14px;color:#1e293b;font-weight:600">' +
      value +
      "</span></div>"
    );
  }

  var PERIODO_LABELS = { 'hora': 'Hora', 'medio_dia': '1/2 Dia', 'dia': 'Dia', 'semana': 'Semana', 'mes': 'Mes' };

  function buildArriendoPeriodosFields(prefix) {
    var pfx = prefix || '';
    var inputStyle = 'padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s';
    var selectStyle = 'padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s;background:#fff;cursor:pointer;appearance:auto';
    var html = '<div id="' + pfx + 'mkt-arriendo-periodos" style="display:none;margin-top:14px;padding:16px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a">' +
      '<label style="font-size:13px;font-weight:700;color:#92400e;display:block;margin-bottom:12px">Tarifa de Arriendo (CLP)</label>' +
      '<div style="display:flex;gap:10px;align-items:flex-end">' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#92400e">Periodo</label>' +
      '<select id="' + pfx + 'mkt-arriendo-periodo-select" name="arriendo_periodo_tipo" style="' + selectStyle + '" onfocus="this.style.borderColor=\'#f59e0b\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      '<option value="" disabled selected>Seleccionar periodo</option>' +
      '<option value="hora">Por Hora</option>' +
      '<option value="medio_dia">Por 1/2 Dia</option>' +
      '<option value="dia">Por Dia</option>' +
      '<option value="semana">Por Semana</option>' +
      '<option value="mes">Por Mes</option>' +
      '</select></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#92400e">Precio (CLP)</label>' +
      '<input id="' + pfx + 'mkt-arriendo-precio-input" name="arriendo_precio" type="text" placeholder="Ej: 150.000" style="' + inputStyle + '" onfocus="this.style.borderColor=\'#f59e0b\'" onblur="this.style.borderColor=\'#e2e8f0\'" oninput="this.value=this.value.replace(/[^0-9]/g,\'\').replace(/\\B(?=(\\d{3})+(?!\\d))/g,\'.\')">' +
      '</div></div></div>';
    return html;
  }

  function buildTipoPublicacionSelector(prefix) {
    var pfx = prefix || '';
    return '<div style="grid-column:1/-1;margin-bottom:6px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px">Modalidad de Publicacion</label>' +
      '<div style="display:flex;gap:10px">' +
      '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;transition:all .2s;background:#fff" id="' + pfx + 'mkt-label-venta" onclick="window.__mktSelectTipoPub(\'' + pfx + '\',\'venta\')"><input type="radio" name="tipo_publicacion" value="venta" checked style="accent-color:#22c55e"><div><div style="font-weight:700;color:#1e293b;font-size:14px">Venta</div><div style="font-size:12px;color:#64748b">Vender embarcacion</div></div></label>' +
      '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid #e2e8f0;border-radius:12px;cursor:pointer;transition:all .2s;background:#fff" id="' + pfx + 'mkt-label-arriendo" onclick="window.__mktSelectTipoPub(\'' + pfx + '\',\'arriendo\')"><input type="radio" name="tipo_publicacion" value="arriendo" style="accent-color:#f59e0b"><div><div style="font-weight:700;color:#1e293b;font-size:14px">Arriendo <span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;vertical-align:middle;margin-left:4px;letter-spacing:.5px">NEW</span></div><div style="font-size:12px;color:#64748b">Arrendar por periodos</div></div></label>' +
      '</div></div>';
  }

  window.__mktSelectTipoPub = function(prefix, tipo) {
    var arriendoSection = document.getElementById(prefix + 'mkt-arriendo-periodos');
    var labelVenta = document.getElementById(prefix + 'mkt-label-venta');
    var labelArriendo = document.getElementById(prefix + 'mkt-label-arriendo');
    var precioField = document.getElementById(prefix + 'mkt-precio-field');
    if (arriendoSection) arriendoSection.style.display = tipo === 'arriendo' ? 'block' : 'none';
    if (precioField) precioField.style.display = tipo === 'arriendo' ? 'none' : 'flex';
    if (labelVenta) labelVenta.style.borderColor = tipo === 'venta' ? '#22c55e' : '#e2e8f0';
    if (labelArriendo) labelArriendo.style.borderColor = tipo === 'arriendo' ? '#f59e0b' : '#e2e8f0';
  };

  function buildPublishModal() {
    return (
      '<div id="mkt-publish-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:mktFadeIn .2s ease" onclick="if(event.target===this)window.__mktClosePublish()">' +
      '<div style="background:#fff;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;position:relative;animation:mktSlideUp .3s ease">' +
      '<div style="padding:24px 24px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
            '<h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0">Publicar Embarcacion</h2>' +
            '<button onclick="window.__mktClosePublish()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button>' +
            "</div>" +
            '<p style="color:#64748b;font-size:14px;margin:0 0 6px">Completa los datos de tu embarcacion para publicarla en el marketplace</p>' +
            '<p style="color:#f59e0b;font-size:13px;margin:0 0 20px;display:flex;align-items:center;gap:6px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg> Tambien puedes publicar tu embarcacion <strong>para Arriendo</strong> por periodos <span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;letter-spacing:.5px">NEW</span></p>' +
      "</div>" +
      '<form id="mkt-publish-form" style="padding:0 24px 24px" onsubmit="return window.__mktSubmitForm(event)">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
      buildTipoPublicacionSelector('') +
      buildField("nombre", "Nombre / Modelo", "text", "Ej: Sea Ray 250 SLX") +
      buildSelect("tipo", "Tipo", [
        { v: "", l: "Selecciona tipo" },
        { v: "Bowrider", l: "Bowrider" },
        { v: "Pesca", l: "Pesca" },
        { v: "Jet Boat", l: "Jet Boat" },
        { v: "Yate", l: "Yate" },
        { v: "Velero", l: "Velero" },
        { v: "Moto de Agua", l: "Moto de Agua" },
        { v: "Catamaran", l: "Catamaran" },
        { v: "Otro", l: "Otro" },
      ]) +
      buildField("ano", "Ano", "number", "2023") +
      buildField("eslora", "Eslora (pies)", "text", "25 ft") +
      '<div id="mkt-precio-field" style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569">Precio</label>' +
      '<div style="display:flex;gap:8px">' +
      '<input name="precio" type="number" placeholder="50000" style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;transition:border-color .2s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      '<select name="moneda" style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer;min-width:90px">' +
      '<option value="USD">USD</option>' +
      '<option value="CLP">CLP</option>' +
      "</select></div></div>" +
      buildField("ubicacion", "Ubicacion", "text", "Vina del Mar, Chile") +
      buildSelect("estado", "Estado", [
        { v: "Usada", l: "Usada" },
        { v: "Nueva", l: "Nueva" },
      ]) +
      buildSelect("condicion", "Condicion", [
        { v: "Excelente", l: "Excelente" },
        { v: "Muy Buena", l: "Muy Buena" },
        { v: "Buena", l: "Buena" },
        { v: "Regular", l: "Regular" },
        { v: "Para Reparacion", l: "Para Reparacion" },
      ]) +
      buildField("horas", "Horas de Motor", "number", "150") +
      "</div>" +
      buildArriendoPeriodosFields('') +
      '<div style="margin-top:14px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Descripcion</label>' +
      '<textarea name="descripcion" rows="3" placeholder="Describe tu embarcacion..." style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color .2s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></textarea>' +
      "</div>" +
      '<div style="margin-top:14px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Fotos <span style="color:#94a3b8;font-weight:400">(maximo 8)</span></label>' +
      '<div id="mkt-photo-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>' +
      '<div id="mkt-photo-dropzone" style="border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;background:#fafafa" onmouseover="this.style.borderColor=\'#3b82f6\';this.style.background=\'#eff6ff\'" onmouseout="this.style.borderColor=\'#cbd5e1\';this.style.background=\'#fafafa\'" onclick="document.getElementById(\'mkt-photo-input\').click()">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin:0 auto 8px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      '<p style="color:#64748b;font-size:14px;margin:0">Arrastra fotos aqui o haz clic para seleccionar</p>' +
      '<p style="color:#94a3b8;font-size:12px;margin:4px 0 0">JPG, PNG, WebP (max 5MB cada una)</p>' +
      "</div>" +
      '<input type="file" id="mkt-photo-input" accept="image/*" multiple style="display:none">' +
      "</div>" +
      '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px">' +
      '<button type="button" onclick="window.__mktClosePublish()" style="padding:10px 24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:14px;font-weight:500;cursor:pointer;color:#475569;transition:all .2s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'">Cancelar</button>' +
      '<button type="submit" id="mkt-submit-btn" style="padding:10px 28px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">Publicar</button>' +
      "</div></form></div></div>"
    );
  }

  function buildField(name, label, type, placeholder) {
    return (
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569">' +
      label +
      "</label>" +
      '<input name="' +
      name +
      '" type="' +
      type +
      '" placeholder="' +
      placeholder +
      '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;transition:border-color .2s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      "</div>"
    );
  }

  function buildSelect(name, label, options) {
    var opts = options
      .map(function (o) {
        return (
          '<option value="' + o.v + '">' + o.l + "</option>"
        );
      })
      .join("");
    return (
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569">' +
      label +
      "</label>" +
      '<select name="' +
      name +
      '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer;outline:none;transition:border-color .2s" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      opts +
      "</select></div>"
    );
  }

  function buildMyListingCard(item) {
    var img =
      item.fotos && item.fotos.length > 0
        ? item.fotos[0]
        : "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=400&h=300&fit=crop";
    var statusBadge =
      item.status === "sold"
        ? '<span style="background:#fef2f2;color:#b91c1c;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Vendida</span>'
        : '<span style="background:#dcfce7;color:#166534;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Activa</span>';
    var tipoPubBadge = item.tipo_publicacion === 'arriendo'
      ? '<span style="background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Arriendo</span>'
      : '<span style="background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600">Venta</span>';
    return (
      '<div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;display:flex;gap:16px;padding:16px;transition:box-shadow .2s" onmouseover="this.style.boxShadow=\'0 4px 16px rgba(0,0,0,.08)\'" onmouseout="this.style.boxShadow=\'none\'">' +
      '<img src="' +
      img +
      '" style="width:120px;height:90px;object-fit:cover;border-radius:10px;flex-shrink:0">' +
      '<div style="flex:1;min-width:0">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">' +
      '<h3 style="font-weight:600;color:#1e293b;font-size:15px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      (item.nombre || "Sin nombre") +
      "</h3>" +
      statusBadge + ' ' + tipoPubBadge +
      "</div>" +
      '<p style="color:#2563eb;font-weight:700;font-size:16px;margin:4px 0">' +
      formatPrice(item.precio, item.moneda) +
      "</p>" +
      '<p style="color:#94a3b8;font-size:12px;margin:0">' +
      (item.tipo || "") +
      (item.ano ? " - " + item.ano : "") +
      " | " +
      (item.estado || "") +
      " | " +
      (item.condicion || "") +
      "</p>" +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
      '<button onclick="window.__mktOpenEdit(' + item.id + ')" style="display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .2s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Editar</button>' +
      '<button onclick="window.__mktDeleteListing(' + item.id + ',\'' + (item.nombre || '').replace(/'/g, "\\'") + '\')" style="display:flex;align-items:center;gap:4px;background:#fff;color:#dc2626;border:1px solid #fecaca;padding:6px 16px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'#fff\'"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>Eliminar</button>' +
      '</div>' +
      "</div></div>"
    );
  }

  function getPanelFilters() {
    var filters = {};
    var search = document.getElementById('mkt-panel-search');
    if (search && search.value.trim()) filters.keyword = search.value.trim().toLowerCase();
    var tipo = document.getElementById('mkt-panel-tipo');
    if (tipo && tipo.value) filters.tipo = tipo.value;
    var estado = document.getElementById('mkt-panel-estado');
    if (estado && estado.value) filters.estado = estado.value;
    var condicion = document.getElementById('mkt-panel-condicion');
    if (condicion && condicion.value) filters.condicion = condicion.value;
    var precioMin = document.getElementById('mkt-panel-precio-min');
    if (precioMin && precioMin.value) filters.precio_min = parseFloat(precioMin.value);
    var precioMax = document.getElementById('mkt-panel-precio-max');
    if (precioMax && precioMax.value) filters.precio_max = parseFloat(precioMax.value);
    var anoMin = document.getElementById('mkt-panel-ano-min');
    if (anoMin && anoMin.value) filters.ano_min = parseInt(anoMin.value);
    var anoMax = document.getElementById('mkt-panel-ano-max');
    if (anoMax && anoMax.value) filters.ano_max = parseInt(anoMax.value);
    var ubicacion = document.getElementById('mkt-panel-ubicacion');
    if (ubicacion && ubicacion.value.trim()) filters.ubicacion = ubicacion.value.trim().toLowerCase();
    var horasMin = document.getElementById('mkt-panel-horas-min');
    if (horasMin && horasMin.value) filters.horas_min = parseInt(horasMin.value);
    var horasMax = document.getElementById('mkt-panel-horas-max');
    if (horasMax && horasMax.value) filters.horas_max = parseInt(horasMax.value);
    return filters;
  }

  function applyPanelFilters(items, filters) {
    return items.filter(function (l) {
      if (filters.tipo && l.tipo !== filters.tipo) return false;
      if (filters.estado && l.estado !== filters.estado) return false;
      if (filters.condicion && l.condicion !== filters.condicion) return false;
      if (filters.ano_min && (!l.ano || l.ano < filters.ano_min)) return false;
      if (filters.ano_max && (!l.ano || l.ano > filters.ano_max)) return false;
      var precio = parseFloat(l.precio) || 0;
      if (l.moneda === 'CLP') precio = precio / USD_TO_CLP;
      if (filters.precio_min && precio < filters.precio_min) return false;
      if (filters.precio_max && precio > filters.precio_max) return false;
      if (filters.ubicacion && l.ubicacion) {
        if (l.ubicacion.toLowerCase().indexOf(filters.ubicacion) === -1) return false;
      } else if (filters.ubicacion && !l.ubicacion) { return false; }
      var horas = parseInt(l.horas) || 0;
      if (filters.horas_min && horas < filters.horas_min) return false;
      if (filters.horas_max && horas > filters.horas_max) return false;
      if (filters.keyword) {
        var searchText = [l.nombre, l.tipo, l.ubicacion, l.descripcion, l.estado, l.condicion]
          .filter(Boolean).join(' ').toLowerCase();
        if (searchText.indexOf(filters.keyword) === -1) return false;
      }
      return true;
    });
  }

  function applyPanelSort(items) {
    var sorted = items.slice();
    switch (panelSortValue) {
      case 'precio_asc':
        sorted.sort(function (a, b) {
          var pa = a.moneda === 'CLP' ? (parseFloat(a.precio) / USD_TO_CLP) : parseFloat(a.precio);
          var pb = b.moneda === 'CLP' ? (parseFloat(b.precio) / USD_TO_CLP) : parseFloat(b.precio);
          return (pa || 0) - (pb || 0);
        }); break;
      case 'precio_desc':
        sorted.sort(function (a, b) {
          var pa = a.moneda === 'CLP' ? (parseFloat(a.precio) / USD_TO_CLP) : parseFloat(a.precio);
          var pb = b.moneda === 'CLP' ? (parseFloat(b.precio) / USD_TO_CLP) : parseFloat(b.precio);
          return (pb || 0) - (pa || 0);
        }); break;
      case 'ano_desc':
        sorted.sort(function (a, b) { return (b.ano || 0) - (a.ano || 0); }); break;
      case 'ano_asc':
        sorted.sort(function (a, b) { return (a.ano || 0) - (b.ano || 0); }); break;
      default:
        sorted.sort(function (a, b) {
          return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        });
    }
    return sorted;
  }

  function renderBuyTab() {
    var container = document.getElementById('mkt-tab-content-buy');
    if (!container) return;
    var filters = getPanelFilters();
    filteredListings = applyPanelFilters(listings, filters);
    filteredListings = applyPanelSort(filteredListings);
    var countEl = document.getElementById('mkt-panel-count');
    if (countEl) {
      countEl.textContent = 'Mostrando ' + filteredListings.length + ' de ' + listings.length + ' embarcaciones';
    }
    var gridEl = document.getElementById('mkt-panel-grid');
    if (!gridEl) return;
    if (filteredListings.length === 0) {
      gridEl.innerHTML = '<div style="text-align:center;padding:60px 20px;color:#94a3b8">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>' +
        '<p style="font-size:16px;margin:0 0 8px;font-weight:600;color:#475569">Sin resultados</p>' +
        '<p style="font-size:14px;margin:0">No encontramos embarcaciones con esos filtros</p>' +
        '<button onclick="window.__mktClearFilters()" style="margin-top:16px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:10px 24px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">Limpiar filtros</button></div>';
    } else {
      var html = '';
      filteredListings.forEach(function (item) { html += buildListingCard(item); });
      gridEl.innerHTML = html;
    }
  }

  window.__mktApplyFilters = function () { renderBuyTab(); };

  window.__mktClearFilters = function () {
    var ids = ['mkt-panel-search','mkt-panel-tipo','mkt-panel-estado','mkt-panel-condicion',
      'mkt-panel-precio-min','mkt-panel-precio-max','mkt-panel-ano-min','mkt-panel-ano-max',
      'mkt-panel-ubicacion','mkt-panel-horas-min','mkt-panel-horas-max'];
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.value = '';
    });
    var sortEl = document.getElementById('mkt-panel-sort');
    if (sortEl) sortEl.value = 'recientes';
    panelSortValue = 'recientes';
    var adv = document.getElementById('mkt-panel-advanced');
    if (adv) adv.style.display = 'none';
    var togBtn = document.getElementById('mkt-panel-toggle-adv');
    if (togBtn) togBtn.setAttribute('data-open', 'false');
    renderBuyTab();
  };

  window.__mktToggleAdvanced = function () {
    var adv = document.getElementById('mkt-panel-advanced');
    var btn = document.getElementById('mkt-panel-toggle-adv');
    if (!adv) return;
    var isOpen = btn && btn.getAttribute('data-open') === 'true';
    adv.style.display = isOpen ? 'none' : 'block';
    if (btn) btn.setAttribute('data-open', isOpen ? 'false' : 'true');
  };

  function buildFilterBar() {
    var selectStyle = 'padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;background:#fff;cursor:pointer;outline:none;min-width:0;color:#475569';
    var inputStyle = 'padding:8px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;min-width:0;color:#475569;width:100%';
    var smallInputStyle = 'padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;color:#475569;width:100%;box-sizing:border-box';
    return (
      '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:16px;margin-bottom:20px">' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<div style="flex:1;min-width:200px;position:relative">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
      '<input id="mkt-panel-search" type="text" placeholder="Buscar embarcaciones..." style="' + inputStyle + ';padding-left:36px" oninput="clearTimeout(window.__mktSearchTimer);window.__mktSearchTimer=setTimeout(window.__mktApplyFilters,300)">' +
      '</div>' +
      '<select id="mkt-panel-tipo" style="' + selectStyle + '" onchange="window.__mktApplyFilters()">' +
      '<option value="">Todos los tipos</option>' +
      '<option value="Bowrider">Bowrider</option>' +
      '<option value="Pesca">Pesca</option>' +
      '<option value="Jet Boat">Jet Boat</option>' +
      '<option value="Yate">Yate</option>' +
      '<option value="Velero">Velero</option>' +
      '<option value="Moto de Agua">Moto de Agua</option>' +
      '<option value="Catamaran">Catamaran</option>' +
      '<option value="Otro">Otro</option>' +
      '</select>' +
      '<select id="mkt-panel-estado" style="' + selectStyle + '" onchange="window.__mktApplyFilters()">' +
      '<option value="">Estado</option>' +
      '<option value="Nueva">Nueva</option>' +
      '<option value="Usada">Usada</option>' +
      '</select>' +
      '<select id="mkt-panel-condicion" style="' + selectStyle + '" onchange="window.__mktApplyFilters()">' +
      '<option value="">Condicion</option>' +
      '<option value="Excelente">Excelente</option>' +
      '<option value="Muy Buena">Muy Buena</option>' +
      '<option value="Buena">Buena</option>' +
      '<option value="Regular">Regular</option>' +
      '<option value="Para Reparacion">Para Reparacion</option>' +
      '</select>' +
      '<select id="mkt-panel-sort" style="' + selectStyle + '" onchange="panelSortValue=this.value;window.__mktApplyFilters()">' +
      '<option value="recientes">Mas recientes</option>' +
      '<option value="precio_asc">Precio: menor a mayor</option>' +
      '<option value="precio_desc">Precio: mayor a menor</option>' +
      '<option value="ano_desc">Ano: mas reciente</option>' +
      '<option value="ano_asc">Ano: mas antiguo</option>' +
      '</select>' +
      '<button id="mkt-panel-toggle-adv" data-open="false" onclick="window.__mktToggleAdvanced()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:13px;font-weight:500;cursor:pointer;color:#475569;white-space:nowrap;transition:all .2s" onmouseover="this.style.borderColor=\'#3b82f6\';this.style.color=\'#2563eb\'" onmouseout="this.style.borderColor=\'#e2e8f0\';this.style.color=\'#475569\'">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>Mas filtros</button>' +
      '<button onclick="window.__mktClearFilters()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border:1px solid #fecaca;border-radius:10px;background:#fff;font-size:13px;font-weight:500;cursor:pointer;color:#dc2626;white-space:nowrap;transition:all .2s" onmouseover="this.style.background=\'#fef2f2\'" onmouseout="this.style.background=\'#fff\'">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Limpiar</button>' +
      '</div>' +
      '<div id="mkt-panel-advanced" style="display:none;margin-top:14px;padding-top:14px;border-top:1px solid #f1f5f9">' +
      '<div class="mkt-adv-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Precio USD (min)</label>' +
      '<input id="mkt-panel-precio-min" type="number" placeholder="Min" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Precio USD (max)</label>' +
      '<input id="mkt-panel-precio-max" type="number" placeholder="Max" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Ano (min)</label>' +
      '<input id="mkt-panel-ano-min" type="number" placeholder="2010" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Ano (max)</label>' +
      '<input id="mkt-panel-ano-max" type="number" placeholder="2026" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Ubicacion</label>' +
      '<input id="mkt-panel-ubicacion" type="text" placeholder="Ciudad" style="' + smallInputStyle + '" oninput="clearTimeout(window.__mktUbicTimer);window.__mktUbicTimer=setTimeout(window.__mktApplyFilters,300)">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Horas motor (min)</label>' +
      '<input id="mkt-panel-horas-min" type="number" placeholder="Min" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#64748b">Horas motor (max)</label>' +
      '<input id="mkt-panel-horas-max" type="number" placeholder="Max" style="' + smallInputStyle + '" onchange="window.__mktApplyFilters()">' +
      '</div>' +
      '</div></div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">' +
      '<span id="mkt-panel-count" style="font-size:13px;color:#64748b">Mostrando ' + listings.length + ' de ' + listings.length + ' embarcaciones</span>' +
      '</div>' +
      '</div>'
    );
  }

  function buildPage() {
    var user = getUserData();
    var initials = user ? userInitials(user.name) : "?";

    filteredListings = applyPanelSort(listings.slice());
    var buyCards = "";
    if (listings.length === 0) {
      buyCards =
        '<div style="text-align:center;padding:60px 20px;color:#94a3b8"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 20L7 4l5 16 5-16 5 16"/></svg><p style="font-size:16px;margin:0">No hay embarcaciones publicadas aun</p></div>';
    } else {
      buyCards = '<div id="mkt-panel-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">';
      filteredListings.forEach(function (item) {
        buyCards += buildListingCard(item);
      });
      buyCards += "</div>";
    }

    var myCards = "";
    if (myListings.length === 0) {
      myCards =
        '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:60px 20px;text-align:center">' +
        '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 20L7 4l5 16 5-16 5 16"/></svg>' +
        '<h3 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 8px">No tienes publicaciones activas</h3>' +
        '<p style="color:#64748b;margin:0 0 20px;font-size:14px">Publica tu embarcacion y llega a miles de compradores potenciales</p>' +
        '<button onclick="window.__mktOpenPublish()" style="background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Crear Publicacion</button>' +
        "</div>";
    } else {
      myCards = '<div style="display:flex;flex-direction:column;gap:12px">';
      myListings.forEach(function (item) {
        myCards += buildMyListingCard(item);
      });
      myCards += "</div>";
    }

    return (
      '<div class="mkt-enhanced" style="animation:mktFadeIn .4s ease">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">' +
      "<div>" +
      '<h1 style="font-size:28px;font-weight:700;color:#0f172a;margin:0">Marketplace</h1>' +
      '<p style="color:#64748b;margin:4px 0 0;font-size:14px">Compra y vende embarcaciones en nuestra comunidad</p>' +
      "</div>" +
      '<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">' +
      '<button onclick="window.__mktOpenPublish()" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.opacity=\'0.9\';this.style.transform=\'scale(1.02)\'" onmouseout="this.style.opacity=\'1\';this.style.transform=\'none\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Publicar Embarcacion</button>' +
      '<span style="font-size:12px;color:#64748b;font-weight:500">Para Venta y/o Arriendo</span>' +
      '</div>' +
      "</div>" +
      '<div style="margin-bottom:20px">' +
      '<div style="display:flex;border-bottom:2px solid #e2e8f0;gap:0">' +
      '<button id="mkt-tab-buy" onclick="window.__mktSwitchTab(\'buy\')" style="padding:12px 28px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid #2563eb;color:#2563eb;margin-bottom:-2px;transition:all .2s">Comprar</button>' +
      '<button id="mkt-tab-sell" onclick="window.__mktSwitchTab(\'sell\')" style="padding:12px 28px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:#64748b;margin-bottom:-2px;transition:all .2s">Mis Publicaciones</button>' +
      "</div></div>" +
      '<div id="mkt-tab-content-buy">' +
      buildFilterBar() +
      buyCards +
      "</div>" +
      '<div id="mkt-tab-content-sell" style="display:none">' +
      myCards +
      "</div></div>"
    );
  }

  function renderPhotoPreview() {
    var container = document.getElementById("mkt-photo-preview");
    if (!container) return;
    container.innerHTML = "";
    uploadedPhotos.forEach(function (url, idx) {
      var div = document.createElement("div");
      div.style.cssText =
        "position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0";
      div.innerHTML =
        '<img src="' +
        url +
        '" style="width:100%;height:100%;object-fit:cover">' +
        '<button onclick="window.__mktRemovePhoto(' +
        idx +
        ')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;width:20px;height:20px;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>';
      container.appendChild(div);
    });
    var dropzone = document.getElementById("mkt-photo-dropzone");
    if (dropzone) {
      dropzone.style.display = uploadedPhotos.length >= 8 ? "none" : "block";
    }
  }

  function setupPhotoHandlers() {
    var input = document.getElementById("mkt-photo-input");
    var dropzone = document.getElementById("mkt-photo-dropzone");
    if (!input) return;

    input.addEventListener("change", async function () {
      var files = Array.from(this.files);
      var remaining = 8 - uploadedPhotos.length;
      if (remaining <= 0) {
        alert("Maximo 8 fotos permitidas");
        return;
      }
      files = files.slice(0, remaining);
      for (var i = 0; i < files.length; i++) {
        var result = await uploadPhotoFile(files[i]);
        if (result && result.url) {
          uploadedPhotos.push(result.url);
        }
      }
      renderPhotoPreview();
      input.value = "";
    });

    if (dropzone) {
      dropzone.addEventListener("dragover", function (e) {
        e.preventDefault();
        this.style.borderColor = "#3b82f6";
        this.style.background = "#eff6ff";
      });
      dropzone.addEventListener("dragleave", function (e) {
        e.preventDefault();
        this.style.borderColor = "#cbd5e1";
        this.style.background = "#fafafa";
      });
      dropzone.addEventListener("drop", async function (e) {
        e.preventDefault();
        this.style.borderColor = "#cbd5e1";
        this.style.background = "#fafafa";
        var files = Array.from(e.dataTransfer.files).filter(function (f) {
          return f.type.startsWith("image/");
        });
        var remaining = 8 - uploadedPhotos.length;
        files = files.slice(0, remaining);
        for (var i = 0; i < files.length; i++) {
          var result = await uploadPhotoFile(files[i]);
          if (result && result.url) {
            uploadedPhotos.push(result.url);
          }
        }
        renderPhotoPreview();
      });
    }
  }

  window.__mktOpenPublish = function () {
    uploadedPhotos = [];
    var existing = document.getElementById("mkt-publish-overlay");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", buildPublishModal());
    setupPhotoHandlers();
    document.body.style.overflow = "hidden";
  };

  window.__mktClosePublish = function () {
    var overlay = document.getElementById("mkt-publish-overlay");
    if (overlay) overlay.remove();
    document.body.style.overflow = "";
  };

  window.__mktShowDetail = async function (id) {
    var item = listings.find(function (l) {
      return l.id == id;
    });
    if (!item) {
      var data = await apiCall("?action=get&id=" + id);
      if (data && data.listing) item = data.listing;
    }
    if (!item) return;
    var existing = document.getElementById("mkt-detail-overlay");
    if (existing) existing.remove();
    document.body.insertAdjacentHTML("beforeend", buildDetailModal(item));
    document.body.style.overflow = "hidden";
    detailModalOpen = true;
  };

  window.__mktCloseDetail = function () {
    var overlay = document.getElementById("mkt-detail-overlay");
    if (overlay) overlay.remove();
    document.body.style.overflow = "";
    detailModalOpen = false;
  };

  window.__mktSwitchTab = function (tab) {
    var buyContent = document.getElementById("mkt-tab-content-buy");
    var sellContent = document.getElementById("mkt-tab-content-sell");
    var buyTab = document.getElementById("mkt-tab-buy");
    var sellTab = document.getElementById("mkt-tab-sell");
    if (tab === "buy") {
      buyContent.style.display = "block";
      sellContent.style.display = "none";
      buyTab.style.borderBottomColor = "#2563eb";
      buyTab.style.color = "#2563eb";
      sellTab.style.borderBottomColor = "transparent";
      sellTab.style.color = "#64748b";
    } else {
      buyContent.style.display = "none";
      sellContent.style.display = "block";
      sellTab.style.borderBottomColor = "#2563eb";
      sellTab.style.color = "#2563eb";
      buyTab.style.borderBottomColor = "transparent";
      buyTab.style.color = "#64748b";
      loadMyListings().then(function () {
        var container = document.getElementById("mkt-tab-content-sell");
        if (!container) return;
        if (myListings.length === 0) {
          container.innerHTML =
            '<div style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:60px 20px;text-align:center">' +
            '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 20L7 4l5 16 5-16 5 16"/></svg>' +
            '<h3 style="font-size:18px;font-weight:700;color:#1e293b;margin:0 0 8px">No tienes publicaciones activas</h3>' +
            '<p style="color:#64748b;margin:0 0 20px;font-size:14px">Publica tu embarcacion y llega a miles de compradores potenciales</p>' +
            '<button onclick="window.__mktOpenPublish()" style="background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer">Crear Publicacion</button>' +
            "</div>";
        } else {
          container.innerHTML =
            '<div style="display:flex;flex-direction:column;gap:12px">';
          myListings.forEach(function (item) {
            container.innerHTML += buildMyListingCard(item);
          });
        }
      });
    }
  };

  window.__mktRemovePhoto = function (idx) {
    uploadedPhotos.splice(idx, 1);
    renderPhotoPreview();
  };

  window.__mktRemoveEditPhoto = function (idx) {
    editPhotos.splice(idx, 1);
    renderEditPhotoPreview();
  };

  function renderEditPhotoPreview() {
    var container = document.getElementById('mkt-edit-photo-preview');
    if (!container) return;
    container.innerHTML = '';
    editPhotos.forEach(function (url, idx) {
      var div = document.createElement('div');
      div.style.cssText = 'position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0';
      div.innerHTML = '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover">' +
        '<button onclick="window.__mktRemoveEditPhoto(' + idx + ')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;width:20px;height:20px;border-radius:50%;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center">&times;</button>';
      container.appendChild(div);
    });
    var dropzone = document.getElementById('mkt-edit-photo-dropzone');
    if (dropzone) dropzone.style.display = editPhotos.length >= 8 ? 'none' : 'block';
  }

  function setupEditPhotoHandlers() {
    var input = document.getElementById('mkt-edit-photo-input');
    var dropzone = document.getElementById('mkt-edit-photo-dropzone');
    if (!input) return;
    input.addEventListener('change', async function () {
      var files = Array.from(this.files);
      var remaining = 8 - editPhotos.length;
      if (remaining <= 0) { alert('Maximo 8 fotos permitidas'); return; }
      files = files.slice(0, remaining);
      for (var i = 0; i < files.length; i++) {
        var result = await uploadPhotoFile(files[i]);
        if (result && result.url) editPhotos.push(result.url);
      }
      renderEditPhotoPreview();
      input.value = '';
    });
    if (dropzone) {
      dropzone.addEventListener('dragover', function (e) { e.preventDefault(); this.style.borderColor = '#3b82f6'; this.style.background = '#eff6ff'; });
      dropzone.addEventListener('dragleave', function (e) { e.preventDefault(); this.style.borderColor = '#cbd5e1'; this.style.background = '#fafafa'; });
      dropzone.addEventListener('drop', async function (e) {
        e.preventDefault();
        this.style.borderColor = '#cbd5e1'; this.style.background = '#fafafa';
        var files = Array.from(e.dataTransfer.files).filter(function (f) { return f.type.startsWith('image/'); });
        var remaining = 8 - editPhotos.length;
        files = files.slice(0, remaining);
        for (var i = 0; i < files.length; i++) {
          var result = await uploadPhotoFile(files[i]);
          if (result && result.url) editPhotos.push(result.url);
        }
        renderEditPhotoPreview();
      });
    }
  }

  function buildEditArriendoFields(item) {
    var periodos = item.arriendo_periodos || {};
    var isArriendo = item.tipo_publicacion === 'arriendo';
    var inputStyle = 'padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s';
    var selectStyle = 'padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none;width:100%;box-sizing:border-box;transition:border-color .2s;background:#fff;cursor:pointer;appearance:auto';
    var selectedPeriodo = '';
    var selectedPrecio = '';
    var ps = [['hora', 'Por Hora'], ['medio_dia', 'Por 1/2 Dia'], ['dia', 'Por Dia'], ['semana', 'Por Semana'], ['mes', 'Por Mes']];
    ps.forEach(function(p) {
      if (periodos[p[0]] && periodos[p[0]] > 0) {
        selectedPeriodo = p[0];
        selectedPrecio = String(periodos[p[0]]).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      }
    });
    var html = '<div id="edit-mkt-arriendo-periodos" style="display:' + (isArriendo ? 'block' : 'none') + ';margin-top:14px;padding:16px;background:#fffbeb;border-radius:12px;border:1px solid #fde68a">' +
      '<label style="font-size:13px;font-weight:700;color:#92400e;display:block;margin-bottom:12px">Tarifa de Arriendo (CLP)</label>' +
      '<div style="display:flex;gap:10px;align-items:flex-end">' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#92400e">Periodo</label>' +
      '<select id="edit-mkt-arriendo-periodo-select" name="arriendo_periodo_tipo" style="' + selectStyle + '" onfocus="this.style.borderColor=\'#f59e0b\'" onblur="this.style.borderColor=\'#e2e8f0\'">' +
      '<option value="" disabled' + (!selectedPeriodo ? ' selected' : '') + '>Seleccionar periodo</option>' +
      '<option value="hora"' + (selectedPeriodo === 'hora' ? ' selected' : '') + '>Por Hora</option>' +
      '<option value="medio_dia"' + (selectedPeriodo === 'medio_dia' ? ' selected' : '') + '>Por 1/2 Dia</option>' +
      '<option value="dia"' + (selectedPeriodo === 'dia' ? ' selected' : '') + '>Por Dia</option>' +
      '<option value="semana"' + (selectedPeriodo === 'semana' ? ' selected' : '') + '>Por Semana</option>' +
      '<option value="mes"' + (selectedPeriodo === 'mes' ? ' selected' : '') + '>Por Mes</option>' +
      '</select></div>' +
      '<div style="flex:1;display:flex;flex-direction:column;gap:4px">' +
      '<label style="font-size:12px;font-weight:600;color:#92400e">Precio (CLP)</label>' +
      '<input id="edit-mkt-arriendo-precio-input" name="arriendo_precio" type="text" value="' + selectedPrecio + '" placeholder="Ej: 150.000" style="' + inputStyle + '" onfocus="this.style.borderColor=\'#f59e0b\'" onblur="this.style.borderColor=\'#e2e8f0\'" oninput="this.value=this.value.replace(/[^0-9]/g,\'\').replace(/\\B(?=(\\d{3})+(?!\\d))/g,\'.\')">' +
      '</div></div></div>';
    return html;
  }

  function buildEditTipoPubSelector(item) {
    var isArriendo = item.tipo_publicacion === 'arriendo';
    return '<div style="grid-column:1/-1;margin-bottom:6px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:8px">Modalidad de Publicacion</label>' +
      '<div style="display:flex;gap:10px">' +
      '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid ' + (!isArriendo ? '#22c55e' : '#e2e8f0') + ';border-radius:12px;cursor:pointer;transition:all .2s;background:#fff" id="edit-mkt-label-venta" onclick="window.__mktSelectTipoPub(\'edit-\',\'venta\')"><input type="radio" name="tipo_publicacion" value="venta"' + (!isArriendo ? ' checked' : '') + ' style="accent-color:#22c55e"><div><div style="font-weight:700;color:#1e293b;font-size:14px">Venta</div><div style="font-size:12px;color:#64748b">Vender embarcacion</div></div></label>' +
      '<label style="flex:1;display:flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid ' + (isArriendo ? '#f59e0b' : '#e2e8f0') + ';border-radius:12px;cursor:pointer;transition:all .2s;background:#fff" id="edit-mkt-label-arriendo" onclick="window.__mktSelectTipoPub(\'edit-\',\'arriendo\')"><input type="radio" name="tipo_publicacion" value="arriendo"' + (isArriendo ? ' checked' : '') + ' style="accent-color:#f59e0b"><div><div style="font-weight:700;color:#1e293b;font-size:14px">Arriendo <span style="background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;font-size:10px;padding:2px 7px;border-radius:6px;font-weight:700;vertical-align:middle;margin-left:4px;letter-spacing:.5px">NEW</span></div><div style="font-size:12px;color:#64748b">Arrendar por periodos</div></div></label>' +
      '</div></div>';
  }

  function buildEditModal(item) {
    var isArriendo = item.tipo_publicacion === 'arriendo';
    var selTipo = function (v) { return ['Bowrider','Pesca','Jet Boat','Yate','Velero','Moto de Agua','Catamaran','Otro'].map(function (o) { return '<option value="' + o + '"' + (o === (item.tipo || '') ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
    var selEstado = function (v) { return ['Usada','Nueva'].map(function (o) { return '<option value="' + o + '"' + (o === (item.estado || '') ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
    var selCondicion = function () { return ['Excelente','Muy Buena','Buena','Regular','Para Reparacion'].map(function (o) { return '<option value="' + o + '"' + (o === (item.condicion || '') ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
    var selMoneda = function () { return ['USD','CLP'].map(function (o) { return '<option value="' + o + '"' + (o === (item.moneda || '') ? ' selected' : '') + '>' + o + '</option>'; }).join(''); };
    return (
      '<div id="mkt-edit-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:mktFadeIn .2s ease" onclick="if(event.target===this)window.__mktCloseEdit()">' +
      '<div style="background:#fff;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;position:relative;animation:mktSlideUp .3s ease">' +
      '<div style="padding:24px 24px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0">Editar Publicaci\u00f3n</h2>' +
      '<button onclick="window.__mktCloseEdit()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button>' +
      '</div>' +
      '<p style="color:#64748b;font-size:14px;margin:0 0 20px">Modifica los datos de tu embarcaci\u00f3n</p>' +
      '</div>' +
      '<form id="mkt-edit-form" style="padding:0 24px 24px" onsubmit="return window.__mktSubmitEdit(event)">' +
      '<input type="hidden" name="id" value="' + item.id + '">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
      buildEditTipoPubSelector(item) +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Nombre / Modelo</label><input name="nombre" type="text" value="' + (item.nombre || '').replace(/"/g, '&quot;') + '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Tipo</label><select name="tipo" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer">' + selTipo() + '</select></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Ano</label><input name="ano" type="number" value="' + (item.ano || '') + '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Eslora (pies)</label><input name="eslora" type="text" value="' + (item.eslora || '').replace(/"/g, '&quot;') + '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>' +
      '<div id="edit-mkt-precio-field" style="' + (isArriendo ? 'display:none' : 'display:flex') + ';flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Precio</label><div style="display:flex;gap:8px"><input name="precio" type="number" value="' + (item.precio || '') + '" style="flex:1;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"><select name="moneda" style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer;min-width:90px">' + selMoneda() + '</select></div></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Ubicacion</label><input name="ubicacion" type="text" value="' + (item.ubicacion || '').replace(/"/g, '&quot;') + '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Estado</label><select name="estado" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer">' + selEstado() + '</select></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Condicion</label><select name="condicion" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;background:#fff;cursor:pointer">' + selCondicion() + '</select></div>' +
      '<div style="display:flex;flex-direction:column;gap:4px"><label style="font-size:13px;font-weight:600;color:#475569">Horas de Motor</label><input name="horas" type="number" value="' + (item.horas || '') + '" style="padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;outline:none" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'"></div>' +
      '</div>' +
      buildEditArriendoFields(item) +
      '<div style="margin-top:14px"><label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:4px">Descripcion</label><textarea name="descripcion" rows="3" style="width:100%;padding:10px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box" onfocus="this.style.borderColor=\'#3b82f6\'" onblur="this.style.borderColor=\'#e2e8f0\'">' + (item.descripcion || '') + '</textarea></div>' +
      '<div style="margin-top:14px">' +
      '<label style="font-size:13px;font-weight:600;color:#475569;display:block;margin-bottom:6px">Fotos <span style="color:#94a3b8;font-weight:400">(maximo 8)</span></label>' +
      '<div id="mkt-edit-photo-preview" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px"></div>' +
      '<div id="mkt-edit-photo-dropzone" style="border:2px dashed #cbd5e1;border-radius:12px;padding:24px;text-align:center;cursor:pointer;transition:all .2s;background:#fafafa" onmouseover="this.style.borderColor=\'#3b82f6\';this.style.background=\'#eff6ff\'" onmouseout="this.style.borderColor=\'#cbd5e1\';this.style.background=\'#fafafa\'" onclick="document.getElementById(\'mkt-edit-photo-input\').click()">' +
      '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="margin:0 auto 8px;display:block"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      '<p style="color:#64748b;font-size:14px;margin:0">Arrastra fotos aqui o haz clic para seleccionar</p>' +
      '<p style="color:#94a3b8;font-size:12px;margin:4px 0 0">JPG, PNG, WebP (max 5MB cada una)</p>' +
      '</div>' +
      '<input type="file" id="mkt-edit-photo-input" accept="image/*" multiple style="display:none">' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;gap:12px;margin-top:20px">' +
      '<button type="button" onclick="window.__mktCloseEdit()" style="padding:10px 24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font-size:14px;font-weight:500;cursor:pointer;color:#475569;transition:all .2s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'">Cancelar</button>' +
      '<button type="submit" id="mkt-edit-btn" style="padding:10px 28px;border:none;border-radius:10px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.opacity=\'0.9\'" onmouseout="this.style.opacity=\'1\'">Guardar Cambios</button>' +
      '</div></form></div></div>'
    );
  }

  window.__mktOpenEdit = async function (id) {
    var item = myListings.find(function (l) { return l.id == id; });
    if (!item) {
      var data = await apiCall('?action=get&id=' + id);
      if (data && data.listing) item = data.listing;
    }
    if (!item) return;
    editingId = item.id;
    editPhotos = (item.fotos && Array.isArray(item.fotos)) ? item.fotos.slice() : [];
    var existing = document.getElementById('mkt-edit-overlay');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', buildEditModal(item));
    setupEditPhotoHandlers();
    renderEditPhotoPreview();
    document.body.style.overflow = 'hidden';
  };

  window.__mktCloseEdit = function () {
    var overlay = document.getElementById('mkt-edit-overlay');
    if (overlay) overlay.remove();
    document.body.style.overflow = '';
    editingId = null;
  };

  window.__mktSubmitEdit = async function (e) {
    e.preventDefault();
    if (isSubmitting) return false;
    isSubmitting = true;
    var form = document.getElementById('mkt-edit-form');
    var btn = document.getElementById('mkt-edit-btn');
    var oldText = btn.innerHTML;
    btn.innerHTML = 'Guardando...';
    btn.disabled = true;
    var tipoPub = 'venta';
    var tipoPubRadio = form.querySelector('input[name="tipo_publicacion"]:checked');
    if (tipoPubRadio) tipoPub = tipoPubRadio.value;

    var arriendoPeriodos = {};
    if (tipoPub === 'arriendo') {
      var periodoSelect = form.querySelector('select[name="arriendo_periodo_tipo"]');
      var precioInput = form.querySelector('input[name="arriendo_precio"]');
      if (periodoSelect && periodoSelect.value && precioInput && precioInput.value) {
        var numVal = parseFloat(precioInput.value.replace(/\./g, ''));
        if (numVal > 0) arriendoPeriodos[periodoSelect.value] = numVal;
      }
    }

    var data = {
      id: parseInt(form.id.value),
      nombre: form.nombre.value,
      tipo: form.tipo.value,
      ano: form.ano.value,
      eslora: form.eslora.value,
      precio: form.precio.value,
      moneda: form.moneda.value,
      ubicacion: form.ubicacion.value,
      descripcion: form.descripcion.value,
      estado: form.estado.value,
      condicion: form.condicion.value,
      horas: form.horas.value,
      fotos: editPhotos,
      tipo_publicacion: tipoPub,
      arriendo_periodos: tipoPub === 'arriendo' ? arriendoPeriodos : null,
    };
    try {
      var result = await apiCall('?action=update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (result && result.success) {
        window.__mktCloseEdit();
        await loadListings();
        await loadMyListings();
        enhanceMarketplace(true);
        window.__mktSwitchTab('sell');
        showSuccessEditModal();
      } else {
        alert('Error al actualizar: ' + (result ? result.error : 'Error de red'));
        btn.innerHTML = oldText;
        btn.disabled = false;
      }
    } catch (err) {
      alert('Error de conexion');
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
    isSubmitting = false;
    return false;
  };

  window.__mktDeleteListing = function (id, nombre) {
    showDeleteConfirmModal(id, nombre);
  };

  function showDeleteConfirmModal(id, nombre) {
    var overlay = document.createElement('div');
    overlay.id = 'mkt-delete-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;animation:mktFadeIn .3s ease';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:40px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.25);animation:mktSlideUp .4s ease">' +
      '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#dc2626,#ef4444);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(220,38,38,.35)">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
      '</div>' +
      '<h2 style="font-size:24px;font-weight:700;color:#1e293b;margin:0 0 8px">Eliminar Publicaci\u00f3n</h2>' +
      '<p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5">\u00bfEst\u00e1s seguro de eliminar <strong>' + (nombre || '') + '</strong>? Esta acci\u00f3n no se puede deshacer.</p>' +
      '<div style="display:flex;gap:12px;justify-content:center">' +
      '<button onclick="document.getElementById(\'mkt-delete-overlay\').remove()" style="padding:12px 32px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;color:#475569;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.background=\'#f8fafc\'" onmouseout="this.style.background=\'#fff\'">Cancelar</button>' +
      '<button onclick="window.__mktConfirmDelete(' + id + ')" style="padding:12px 32px;border:none;border-radius:12px;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(220,38,38,.3)" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'none\'">Eliminar</button>' +
      '</div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  }

  window.__mktConfirmDelete = async function (id) {
    var overlay = document.getElementById('mkt-delete-overlay');
    if (overlay) overlay.remove();
    var result = await apiCall('?action=delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    if (result && result.success) {
      await loadListings();
      await loadMyListings();
      enhanceMarketplace(true);
      window.__mktSwitchTab('sell');
    } else {
      alert('Error al eliminar: ' + (result ? result.error : 'Error de red'));
    }
  };

  function showSuccessEditModal() {
    var overlay = document.createElement('div');
    overlay.id = 'mkt-success-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;animation:mktFadeIn .3s ease';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:40px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.25);animation:mktSlideUp .4s ease">' +
      '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(16,185,129,.35)">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>' +
      '<h2 style="font-size:24px;font-weight:700;color:#1e293b;margin:0 0 8px">Cambios Guardados</h2>' +
      '<p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5">Tu publicaci\u00f3n ha sido actualizada correctamente.</p>' +
      '<button onclick="document.getElementById(\'mkt-success-overlay\').remove()" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;padding:14px 48px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(16,185,129,.3)" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'none\'">Aceptar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) overlay.remove(); });
  }

  window.__mktOpenChatAbout = function (listingName) {
    window.__mktCloseDetail();
    var chatBtn = document.querySelector(".chat-floating-btn");
    if (!chatBtn) {
      alert("Chat no disponible. Inicia sesion primero.");
      return;
    }
    chatBtn.click();
    setTimeout(function () {
      var newConvBtn = document.querySelector(".chat-new-conversation-btn");
      if (newConvBtn) newConvBtn.click();
      setTimeout(function () {
        var textarea = document.querySelector("#chat-new-conversation-modal textarea");
        if (textarea) {
          textarea.value =
            "Hola, me interesa la embarcacion: " +
            listingName +
            " publicada en el Marketplace. Me gustaria obtener mas informacion.";
          textarea.focus();
        }
      }, 300);
    }, 500);
  };

  window.__mktSubmitForm = async function (e) {
    e.preventDefault();
    if (isSubmitting) return false;
    isSubmitting = true;

    var form = document.getElementById("mkt-publish-form");
    var btn = document.getElementById("mkt-submit-btn");
    var oldText = btn.innerHTML;
    btn.innerHTML = "Publicando...";
    btn.disabled = true;

    var tipoPub = 'venta';
    var tipoPubRadio = form.querySelector('input[name="tipo_publicacion"]:checked');
    if (tipoPubRadio) tipoPub = tipoPubRadio.value;

    var arriendoPeriodos = {};
    if (tipoPub === 'arriendo') {
      var periodoSelect = form.querySelector('select[name="arriendo_periodo_tipo"]');
      var precioInput = form.querySelector('input[name="arriendo_precio"]');
      if (periodoSelect && periodoSelect.value && precioInput && precioInput.value) {
        var numVal = parseFloat(precioInput.value.replace(/\./g, ''));
        if (numVal > 0) arriendoPeriodos[periodoSelect.value] = numVal;
      }
    }

    var data = {
      nombre: form.nombre.value,
      tipo: form.tipo.value,
      ano: form.ano.value,
      eslora: form.eslora.value,
      precio: form.precio.value,
      moneda: form.moneda.value,
      ubicacion: form.ubicacion.value,
      descripcion: form.descripcion.value,
      estado: form.estado.value,
      condicion: form.condicion.value,
      horas: form.horas.value,
      fotos: uploadedPhotos,
      tipo_publicacion: tipoPub,
      arriendo_periodos: tipoPub === 'arriendo' ? arriendoPeriodos : null,
    };

    try {
      var result = await apiCall("?action=create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (result && result.success) {
        window.__mktClosePublish();
        await loadListings();
        await loadMyListings();
        enhanceMarketplace(true);
        showSuccessModal();
      } else {
        alert("Error al publicar: " + (result ? result.error : "Error de red"));
        btn.innerHTML = oldText;
        btn.disabled = false;
      }
    } catch (err) {
      alert("Error de conexion");
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
    isSubmitting = false;
    return false;
  };

  async function enhanceMarketplace(force) {
    if (!isMarketplacePage()) {
      enhanced = false;
      return;
    }
    if ((enhanced && !force) || enhancing) return;
    enhancing = true;

    var main = document.querySelector("main");
    if (!main) { enhancing = false; return; }

    var contentDiv = main.querySelector(".max-w-7xl") || main.firstElementChild;
    if (!contentDiv) { enhancing = false; return; }

    var target = contentDiv.querySelector(".space-y-6, .animate-fade-in") || contentDiv;
    if (!target.querySelector('.mkt-enhanced')) {
      target.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div style="text-align:center"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#2563eb;border-radius:50%;animation:mktSpin 0.8s linear infinite;margin:0 auto 16px"></div><p style="color:#64748b;font-size:14px;margin:0">Cargando marketplace...</p></div></div>';
    }

    await Promise.all([loadListings(), loadMyListings()]);

    target.innerHTML = buildPage();
    applyMobileLayout();
    enhanced = true;
    enhancing = false;

    var fromPublicar = document.referrer.indexOf('/marketplace/publicar') !== -1;
    var hasCookie = document.cookie.indexOf('mkt_publish=1') !== -1;
    var hasStorage = sessionStorage.getItem('mkt_open_publish') === '1';
    if (fromPublicar || hasCookie || hasStorage) {
      sessionStorage.removeItem('mkt_open_publish');
      document.cookie = 'mkt_publish=;path=/;max-age=0';
      setTimeout(function () { window.__mktOpenPublish(); }, 100);
    }
  }

  function showSuccessModal() {
    var overlay = document.createElement('div');
    overlay.id = 'mkt-success-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;animation:mktFadeIn .3s ease';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:20px;padding:40px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 25px 60px rgba(0,0,0,.25);animation:mktSlideUp .4s ease">' +
      '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(16,185,129,.35)">' +
      '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '</div>' +
      '<h2 style="font-size:24px;font-weight:700;color:#1e293b;margin:0 0 8px">Publicaci\u00f3n Exitosa</h2>' +
      '<p style="font-size:15px;color:#64748b;margin:0 0 24px;line-height:1.5">Tu embarcaci\u00f3n ha sido publicada correctamente en el Marketplace. Ya es visible para todos los usuarios.</p>' +
      '<button onclick="document.getElementById(\'mkt-success-overlay\').remove()" style="background:linear-gradient(135deg,#059669,#10b981);color:#fff;border:none;padding:14px 48px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:all .2s;box-shadow:0 4px 12px rgba(16,185,129,.3)" onmouseover="this.style.transform=\'scale(1.03)\'" onmouseout="this.style.transform=\'none\'">Aceptar</button>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
  }

  function applyMobileLayout() {
    if (window.innerWidth > 768) return;
    var aside = document.querySelector('aside');
    var main = document.querySelector('main');
    var rootDiv = document.querySelector('#root > div');
    if (rootDiv) {
      rootDiv.style.setProperty('display', 'flex', 'important');
      rootDiv.style.setProperty('flex-direction', 'column', 'important');
      rootDiv.style.setProperty('overflow-x', 'hidden', 'important');
      rootDiv.style.setProperty('height', 'auto', 'important');
      rootDiv.style.setProperty('min-height', '100vh', 'important');
    }
    if (aside) {
      aside.style.setProperty('position', 'relative', 'important');
      aside.style.setProperty('width', '100%', 'important');
      aside.style.setProperty('max-width', '100%', 'important');
      aside.style.setProperty('height', 'auto', 'important');
      aside.style.setProperty('min-height', 'auto', 'important');
      aside.style.setProperty('flex-shrink', '0', 'important');
    }
    if (main) {
      main.style.setProperty('margin-left', '0', 'important');
      main.style.setProperty('width', '100%', 'important');
      main.style.setProperty('max-width', '100%', 'important');
      main.style.setProperty('padding', '12px', 'important');
      main.style.setProperty('flex-grow', '1', 'important');
      main.style.setProperty('overflow-x', 'hidden', 'important');
      main.style.setProperty('height', 'auto', 'important');
    }
  }

  function addStyles() {
    if (document.getElementById("mkt-enhancer-styles")) return;
    var style = document.createElement("style");
    style.id = "mkt-enhancer-styles";
    style.textContent =
      "@keyframes mktFadeIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes mktSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      "@keyframes mktSpin{to{transform:rotate(360deg)}}" +
      ".mkt-card img{transition:transform .4s ease}" +
      "#mkt-detail-overlay::-webkit-scrollbar,#mkt-publish-overlay::-webkit-scrollbar{width:6px}" +
      "#mkt-detail-overlay::-webkit-scrollbar-thumb,#mkt-publish-overlay::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}" +
      "@media(max-width:768px){.mkt-enhanced [style*='grid-template-columns:repeat']{grid-template-columns:1fr!important}" +
      "#mkt-tab-content-buy>div:first-child>div:first-child{flex-direction:column!important}" +
      "#mkt-tab-content-buy select,#mkt-tab-content-buy button{width:100%!important;box-sizing:border-box}" +
      ".mkt-adv-grid{grid-template-columns:1fr 1fr!important}}";
    document.head.appendChild(style);
  }

  function onReady(cb) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", cb);
    } else {
      cb();
    }
  }

  onReady(function () {
    addStyles();
    applyMobileLayout();

    setTimeout(function () {
      applyMobileLayout();
      enhanceMarketplace();
    }, 500);

    var observer = new MutationObserver(function () {
      applyMobileLayout();
      if (isMarketplacePage() && !enhanced && !detailModalOpen) {
        enhanceMarketplace();
      }
      if (!isMarketplacePage()) {
        enhanced = false;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', applyMobileLayout);
  });
})();
