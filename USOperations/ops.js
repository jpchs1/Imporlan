/**
 * Imporlan — US Operations Deal Desk
 * Frontend logic for the US opportunity-boat dashboard.
 *
 * Phase 1 / scripting — B1: state model, storage, formatters, toast.
 *
 * No framework, no build step. Single-page deal desk that persists
 * to localStorage with one-click JSON export/import for sharing
 * with the US crew until the Phase-2 backend lands.
 */
(function () {
  'use strict';

  // ============================================================
  // 1.  CONSTANTS
  // ============================================================
  const STORAGE_KEY = 'imporlan.us_operations.v1';
  const FB_ITEM_ID  = '976023998340848';
  const FB_URL      = 'https://www.facebook.com/marketplace/item/' + FB_ITEM_ID + '/';

  // Pipeline stages — order matters: progress bar = (active index / total).
  const STAGES = [
    { key: 'sourcing',     title: 'Sourcing',     desc: 'Listing identified, US team alerted.' },
    { key: 'negotiation',  title: 'Negotiation',  desc: 'Offers exchanged with the seller.' },
    { key: 'purchase',     title: 'Purchase',     desc: 'Title, bill of sale, payment locked.' },
    { key: 'pickup',       title: 'Pickup',       desc: 'Boat moved to the US yard.' },
    { key: 'refit',        title: 'Refit',        desc: 'Known issue fixed, sea-trial prep.' },
    { key: 'sale',         title: 'Sale',         desc: 'Listed and sold for profit.' }
  ];

  // Default checklists per stage (loaded once on first visit).
  const DEFAULT_PURCHASE_CHECKLIST = [
    'Independent mechanical inspection of known issue',
    'Verify hull HIN matches title document',
    'Verify trailer VIN matches title (if trailer included)',
    'Confirm seller is the registered owner (ID + title)',
    'Lien release on file (if applicable)',
    'Bill of sale drafted and signed by both parties',
    'Title signed over to buyer / Imporlan',
    'Funds released only after title + boat in hand',
    'Photos of boat, trailer and paperwork archived'
  ];

  const DEFAULT_PICKUP_CHECKLIST = [
    'Trailer lights tested and working',
    'Tires inflated, spare on board',
    'Coupler / safety chains verified',
    'Drain plug installed (no water in bilge)',
    'Engine secured / lower unit raised',
    'Loose gear strapped down or removed',
    'Pickup paperwork (bill of sale + title copy) on driver',
    'Route + fuel stops planned'
  ];

  const DEFAULT_SALE_CHECKLIST = [
    'High-quality photos taken (exterior, interior, helm, engine, trailer)',
    'Engine hours documented + service receipts attached',
    'Listing copy mentions known-issue fix + warranty (if any)',
    'Listed on chosen channels at target price',
    'Sea-trial protocol prepared for serious buyers',
    'Bill of sale template ready for closing',
    'Title prepared for transfer to buyer'
  ];

  // ============================================================
  // 2.  DEFAULT STATE
  // ============================================================
  function defaultState() {
    return {
      version: 1,
      updatedAt: null,
      dealNumber: 'US-2026-001',
      dealStatus: 'Sourcing',

      // Hero / target vessel (contenteditable fields)
      makeModel:    'TBD — confirm with seller',
      year:         'TBD',
      length:       'TBD ft',
      engine:       'TBD',
      hours:        'TBD',
      locationUS:   'TBD',
      trailer:      'TBD',
      titleStatus:  'TBD',
      knownIssue:   'Describe the known fault that is driving the price down. Add diagnostic notes from the US collaborator once the boat has been inspected in person.',
      vesselPhoto:  null,   // dataURL string

      // Pipeline progress
      pipelineIndex: 0,     // 0 = sourcing active, 1 = negotiation active, ...
                            // when index == STAGES.length, deal is fully done.

      // Negotiation
      askingPrice:    0,
      walkAwayPrice:  0,
      targetPrice:    0,
      openingOffer:   0,
      offers: [],           // { id, date, side: 'us'|'seller', amount, note }

      // Purchase
      agreedPrice:    0,
      depositAmount:  0,
      paymentMethod:  '',
      closingDate:    '',
      titleNotes:     '',
      purchaseCheck:  defaultChecklist(DEFAULT_PURCHASE_CHECKLIST),

      // Pickup
      pickupFrom:     '',
      pickupTo:       '',
      pickupDate:     '',
      pickupDistance: 0,
      transportMode:  '',
      transportCost:  0,
      fuelCost:       0,
      storageMonthly: 0,
      pickupCheck:    defaultChecklist(DEFAULT_PICKUP_CHECKLIST),

      // Refit
      refit: [],            // { id, item, category, parts, labor, status }

      // Sale
      listPrice:      0,
      minAcceptable:  0,
      saleChannels:   '',
      saleDescription:'',
      saleCheck:      defaultChecklist(DEFAULT_SALE_CHECKLIST),
      inquiries: [],        // { id, date, name, amount, note }
      sellingFees:    0,

      // Team
      team: []              // { id, name, role, contact, location }
    };
  }

  function defaultChecklist(items) {
    return items.map(label => ({ id: uid(), label, done: false }));
  }

  // ============================================================
  // 3.  UTILITIES
  // ============================================================
  function uid() {
    return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function toNum(v) {
    if (v === null || v === undefined || v === '') return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  const fmtUSD = new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  });
  function money(n) {
    return fmtUSD.format(toNum(n));
  }

  function pct(n, digits) {
    digits = digits == null ? 1 : digits;
    if (!Number.isFinite(n)) return '0%';
    return n.toFixed(digits).replace(/\.0$/, '') + '%';
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // Deep merge that preserves new-default keys when older saved state is loaded.
  function mergeDefaults(target, source) {
    const out = Array.isArray(target) ? target.slice() : { ...target };
    Object.keys(source).forEach(k => {
      if (!(k in out) || out[k] === undefined || out[k] === null) {
        out[k] = source[k];
      } else if (typeof out[k] === 'object' && !Array.isArray(out[k]) && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        out[k] = mergeDefaults(out[k], source[k]);
      }
    });
    return out;
  }

  // ============================================================
  // 4.  STORAGE
  // ============================================================
  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultState();
        const parsed = JSON.parse(raw);
        return mergeDefaults(parsed, defaultState());
      } catch (err) {
        console.warn('[us-ops] storage load failed:', err);
        return defaultState();
      }
    },
    save(state) {
      try {
        state.updatedAt = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch (err) {
        console.warn('[us-ops] storage save failed:', err);
        return false;
      }
    },
    clear() {
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
    }
  };

  // ============================================================
  // 5.  TOAST + STATUS PILL
  // ============================================================
  let toastTimer = null;
  function toast(message, variant) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.className = 'ops-toast is-visible' + (variant ? ' is-' + variant : '');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('is-visible');
    }, 2200);
  }

  function setStatus(label, variant) {
    const pill  = document.getElementById('statusPill');
    const lab   = document.getElementById('statusLabel');
    if (!pill || !lab) return;
    pill.classList.remove('is-saving', 'is-error');
    if (variant) pill.classList.add('is-' + variant);
    lab.textContent = label;
  }

  // ============================================================
  // 6.  EXPOSE TO LATER MICRO-PHASES
  // ============================================================
  // Phase B2..B5 attach their renderers/handlers to this module.
  window.__usOps = {
    STORAGE_KEY,
    FB_ITEM_ID,
    FB_URL,
    STAGES,
    DEFAULT_PURCHASE_CHECKLIST,
    DEFAULT_PICKUP_CHECKLIST,
    DEFAULT_SALE_CHECKLIST,
    defaultState,
    defaultChecklist,
    uid,
    clamp,
    toNum,
    money,
    pct,
    todayISO,
    mergeDefaults,
    Storage,
    toast,
    setStatus,
    state: Storage.load()
  };

  // Show last-saved status if present, otherwise live.
  // Also honor ?deal=US-XXX query param so the same dashboard can host
  // any deal — the sync.js layer will pull the matching record.
  document.addEventListener('DOMContentLoaded', function () {
    const s = window.__usOps.state;
    try {
      const q = new URL(window.location.href).searchParams.get('deal');
      if (q && q.trim()) s.dealNumber = q.trim();
    } catch (e) { /* ignore */ }
    const dnEl = document.querySelector('[data-field="dealNumber"]');
    if (dnEl) dnEl.textContent = s.dealNumber;

    if (s.updatedAt) {
      const when = new Date(s.updatedAt);
      setStatus('Saved ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setStatus('Live');
    }
  });
})();

