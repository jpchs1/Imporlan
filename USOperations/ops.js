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
  document.addEventListener('DOMContentLoaded', function () {
    const s = window.__usOps.state;
    if (s.updatedAt) {
      const when = new Date(s.updatedAt);
      setStatus('Saved ' + when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setStatus('Live');
    }
  });
})();
