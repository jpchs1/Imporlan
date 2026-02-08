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

  const API_BASE = "/api";

  let enhanced = false;
  let listings = [];
  let myListings = [];
  let uploadedPhotos = [];
  let isSubmitting = false;
  let detailModalOpen = false;

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
      (item.estado === "Nueva"
        ? '<span style="position:absolute;top:10px;left:10px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;padding:3px 12px;border-radius:20px;font-size:11px;font-weight:700">NUEVA</span>'
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
      '<p style="font-weight:700;color:#2563eb;font-size:18px;margin:0;white-space:nowrap">' +
      formatPrice(item.precio, item.moneda) +
      "</p>" +
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

  function buildPublishModal() {
    return (
      '<div id="mkt-publish-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px;animation:mktFadeIn .2s ease" onclick="if(event.target===this)window.__mktClosePublish()">' +
      '<div style="background:#fff;border-radius:20px;max-width:700px;width:100%;max-height:90vh;overflow-y:auto;position:relative;animation:mktSlideUp .3s ease">' +
      '<div style="padding:24px 24px 0">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
      '<h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0">Publicar Embarcacion</h2>' +
      '<button onclick="window.__mktClosePublish()" style="background:none;border:none;font-size:22px;color:#94a3b8;cursor:pointer;padding:4px">&times;</button>' +
      "</div>" +
      '<p style="color:#64748b;font-size:14px;margin:0 0 20px">Completa los datos de tu embarcacion para publicarla en el marketplace</p>' +
      "</div>" +
      '<form id="mkt-publish-form" style="padding:0 24px 24px" onsubmit="return window.__mktSubmitForm(event)">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">' +
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
      '<div style="display:flex;flex-direction:column;gap:4px">' +
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
      statusBadge +
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
      "</p></div></div>"
    );
  }

  function buildPage() {
    var user = getUserData();
    var initials = user ? userInitials(user.name) : "?";

    var buyCards = "";
    if (listings.length === 0) {
      buyCards =
        '<div style="text-align:center;padding:60px 20px;color:#94a3b8"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;display:block"><path d="M2 20L7 4l5 16 5-16 5 16"/></svg><p style="font-size:16px;margin:0">No hay embarcaciones publicadas aun</p></div>';
    } else {
      buyCards =
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px">';
      listings.forEach(function (item) {
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
      '<button onclick="window.__mktOpenPublish()" style="display:flex;align-items:center;gap:8px;background:linear-gradient(135deg,#2563eb,#0891b2);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s" onmouseover="this.style.opacity=\'0.9\';this.style.transform=\'scale(1.02)\'" onmouseout="this.style.opacity=\'1\';this.style.transform=\'none\'"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>Publicar Embarcacion</button>' +
      "</div>" +
      '<div style="margin-bottom:20px">' +
      '<div style="display:flex;border-bottom:2px solid #e2e8f0;gap:0">' +
      '<button id="mkt-tab-buy" onclick="window.__mktSwitchTab(\'buy\')" style="padding:12px 28px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid #2563eb;color:#2563eb;margin-bottom:-2px;transition:all .2s">Comprar</button>' +
      '<button id="mkt-tab-sell" onclick="window.__mktSwitchTab(\'sell\')" style="padding:12px 28px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;border-bottom:2px solid transparent;color:#64748b;margin-bottom:-2px;transition:all .2s">Mis Publicaciones</button>' +
      "</div></div>" +
      '<div id="mkt-tab-content-buy">' +
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

  window.__mktSubmitForm = async function (e) {
    e.preventDefault();
    if (isSubmitting) return false;
    isSubmitting = true;

    var form = document.getElementById("mkt-publish-form");
    var btn = document.getElementById("mkt-submit-btn");
    var oldText = btn.innerHTML;
    btn.innerHTML = "Publicando...";
    btn.disabled = true;

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
        alert("Embarcacion publicada exitosamente!");
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
    if (enhanced && !force) return;

    var main = document.querySelector("main");
    if (!main) return;

    var contentDiv = main.querySelector(".max-w-7xl") || main.firstElementChild;
    if (!contentDiv) return;

    await Promise.all([loadListings(), loadMyListings()]);

    var existingContent = contentDiv.querySelector(".space-y-6, .animate-fade-in");
    if (existingContent) {
      existingContent.innerHTML = buildPage();
    } else {
      contentDiv.innerHTML = buildPage();
    }
    enhanced = true;
  }

  function addStyles() {
    if (document.getElementById("mkt-enhancer-styles")) return;
    var style = document.createElement("style");
    style.id = "mkt-enhancer-styles";
    style.textContent =
      "@keyframes mktFadeIn{from{opacity:0}to{opacity:1}}" +
      "@keyframes mktSlideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}" +
      ".mkt-card img{transition:transform .4s ease}" +
      "#mkt-detail-overlay::-webkit-scrollbar,#mkt-publish-overlay::-webkit-scrollbar{width:6px}" +
      "#mkt-detail-overlay::-webkit-scrollbar-thumb,#mkt-publish-overlay::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}" +
      "@media(max-width:640px){.mkt-enhanced [style*='grid-template-columns:repeat']{grid-template-columns:1fr!important}}";
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

    setTimeout(function () {
      enhanceMarketplace();
    }, 1500);

    var observer = new MutationObserver(function () {
      if (isMarketplacePage() && !enhanced && !detailModalOpen) {
        setTimeout(function () {
          enhanceMarketplace();
        }, 300);
      }
      if (!isMarketplacePage()) {
        enhanced = false;
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