/* ============================================================
   PHASE B2 — DOM bindings, KPI computation, contenteditable hero
   ============================================================ */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // ----------------------------------------------------------
  //  Persist helper — debounce writes so quick typing isn't
  //  thrashing localStorage.
  // ----------------------------------------------------------
  let saveTimer = null;
  function persist(reason) {
    if (saveTimer) clearTimeout(saveTimer);
    Ops.setStatus('Saving…', 'saving');
    saveTimer = setTimeout(function () {
      const ok = Ops.Storage.save(Ops.state);
      const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      Ops.setStatus(ok ? 'Saved ' + stamp : 'Save failed', ok ? null : 'error');
      if (reason && reason.toast) Ops.toast(reason.toast, reason.variant || 'success');
    }, 220);
  }
  Ops.persist = persist;

  // Notify other panels when state changes so they can re-render.
  function broadcast() {
    document.dispatchEvent(new CustomEvent('usops:state', { detail: Ops.state }));
  }
  Ops.broadcast = broadcast;

  // ----------------------------------------------------------
  //  HERO — contenteditable text fields (data-field="...")
  // ----------------------------------------------------------
  function bindEditables() {
    const nodes = document.querySelectorAll('[contenteditable="true"][data-field]');
    nodes.forEach(node => {
      const key = node.getAttribute('data-field');
      // Initial paint from state.
      if (Ops.state[key] != null) node.textContent = Ops.state[key];

      node.addEventListener('blur', function () {
        const val = node.textContent.replace(/\s+/g, ' ').trim();
        if (Ops.state[key] !== val) {
          Ops.state[key] = val;
          persist();
          broadcast();
        }
      });
      // Disable line breaks in single-line fields.
      if (key !== 'knownIssue') {
        node.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); node.blur(); }
        });
      }
    });

    // Special-case readouts (non-editable spans inside the eyebrow).
    const dealNumberEl = document.querySelector('[data-field="dealNumber"]');
    const dealStatusEl = document.querySelector('[data-field="dealStatus"]');
    if (dealNumberEl) dealNumberEl.textContent = Ops.state.dealNumber;
    if (dealStatusEl) dealStatusEl.textContent = Ops.state.dealStatus;
  }

  // ----------------------------------------------------------
  //  Number / text inputs — bind by element id ↔ state key.
  // ----------------------------------------------------------
  const SCALAR_BINDINGS = [
    // negotiation
    { id: 'askingPrice',     key: 'askingPrice',     type: 'number' },
    { id: 'walkAwayPrice',   key: 'walkAwayPrice',   type: 'number' },
    { id: 'targetPrice',     key: 'targetPrice',     type: 'number' },
    { id: 'openingOffer',    key: 'openingOffer',    type: 'number' },
    // purchase
    { id: 'agreedPrice',     key: 'agreedPrice',     type: 'number' },
    { id: 'depositAmount',   key: 'depositAmount',   type: 'number' },
    { id: 'paymentMethod',   key: 'paymentMethod',   type: 'text'   },
    { id: 'closingDate',     key: 'closingDate',     type: 'text'   },
    { id: 'titleNotes',      key: 'titleNotes',      type: 'text'   },
    // pickup
    { id: 'pickupFrom',      key: 'pickupFrom',      type: 'text'   },
    { id: 'pickupTo',        key: 'pickupTo',        type: 'text'   },
    { id: 'pickupDate',      key: 'pickupDate',      type: 'text'   },
    { id: 'pickupDistance',  key: 'pickupDistance',  type: 'number' },
    { id: 'transportMode',   key: 'transportMode',   type: 'text'   },
    { id: 'transportCost',   key: 'transportCost',   type: 'number' },
    { id: 'fuelCost',        key: 'fuelCost',        type: 'number' },
    { id: 'storageMonthly',  key: 'storageMonthly',  type: 'number' },
    // sale
    { id: 'listPrice',       key: 'listPrice',       type: 'number' },
    { id: 'minAcceptable',   key: 'minAcceptable',   type: 'number' },
    { id: 'saleChannels',    key: 'saleChannels',    type: 'text'   },
    { id: 'saleDescription', key: 'saleDescription', type: 'text'   },
    { id: 'sellingFees',     key: 'sellingFees',     type: 'number' }
  ];

  function bindScalars() {
    SCALAR_BINDINGS.forEach(b => {
      const el = document.getElementById(b.id);
      if (!el) return;

      // Paint from state.
      const val = Ops.state[b.key];
      if (val !== null && val !== undefined && val !== '') {
        el.value = val;
      }

      el.addEventListener('input', function () {
        const v = b.type === 'number' ? Ops.toNum(el.value) : el.value;
        if (Ops.state[b.key] !== v) {
          Ops.state[b.key] = v;
          persist();
          broadcast();
        }
      });
    });
  }

  // ----------------------------------------------------------
  //  KPI strip — Asking / Target / All-In / Resale / Profit + margin
  // ----------------------------------------------------------
  function refitTotal() {
    return (Ops.state.refit || []).reduce((sum, r) => sum + Ops.toNum(r.parts) + Ops.toNum(r.labor), 0);
  }
  Ops.refitTotal = refitTotal;

  function pickupTotal() {
    return Ops.toNum(Ops.state.transportCost) + Ops.toNum(Ops.state.fuelCost) + Ops.toNum(Ops.state.storageMonthly);
  }
  Ops.pickupTotal = pickupTotal;

  function buyPriceUsed() {
    // Prefer agreed price if locked, else target buy, else asking.
    return Ops.toNum(Ops.state.agreedPrice) || Ops.toNum(Ops.state.targetPrice) || Ops.toNum(Ops.state.askingPrice);
  }
  Ops.buyPriceUsed = buyPriceUsed;

  function allInCost() {
    return buyPriceUsed() + pickupTotal() + refitTotal();
  }
  Ops.allInCost = allInCost;

  function netRevenue() {
    return Ops.toNum(Ops.state.listPrice) - Ops.toNum(Ops.state.sellingFees);
  }
  Ops.netRevenue = netRevenue;

  function projectedProfit() {
    return netRevenue() - allInCost();
  }
  Ops.projectedProfit = projectedProfit;

  function projectedMargin() {
    const rev = Ops.toNum(Ops.state.listPrice);
    if (rev <= 0) return 0;
    return (projectedProfit() / rev) * 100;
  }
  Ops.projectedMargin = projectedMargin;

  function paintKPIs() {
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setText('kpiAsking', Ops.money(Ops.state.askingPrice));
    setText('kpiTarget', Ops.money(Ops.state.targetPrice || Ops.state.openingOffer));
    setText('kpiAllIn',  Ops.money(allInCost()));
    setText('kpiResale', Ops.money(Ops.state.listPrice));

    const profit = projectedProfit();
    const margin = projectedMargin();
    setText('kpiProfit', Ops.money(profit));
    setText('kpiMargin', Ops.pct(margin) + ' margin');

    // Toggle loss color on the profit card.
    const profitCard = document.querySelector('.ops-kpi-profit');
    if (profitCard) profitCard.classList.toggle('is-loss', profit < 0);
  }
  Ops.paintKPIs = paintKPIs;

  // Hero CTA — make the FB Marketplace link live.
  function paintHeroLink() {
    const a = document.getElementById('heroMarketplaceLink');
    if (a && !a.href) a.href = Ops.FB_URL;
    if (a) a.href = Ops.FB_URL;
  }

  // ----------------------------------------------------------
  //  Boot — wait for DOM, then bind & paint.
  // ----------------------------------------------------------
  function boot() {
    bindEditables();
    bindScalars();
    paintHeroLink();
    paintKPIs();

    // Re-paint KPIs whenever state changes (other modules emit usops:state).
    document.addEventListener('usops:state', paintKPIs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   PHASE B3 — Pipeline render, advance/undo, vessel photo upload
   ============================================================ */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // ----------------------------------------------------------
  //  PIPELINE
  // ----------------------------------------------------------
  function progressPct() {
    const total = Ops.STAGES.length;
    return Math.round((Ops.state.pipelineIndex / total) * 100);
  }

  function currentStageName() {
    const i = Ops.state.pipelineIndex;
    if (i >= Ops.STAGES.length) return 'Sold';
    return Ops.STAGES[i].title;
  }

  function paintPipeline() {
    const list = document.getElementById('pipelineList');
    const fill = document.getElementById('pipelineFill');
    const lab  = document.getElementById('pipelinePct');
    if (!list) return;

    list.innerHTML = '';
    Ops.STAGES.forEach((stage, idx) => {
      let stateAttr = 'todo';
      if (idx < Ops.state.pipelineIndex) stateAttr = 'done';
      else if (idx === Ops.state.pipelineIndex) stateAttr = 'active';

      const li = document.createElement('li');
      li.className = 'ops-pipeline-stage';
      li.setAttribute('data-state', stateAttr);
      li.setAttribute('data-stage', stage.key);

      const statusLabel = stateAttr === 'done'
        ? 'Completed'
        : stateAttr === 'active' ? 'In progress' : 'Up next';

      // Buttons available only for the active stage.
      const actions = stateAttr === 'active'
        ? '<div class="ops-pipeline-stage-actions">'
            + (Ops.state.pipelineIndex > 0
                ? '<button class="ops-pipeline-stage-btn" data-action="undo">↶ Back</button>' : '')
            + '<button class="ops-pipeline-stage-btn" data-action="advance">'
              + (idx === Ops.STAGES.length - 1 ? 'Mark sold ✓' : 'Advance →')
            + '</button>'
          + '</div>'
        : '';

      li.innerHTML =
        '<div class="ops-pipeline-stage-num">' + (idx + 1) + '</div>' +
        '<div class="ops-pipeline-stage-title">' + stage.title + '</div>' +
        '<div class="ops-pipeline-stage-desc">' + stage.desc + '</div>' +
        '<div class="ops-pipeline-stage-status">' + statusLabel + '</div>' +
        actions;

      // Click on stage body → jump to section.
      li.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        const target = stage.key === 'sourcing' ? 'target' : stage.key;
        const section = document.getElementById(target);
        if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      list.appendChild(li);
    });

    // Wire advance / undo buttons.
    list.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        if (action === 'advance' && Ops.state.pipelineIndex < Ops.STAGES.length) {
          Ops.state.pipelineIndex += 1;
          afterAdvance();
        } else if (action === 'undo' && Ops.state.pipelineIndex > 0) {
          Ops.state.pipelineIndex -= 1;
          afterAdvance(true);
        }
      });
    });

    if (fill) fill.style.width = progressPct() + '%';
    if (lab)  lab.textContent  = progressPct();

    // Sync deal status pill in eyebrow.
    Ops.state.dealStatus = currentStageName();
    const statusEl = document.querySelector('[data-field="dealStatus"]');
    if (statusEl) statusEl.textContent = Ops.state.dealStatus;
  }
  Ops.paintPipeline = paintPipeline;

  function afterAdvance(undo) {
    Ops.persist();
    Ops.broadcast();
    paintPipeline();
    Ops.toast(undo ? 'Stage rolled back.' : 'Stage advanced — keep moving.', 'success');
  }

  // ----------------------------------------------------------
  //  VESSEL PHOTO UPLOAD
  // ----------------------------------------------------------
  function paintVesselPhoto() {
    const wrap = document.getElementById('vesselImageWrap');
    const ph   = document.getElementById('vesselImagePlaceholder');
    const img  = document.getElementById('vesselImage');
    if (!wrap || !img) return;

    if (Ops.state.vesselPhoto) {
      img.src = Ops.state.vesselPhoto;
      img.hidden = false;
      if (ph) ph.style.display = 'none';
    } else {
      img.removeAttribute('src');
      img.hidden = true;
      if (ph) ph.style.display = '';
    }
  }
  Ops.paintVesselPhoto = paintVesselPhoto;

  function bindVesselUpload() {
    const input = document.getElementById('vesselImageInput');
    if (!input) return;
    input.addEventListener('change', function () {
      const file = input.files && input.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        Ops.toast('Please choose an image file.', 'error');
        return;
      }
      // Cap at ~3MB to keep localStorage healthy.
      if (file.size > 3 * 1024 * 1024) {
        Ops.toast('Image too large (max 3MB). Resize before uploading.', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function () {
        Ops.state.vesselPhoto = reader.result;
        Ops.persist({ toast: 'Vessel photo updated.', variant: 'success' });
        Ops.broadcast();
        paintVesselPhoto();
      };
      reader.onerror = function () { Ops.toast('Could not read that image.', 'error'); };
      reader.readAsDataURL(file);
      input.value = '';
    });
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  function boot() {
    paintPipeline();
    paintVesselPhoto();
    bindVesselUpload();
    document.addEventListener('usops:state', function () {
      // Pipeline doesn't depend on every state field, so only repaint
      // when the pipelineIndex moved (cheap guard to avoid flicker).
      // Other modules can call paintPipeline() explicitly if needed.
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   PHASE B4 — Offer log, inquiry log, refit table, checklists, team
   ============================================================ */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // Tiny helper for safe text rendering.
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  Ops.esc = esc;

  // Trash icon (re-used by every list).
  const TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>';

  // ----------------------------------------------------------
  //  OFFER LOG
  // ----------------------------------------------------------
  function paintOffers() {
    const list = document.getElementById('offerList');
    if (!list) return;
    const offers = (Ops.state.offers || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = '';
    offers.forEach(o => {
      const li = document.createElement('li');
      const sideClass = o.side === 'us' ? 'is-us' : 'is-seller';
      const sideLabel = o.side === 'us' ? 'Our offer' : 'Seller counter';
      li.innerHTML =
        '<span class="ops-offer-date">' + esc(o.date) + '</span>' +
        '<span class="ops-offer-side ' + sideClass + '">' + sideLabel + '</span>' +
        '<span class="ops-offer-amount">' + Ops.money(o.amount) + '</span>' +
        '<button class="ops-offer-del" aria-label="Delete entry" data-id="' + esc(o.id) + '">' + TRASH + '</button>' +
        (o.note ? '<span class="ops-offer-note">' + esc(o.note) + '</span>' : '');
      list.appendChild(li);
    });

    list.querySelectorAll('.ops-offer-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        Ops.state.offers = Ops.state.offers.filter(x => x.id !== id);
        Ops.persist({ toast: 'Offer removed.' });
        Ops.broadcast();
        paintOffers();
      });
    });
  }
  Ops.paintOffers = paintOffers;

  function bindOfferForm() {
    const form = document.getElementById('offerForm');
    if (!form) return;
    const dateInp = document.getElementById('offerDate');
    if (dateInp && !dateInp.value) dateInp.value = Ops.todayISO();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const offer = {
        id: Ops.uid(),
        date: dateInp.value || Ops.todayISO(),
        side: document.getElementById('offerSide').value,
        amount: Ops.toNum(document.getElementById('offerAmount').value),
        note: document.getElementById('offerNote').value.trim()
      };
      Ops.state.offers = (Ops.state.offers || []).concat(offer);
      // Auto-advance pipeline to Negotiation if we're still in Sourcing.
      if (Ops.state.pipelineIndex < 1) {
        Ops.state.pipelineIndex = 1;
        if (Ops.paintPipeline) Ops.paintPipeline();
      }
      Ops.persist({ toast: 'Offer logged.' });
      Ops.broadcast();
      paintOffers();
      form.reset();
      if (dateInp) dateInp.value = Ops.todayISO();
    });
  }

  // ----------------------------------------------------------
  //  INQUIRY LOG (resale buyer interest)
  // ----------------------------------------------------------
  function paintInquiries() {
    const list = document.getElementById('inquiryList');
    if (!list) return;
    const items = (Ops.state.inquiries || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    list.innerHTML = '';
    items.forEach(q => {
      const li = document.createElement('li');
      li.innerHTML =
        '<span class="ops-offer-date">' + esc(q.date) + '</span>' +
        '<span class="ops-offer-side is-us">' + esc(q.name || '—') + '</span>' +
        '<span class="ops-offer-amount">' + (q.amount ? Ops.money(q.amount) : '—') + '</span>' +
        '<button class="ops-offer-del" aria-label="Delete inquiry" data-id="' + esc(q.id) + '">' + TRASH + '</button>' +
        (q.note ? '<span class="ops-offer-note">' + esc(q.note) + '</span>' : '');
      list.appendChild(li);
    });

    list.querySelectorAll('.ops-offer-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        Ops.state.inquiries = Ops.state.inquiries.filter(x => x.id !== id);
        Ops.persist({ toast: 'Inquiry removed.' });
        Ops.broadcast();
        paintInquiries();
      });
    });
  }
  Ops.paintInquiries = paintInquiries;

  function bindInquiryForm() {
    const form = document.getElementById('inquiryForm');
    if (!form) return;
    const dateInp = document.getElementById('inquiryDate');
    if (dateInp && !dateInp.value) dateInp.value = Ops.todayISO();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const item = {
        id: Ops.uid(),
        date: dateInp.value || Ops.todayISO(),
        name: document.getElementById('inquiryName').value.trim(),
        amount: Ops.toNum(document.getElementById('inquiryAmount').value),
        note: document.getElementById('inquiryNote').value.trim()
      };
      Ops.state.inquiries = (Ops.state.inquiries || []).concat(item);
      Ops.persist({ toast: 'Inquiry logged.' });
      Ops.broadcast();
      paintInquiries();
      form.reset();
      if (dateInp) dateInp.value = Ops.todayISO();
    });
  }

  // ----------------------------------------------------------
  //  REFIT TABLE
  // ----------------------------------------------------------
  function paintRefit() {
    const tbody = document.getElementById('refitTableBody');
    if (!tbody) return;
    const rows = Ops.state.refit || [];

    if (rows.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--text-dim);font-style:italic;">No refit items yet — add the first one above.</td></tr>';
    } else {
      tbody.innerHTML = '';
      rows.forEach(r => {
        const tr = document.createElement('tr');
        const total = Ops.toNum(r.parts) + Ops.toNum(r.labor);
        tr.innerHTML =
          '<td>' + esc(r.item) + '</td>' +
          '<td>' + esc(r.category) + '</td>' +
          '<td class="ops-num">' + Ops.money(r.parts) + '</td>' +
          '<td class="ops-num">' + Ops.money(r.labor) + '</td>' +
          '<td class="ops-num">' + Ops.money(total) + '</td>' +
          '<td><span class="ops-refit-status" data-status="' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
          '<td><button class="ops-refit-del" aria-label="Delete row" data-id="' + esc(r.id) + '">' + TRASH + '</button></td>';
        tbody.appendChild(tr);
      });
    }

    // Totals chip in section head.
    const partsTotal = rows.reduce((s, r) => s + Ops.toNum(r.parts), 0);
    const laborTotal = rows.reduce((s, r) => s + Ops.toNum(r.labor), 0);
    const grand = partsTotal + laborTotal;
    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('partsTotal', Ops.money(partsTotal));
    setText('laborTotal', Ops.money(laborTotal));
    setText('refitTotal', Ops.money(grand));

    tbody.querySelectorAll('.ops-refit-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        Ops.state.refit = Ops.state.refit.filter(x => x.id !== id);
        Ops.persist({ toast: 'Refit item removed.' });
        Ops.broadcast();
        paintRefit();
      });
    });
  }
  Ops.paintRefit = paintRefit;

  function bindRefitForm() {
    const form = document.getElementById('refitForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const row = {
        id: Ops.uid(),
        item:     document.getElementById('refitItem').value.trim(),
        category: document.getElementById('refitCategory').value,
        parts:    Ops.toNum(document.getElementById('refitParts').value),
        labor:    Ops.toNum(document.getElementById('refitLabor').value),
        status:   document.getElementById('refitStatus').value
      };
      if (!row.item) { Ops.toast('Describe the work item first.', 'error'); return; }
      Ops.state.refit = (Ops.state.refit || []).concat(row);
      Ops.persist({ toast: 'Refit item added.' });
      Ops.broadcast();
      paintRefit();
      form.reset();
    });
  }

  // ----------------------------------------------------------
  //  CHECKLISTS  (purchase / pickup / sale)
  // ----------------------------------------------------------
  const CHECKLIST_BINDINGS = [
    { containerId: 'purchaseChecklist', stateKey: 'purchaseCheck' },
    { containerId: 'pickupChecklist',   stateKey: 'pickupCheck'   },
    { containerId: 'saleChecklist',     stateKey: 'saleCheck'     }
  ];

  function paintChecklists() {
    CHECKLIST_BINDINGS.forEach(b => {
      const root = document.getElementById(b.containerId);
      if (!root) return;
      const items = Ops.state[b.stateKey] || [];
      root.innerHTML = '';
      items.forEach(it => {
        const li = document.createElement('li');
        li.className = it.done ? 'is-done' : '';
        const checkboxId = 'chk_' + it.id;
        li.innerHTML =
          '<input type="checkbox" id="' + esc(checkboxId) + '" data-id="' + esc(it.id) + '"' + (it.done ? ' checked' : '') + ' />' +
          '<label for="' + esc(checkboxId) + '">' + esc(it.label) + '</label>';
        root.appendChild(li);
      });

      root.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function () {
          const id = cb.getAttribute('data-id');
          const arr = Ops.state[b.stateKey];
          const item = arr && arr.find(x => x.id === id);
          if (item) {
            item.done = cb.checked;
            cb.closest('li').classList.toggle('is-done', cb.checked);
            Ops.persist();
            Ops.broadcast();
          }
        });
      });
    });
  }
  Ops.paintChecklists = paintChecklists;

  // ----------------------------------------------------------
  //  TEAM (US collaborators)
  // ----------------------------------------------------------
  function initials(name) {
    return String(name || '?')
      .split(/\s+/).filter(Boolean).slice(0, 2)
      .map(p => p[0]).join('').toUpperCase() || '?';
  }

  function paintTeam() {
    const grid = document.getElementById('teamGrid');
    if (!grid) return;
    const rows = Ops.state.team || [];
    grid.innerHTML = '';
    rows.forEach(t => {
      const card = document.createElement('div');
      card.className = 'ops-team-card';
      card.innerHTML =
        '<div class="ops-team-card-top">' +
          '<div class="ops-team-avatar">' + esc(initials(t.name)) + '</div>' +
          '<div>' +
            '<div class="ops-team-name">' + esc(t.name) + '</div>' +
            '<div class="ops-team-role">' + esc(t.role) + '</div>' +
          '</div>' +
        '</div>' +
        (t.contact || t.location
          ? '<div class="ops-team-meta">' + [t.contact, t.location].filter(Boolean).map(esc).join(' · ') + '</div>'
          : '') +
        '<button class="ops-team-del" aria-label="Remove" data-id="' + esc(t.id) + '">' + TRASH + '</button>';
      grid.appendChild(card);
    });

    grid.querySelectorAll('.ops-team-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        Ops.state.team = Ops.state.team.filter(x => x.id !== id);
        Ops.persist({ toast: 'Collaborator removed.' });
        Ops.broadcast();
        paintTeam();
      });
    });
  }
  Ops.paintTeam = paintTeam;

  function bindTeamForm() {
    const form = document.getElementById('teamForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const row = {
        id: Ops.uid(),
        name:     document.getElementById('teamName').value.trim(),
        role:     document.getElementById('teamRole').value.trim(),
        contact:  document.getElementById('teamContact').value.trim(),
        location: document.getElementById('teamLocation').value.trim()
      };
      if (!row.name || !row.role) { Ops.toast('Name and role are required.', 'error'); return; }
      Ops.state.team = (Ops.state.team || []).concat(row);
      Ops.persist({ toast: 'Collaborator added.' });
      Ops.broadcast();
      paintTeam();
      form.reset();
    });
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  function boot() {
    paintOffers();
    paintInquiries();
    paintRefit();
    paintChecklists();
    paintTeam();

    bindOfferForm();
    bindInquiryForm();
    bindRefitForm();
    bindTeamForm();

    document.addEventListener('usops:state', function () {
      // The refit table feeds into KPIs; repaint totals chip on every change.
      paintRefit();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

/* ============================================================
   PHASE B5 — P&L roll-up, export/import/reset, header wire-up
   ============================================================ */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // ----------------------------------------------------------
  //  P&L
  // ----------------------------------------------------------
  function paintPnL() {
    const buy     = Ops.buyPriceUsed();
    const tax     = 0; // hook for future "sales tax / fees" line
    const pickup  = Ops.pickupTotal();
    const refit   = Ops.refitTotal();
    const allIn   = buy + tax + pickup + refit;
    const sale    = Ops.toNum(Ops.state.listPrice);
    const fees    = Ops.toNum(Ops.state.sellingFees);
    const netRev  = sale - fees;
    const profit  = netRev - allIn;
    const margin  = sale > 0 ? (profit / sale) * 100 : 0;

    // Cost stack (left column)
    const costs = document.getElementById('pnlCosts');
    if (costs) {
      costs.innerHTML =
        '<li><span>Final / target buy price</span><strong>' + Ops.money(buy)    + '</strong></li>' +
        '<li><span>Pickup &amp; transport</span>'           + '<strong>' + Ops.money(pickup) + '</strong></li>' +
        '<li><span>Refit (parts + labor)</span>'            + '<strong>' + Ops.money(refit)  + '</strong></li>';
    }

    const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setText('pnlAllIn',       Ops.money(allIn));
    setText('pnlSale',        Ops.money(sale));
    setText('pnlNetRev',      Ops.money(netRev));
    setText('pnlProfitBig',   (profit < 0 ? '-' : '') + Ops.money(Math.abs(profit)).replace('-', ''));
    setText('pnlMarginBig',   Ops.pct(margin));

    // Margin bar (cap at 100%, clamp to 0 when loss).
    const bar = document.getElementById('pnlMarginBar');
    if (bar) bar.style.width = Math.max(0, Math.min(100, margin)) + '%';

    // Outcome panel state.
    const out = document.querySelector('.ops-pnl-col-outcome');
    if (out) out.classList.toggle('is-loss', profit < 0);

    // Hint copy.
    const hint = document.getElementById('pnlHint');
    if (hint) {
      if (sale === 0) {
        hint.textContent = 'Set a list price in the Sale section to see the projected outcome.';
      } else if (profit < 0) {
        hint.textContent = 'You are projected to lose money at this list price. Re-negotiate the buy or trim the refit.';
      } else if (margin < 10) {
        hint.textContent = 'Margin under 10%. Push the list price up or look for a cheaper buy before pulling the trigger.';
      } else if (margin < 25) {
        hint.textContent = 'Healthy margin. Aim to sell within 60 days of listing to protect it.';
      } else {
        hint.textContent = 'Strong margin. Move fast and lock the buy.';
      }
    }
  }
  Ops.paintPnL = paintPnL;

  // ----------------------------------------------------------
  //  EXPORT / IMPORT / RESET
  // ----------------------------------------------------------
  function exportJSON() {
    const data = JSON.stringify(Ops.state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const dn   = (Ops.state.dealNumber || 'deal').replace(/[^A-Za-z0-9_-]+/g, '_');
    a.href = url;
    a.download = 'imporlan-us-ops-' + dn + '-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
    Ops.toast('Deal exported.', 'success');
  }

  function importJSON(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function () {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid file');
        const merged = Ops.mergeDefaults(parsed, Ops.defaultState());
        Ops.state = merged;
        Ops.Storage.save(Ops.state);
        Ops.toast('Deal imported. Reloading…', 'success');
        setTimeout(() => location.reload(), 600);
      } catch (err) {
        console.warn('[us-ops] import failed:', err);
        Ops.toast('Could not parse that JSON.', 'error');
      }
    };
    reader.onerror = function () { Ops.toast('Could not read the file.', 'error'); };
    reader.readAsText(file);
  }

  function resetAll() {
    const ok = window.confirm('Reset the entire deal desk? This wipes all locally saved data.');
    if (!ok) return;
    Ops.Storage.clear();
    Ops.toast('Deal desk reset.', 'success');
    setTimeout(() => location.reload(), 500);
  }

  // ----------------------------------------------------------
  //  Build a deep link to this deal and copy it to the clipboard
  //  so the operator can paste it into WhatsApp / Slack / email
  //  to a US collaborator. The link auto-loads the right deal via
  //  the ?deal= query param (handled by ops.js + sync.js).
  // ----------------------------------------------------------
  function shareDealLink() {
    const dn = Ops.state.dealNumber || 'US-2026-001';
    const url = location.origin + location.pathname.replace(/\/?$/, '/') + '?deal=' + encodeURIComponent(dn);

    const fallback = function () {
      // Fallback for older browsers or non-secure contexts.
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* noop */ }
      document.body.removeChild(ta);
    };

    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      navigator.clipboard.writeText(url).then(
        () => Ops.toast('Link copied — share with the US team. (' + dn + ')', 'success'),
        () => { fallback(); Ops.toast('Link copied (fallback). (' + dn + ')', 'success'); }
      );
    } else {
      fallback();
      Ops.toast('Link copied. Paste it to the team. (' + dn + ')', 'success');
    }
  }

  // ----------------------------------------------------------
  //  HEADER WIRE-UP + ACTIVE NAV LINK
  // ----------------------------------------------------------
  function bindHeader() {
    const btnExport = document.getElementById('btnExport');
    const btnImport = document.getElementById('btnImport');
    const btnReset  = document.getElementById('btnReset');
    const btnPrint  = document.getElementById('btnPrint');
    const file      = document.getElementById('importFile');

    if (btnPrint) {
      btnPrint.addEventListener('click', function () {
        Ops.toast('Opening print view…', 'success');
        setTimeout(() => window.print(), 200);
      });
    }

    const btnShare = document.getElementById('btnShare');
    if (btnShare) btnShare.addEventListener('click', shareDealLink);

    if (btnExport) btnExport.addEventListener('click', exportJSON);
    if (btnImport && file) {
      btnImport.addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () {
        importJSON(file.files && file.files[0]);
        file.value = '';
      });
    }
    if (btnReset) btnReset.addEventListener('click', resetAll);

    // Smooth-scroll + active state on nav links.
    const links = document.querySelectorAll('.ops-nav-link');
    links.forEach(link => {
      link.addEventListener('click', function (e) {
        const href = link.getAttribute('href') || '';
        if (!href.startsWith('#')) return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Use IntersectionObserver to highlight the active section in the nav.
    const sections = ['target', 'pipeline', 'negotiation', 'insights', 'purchase', 'pickup', 'refurbishment', 'sale', 'pnl']
      .map(id => document.getElementById(id))
      .filter(Boolean);

    if ('IntersectionObserver' in window && sections.length) {
      const obs = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            links.forEach(l => l.classList.toggle('is-active', l.getAttribute('href') === '#' + id));
          }
        });
      }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
      sections.forEach(s => obs.observe(s));
    }
  }

  // ----------------------------------------------------------
  //  Boot
  // ----------------------------------------------------------
  function boot() {
    paintPnL();
    bindHeader();
    document.addEventListener('usops:state', paintPnL);

    // Compose all paints once on load (fixes any module ordering edge).
    if (Ops.paintPipeline)  Ops.paintPipeline();
    if (Ops.paintKPIs)      Ops.paintKPIs();
    if (Ops.paintRefit)     Ops.paintRefit();
    if (Ops.paintChecklists)Ops.paintChecklists();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
