/**
 * Documents Section Enhancer - Imporlan User Panel
 * Replaces demo React documents with real data from expediente files,
 * reports, and inspections. Provides interactive viewing/downloading.
 */
(function () {
  "use strict";

  var API_BASE = window.location.pathname.includes("/panel-test") ? "/test/api" : "/api";
  var enhanced = false;

  function getUserEmail() {
    try {
      var raw = localStorage.getItem("imporlan_user");
      if (raw) { var u = JSON.parse(raw); return u.email || u.user_email || ""; }
    } catch (e) {}
    return "";
  }

  // Inject CSS immediately to hide React documents content before it renders
  var hideStyle = document.createElement("style");
  hideStyle.id = "docs-hide-react";
  hideStyle.textContent = "";
  document.head.appendChild(hideStyle);

  function isDocumentsPage() {
    var hashMatch = window.location.hash === "#documentos" || window.location.hash === "#documents";
    if (!hashMatch) {
      var h1 = document.querySelector("main h1");
      hashMatch = h1 && h1.textContent.trim() === "Documentos" && !window.location.hash.match(/#(alerts|inspecciones|marketplace|soporte|payments|messages|dashboard|tracking|deckeva|myproducts|plans|quotation|settings)/);
    }
    // Immediately hide React content when on documents page
    var st = document.getElementById("docs-hide-react");
    if (st) {
      st.textContent = hashMatch
        ? "main > *:not(#docs-enhancer) { display: none !important; }"
        : "";
    }
    return hashMatch;
  }

  function escHtml(t) { if (!t) return ""; var d = document.createElement("div"); d.textContent = t; return d.innerHTML; }

  function formatDate(s) {
    if (!s) return "";
    var m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : s;
  }

  function formatSize(bytes) {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + " MB";
    if (bytes >= 1024) return Math.round(bytes / 1024) + " KB";
    return bytes + " B";
  }

  var catConfig = {
    image: { color: "#8b5cf6", bg: "#f5f3ff", border: "#ddd6fe", label: "Imagen", icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>' },
    video: { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "Video", icon: '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>' },
    document: { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", label: "Documento", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
    report: { color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", label: "Reporte", icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
    inspection: { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", label: "Inspeccion", icon: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>' },
    other: { color: "#64748b", bg: "#f8fafc", border: "#e2e8f0", label: "Archivo", icon: '<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>' }
  };

  async function loadAllDocuments() {
    var email = getUserEmail();
    if (!email) return { files: [], reports: [] };

    var allFiles = [];

    // 1. Fetch expediente files for all user's orders
    try {
      var ordersResp = await fetch(API_BASE + "/orders_api.php?action=user_list&user_email=" + encodeURIComponent(email));
      var ordersData = await ordersResp.json();
      if (ordersData.success && ordersData.orders) {
        for (var i = 0; i < ordersData.orders.length; i++) {
          var order = ordersData.orders[i];
          try {
            var filesResp = await fetch(API_BASE + "/expediente_files_api.php?action=list&order_id=" + order.id);
            var filesData = await filesResp.json();
            if (filesData.success && filesData.files) {
              filesData.files.forEach(function(f) {
                f._source = "expediente";
                f._orderNumber = order.order_number;
                f._orderName = order.plan_name || order.asset_name || order.order_number;
              });
              allFiles = allFiles.concat(filesData.files);
            }
          } catch (e) {}
        }
      }
    } catch (e) { console.error("Error loading orders/files:", e); }

    return { files: allFiles };
  }

  async function enhanceDocuments() {
    if (!isDocumentsPage() || enhanced) return;
    enhanced = true;

    var main = document.querySelector("main");
    if (!main) return;

    // Aggressively hide ALL React content
    Array.from(main.children).forEach(function(ch) {
      if (ch.id !== "docs-enhancer") ch.style.display = "none";
    });

    // Loading state
    var container = document.createElement("div");
    container.id = "docs-enhancer";
    container.innerHTML =
      '<div style="margin-bottom:24px"><h1 style="font-size:28px;font-weight:800;color:#0f172a;margin:0">Documentos</h1>' +
      '<p style="color:#64748b;margin:4px 0 0;font-size:14px">Todos tus archivos, reportes y documentos en un solo lugar</p></div>' +
      '<div style="padding:60px;text-align:center"><div style="width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#0891b2;border-radius:50%;margin:0 auto 16px;animation:docsSpin 1s linear infinite"></div><p style="color:#64748b;font-size:14px">Cargando documentos...</p></div>';
    main.appendChild(container);

    if (!document.getElementById("docs-enhancer-styles")) {
      var st = document.createElement("style");
      st.id = "docs-enhancer-styles";
      st.textContent = "@keyframes docsSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes docsFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}.doc-card{animation:docsFadeIn .3s ease;transition:all .2s}.doc-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)!important}";
      document.head.appendChild(st);
    }

    var data = await loadAllDocuments();
    var allDocs = data.files;

    // Categorize
    var images = allDocs.filter(function(f) { return f.category === "image"; });
    var videos = allDocs.filter(function(f) { return f.category === "video"; });
    var documents = allDocs.filter(function(f) { return f.category === "document"; });
    var others = allDocs.filter(function(f) { return f.category === "other"; });

    // Build HTML
    var html = '';

    // Header
    html += '<div style="margin-bottom:24px"><h1 style="font-size:28px;font-weight:800;color:#0f172a;margin:0">Documentos</h1>' +
      '<p style="color:#64748b;margin:4px 0 0;font-size:14px">Todos tus archivos, reportes y documentos en un solo lugar</p></div>';

    // Stats cards
    html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">';
    var statsData = [
      { label: "Documentos", value: documents.length, cat: "document" },
      { label: "Imagenes", value: images.length, cat: "image" },
      { label: "Videos", value: videos.length, cat: "video" },
      { label: "Total Archivos", value: allDocs.length, cat: "other" }
    ];
    statsData.forEach(function(s) {
      var cfg = catConfig[s.cat];
      html += '<div class="doc-stat-card" data-filter="' + s.cat + '" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;padding:18px 20px;display:flex;align-items:center;gap:14px;cursor:pointer;transition:all .2s;position:relative;overflow:hidden">' +
        '<div style="position:absolute;top:-10px;right:-10px;width:50px;height:50px;background:' + cfg.color + '08;border-radius:50%"></div>' +
        '<div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(135deg,' + cfg.color + ',' + cfg.color + 'cc);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 4px 12px ' + cfg.color + '25"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">' + cfg.icon + '</svg></div>' +
        '<div><p style="margin:0;font-size:28px;font-weight:800;color:#0f172a;line-height:1">' + s.value + '</p>' +
        '<p style="margin:3px 0 0;font-size:12px;color:#64748b;font-weight:500">' + s.label + '</p></div></div>';
    });
    html += '</div>';

    if (allDocs.length === 0) {
      html += '<div style="background:#fff;border-radius:20px;border:1px solid #e2e8f0;overflow:hidden">' +
        '<div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:40px 20px;text-align:center">' +
        '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="1.5" style="margin:0 auto 16px;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>' +
        '<h3 style="font-size:20px;font-weight:700;color:#fff;margin:0 0 8px">Tus documentos apareceran aqui</h3>' +
        '<p style="color:#94a3b8;font-size:14px;margin:0;max-width:400px;display:inline-block;line-height:1.6">Cuando tu agente suba archivos a tu expediente, compres un plan, o recibas un reporte de inspeccion, todos los documentos estaran disponibles aqui para que los revises y descargues.</p></div>' +
        '<div style="padding:24px;display:flex;flex-direction:column;align-items:center;gap:16px">' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;width:100%;max-width:500px">' +
        '<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" style="margin:0 auto 8px;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><p style="margin:0;font-size:12px;font-weight:600;color:#1e293b">PDFs y Docs</p><p style="margin:2px 0 0;font-size:10px;color:#94a3b8">Contratos, reportes</p></div>' +
        '<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" style="margin:0 auto 8px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><p style="margin:0;font-size:12px;font-weight:600;color:#1e293b">Imagenes</p><p style="margin:2px 0 0;font-size:10px;color:#94a3b8">Fotos, capturas</p></div>' +
        '<div style="text-align:center;padding:16px;background:#f8fafc;border-radius:12px;border:1px solid #f1f5f9"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" style="margin:0 auto 8px;display:block"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg><p style="margin:0;font-size:12px;font-weight:600;color:#1e293b">Videos</p><p style="margin:2px 0 0;font-size:10px;color:#94a3b8">Inspecciones</p></div></div>' +
        '<a href="https://wa.me/56940211459?text=Hola, tengo una consulta sobre documentos de mi expediente" target="_blank" style="display:inline-flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;background:#25d366;color:#fff;font-size:14px;font-weight:600;text-decoration:none;box-shadow:0 4px 12px rgba(37,211,102,.3)"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>Consultar por WhatsApp</a></div></div>';
    } else {
      // Search bar
      html += '<div style="display:flex;gap:10px;margin-bottom:16px;align-items:center;flex-wrap:wrap">' +
        '<div style="position:relative;flex:1;min-width:200px;max-width:400px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" style="position:absolute;left:12px;top:50%;transform:translateY(-50%)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
        '<input id="docs-search" placeholder="Buscar documentos..." style="width:100%;padding:10px 14px 10px 38px;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;outline:none;box-sizing:border-box"></div>' +
        '<div style="display:flex;gap:6px" id="docs-filter-btns">' +
        '<button class="docs-filter active" data-filter="all" style="padding:6px 14px;border-radius:8px;border:1px solid #0891b2;background:#ecfeff;color:#0891b2;font-size:12px;font-weight:600;cursor:pointer">Todos</button>' +
        '<button class="docs-filter" data-filter="document" style="padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:12px;font-weight:600;cursor:pointer">Documentos</button>' +
        '<button class="docs-filter" data-filter="image" style="padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:12px;font-weight:600;cursor:pointer">Imagenes</button>' +
        '<button class="docs-filter" data-filter="video" style="padding:6px 14px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;color:#64748b;font-size:12px;font-weight:600;cursor:pointer">Videos</button>' +
        '</div></div>';

      // File cards
      html += '<div id="docs-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">';
      allDocs.forEach(function(f) {
        var cfg = catConfig[f.category] || catConfig.other;
        var isImage = f.category === "image";
        var isVideo = f.category === "video";
        var isPdf = f.mime_type === "application/pdf";

        html += '<div class="doc-card" data-category="' + f.category + '" data-search="' + escHtml((f.original_name + ' ' + (f._orderNumber || '') + ' ' + (f.description || '')).toLowerCase()) + '" style="background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.04)">';

        // Image preview for images
        if (isImage) {
          html += '<div style="height:140px;overflow:hidden;position:relative;cursor:pointer" class="doc-preview" data-url="' + f.download_url + '">' +
            '<img src="' + f.download_url + '" style="width:100%;height:100%;object-fit:cover" loading="lazy">' +
            '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.4),transparent 50%);display:flex;align-items:flex-end;justify-content:center;padding-bottom:10px;opacity:0;transition:opacity .2s" class="doc-hover-overlay"><span style="color:#fff;font-size:12px;font-weight:600;background:rgba(0,0,0,.5);padding:4px 12px;border-radius:6px">Ver imagen</span></div></div>';
        }

        // Card body
        html += '<div style="padding:14px 18px">' +
          '<div style="display:flex;align-items:flex-start;gap:12px">' +
          '<div style="width:40px;height:40px;border-radius:10px;background:' + cfg.bg + ';border:1px solid ' + cfg.border + ';display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + cfg.color + '" stroke-width="2">' + cfg.icon + '</svg></div>' +
          '<div style="flex:1;min-width:0">' +
          '<p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + escHtml(f.original_name) + '">' + escHtml(f.original_name) + '</p>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap">' +
          '<span style="font-size:11px;color:' + cfg.color + ';font-weight:600;background:' + cfg.bg + ';padding:2px 8px;border-radius:4px">' + cfg.label + '</span>' +
          '<span style="font-size:11px;color:#94a3b8">' + (f.file_size_formatted || formatSize(f.file_size || 0)) + '</span>' +
          '<span style="font-size:11px;color:#94a3b8">' + formatDate(f.created_at) + '</span>' +
          '</div>';

        if (f._orderNumber) {
          html += '<p style="margin:4px 0 0;font-size:11px;color:#64748b;display:flex;align-items:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/></svg>' + escHtml(f._orderNumber) + (f._orderName ? ' - ' + escHtml(f._orderName) : '') + '</p>';
        }
        if (f.description) {
          html += '<p style="margin:4px 0 0;font-size:11px;color:#64748b;font-style:italic">' + escHtml(f.description) + '</p>';
        }

        html += '</div></div>';

        // Actions
        html += '<div style="display:flex;gap:6px;margin-top:10px">';
        if (isImage || isPdf || isVideo) {
          html += '<a href="' + f.download_url + '" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px;border-radius:8px;border:1px solid ' + cfg.border + ';background:' + cfg.bg + ';color:' + cfg.color + ';font-size:12px;font-weight:600;text-decoration:none;transition:all .15s"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>Ver</a>';
        }
        html += '<a href="' + f.download_url + '" download style="flex:1;display:flex;align-items:center;justify-content:center;gap:4px;padding:8px;border-radius:8px;background:' + cfg.color + ';color:#fff;font-size:12px;font-weight:600;text-decoration:none;transition:all .15s;box-shadow:0 2px 6px ' + cfg.color + '25"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Descargar</a>';
        html += '</div></div></div>';
      });
      html += '</div>';
    }

    container.innerHTML = html;

    // Bind search and filters
    var searchInput = container.querySelector("#docs-search");
    var filterBtns = container.querySelectorAll(".docs-filter");
    var activeFilter = "all";

    function applyFilters() {
      var q = searchInput ? searchInput.value.toLowerCase().trim() : "";
      var cards = container.querySelectorAll(".doc-card");
      cards.forEach(function(card) {
        var cat = card.getAttribute("data-category");
        var searchText = card.getAttribute("data-search") || "";
        var matchFilter = activeFilter === "all" || cat === activeFilter;
        var matchSearch = !q || searchText.indexOf(q) !== -1;
        card.style.display = (matchFilter && matchSearch) ? "" : "none";
      });
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    filterBtns.forEach(function(btn) {
      btn.addEventListener("click", function() {
        activeFilter = this.getAttribute("data-filter");
        filterBtns.forEach(function(b) {
          b.style.borderColor = "#e2e8f0"; b.style.background = "#fff"; b.style.color = "#64748b";
        });
        this.style.borderColor = "#0891b2"; this.style.background = "#ecfeff"; this.style.color = "#0891b2";
        applyFilters();
      });
    });

    // Image lightbox
    container.querySelectorAll(".doc-preview").forEach(function(el) {
      el.addEventListener("click", function() {
        var url = this.getAttribute("data-url");
        if (!url) return;
        var overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;backdrop-filter:blur(8px)";
        overlay.innerHTML = '<div style="position:relative;max-width:90%;max-height:90%"><img src="' + url + '" style="max-width:100%;max-height:85vh;object-fit:contain;border-radius:16px;box-shadow:0 16px 48px rgba(0,0,0,.5)"><button style="position:absolute;top:-12px;right:-12px;width:36px;height:36px;border-radius:50%;border:none;background:#fff;color:#1e293b;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,.3)">&times;</button></div>';
        overlay.addEventListener("click", function() { overlay.remove(); });
        document.body.appendChild(overlay);
      });
    });

    // Hover overlay for images
    container.querySelectorAll(".doc-card").forEach(function(card) {
      var overlay = card.querySelector(".doc-hover-overlay");
      if (overlay) {
        card.addEventListener("mouseenter", function() { overlay.style.opacity = "1"; });
        card.addEventListener("mouseleave", function() { overlay.style.opacity = "0"; });
      }
    });
  }

  // Monitor for page changes
  var checkInterval = setInterval(function() {
    if (isDocumentsPage()) {
      if (!enhanced) enhanceDocuments();
    } else {
      enhanced = false;
      var existing = document.getElementById("docs-enhancer");
      if (existing) existing.remove();
    }
  }, 500);
})();
