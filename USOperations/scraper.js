/**
 * Imporlan — US Operations / Scraper helper (Phase 4)
 *
 * Facebook Marketplace blocks server-side scrapers and won't render
 * useful HTML to fetch() from the browser, so a one-click "import
 * this URL" is not a thing we can ship cleanly today. Instead, this
 * module gives the operator a practical workflow:
 *
 *   1. They press "Quick fill" on the vessel card.
 *   2. We open a modal with a textarea.
 *   3. They paste the FB Marketplace listing text (Cmd-A / Cmd-C
 *      on the listing page works) and we run regex over it to
 *      extract make, model, year, length, engine, hours, location
 *      and asking price, populating the deal card automatically.
 *
 * It's a 5-second improvement over typing each field, and it works
 * for any listing source (Craigslist, BoatTrader, dealer sites,
 * dealer emails, broker PDFs after copy-paste).
 */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // -----------------------------------------------------------
  //  Modal markup (lazy)
  // -----------------------------------------------------------
  let modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.id = 'qfModal';
    modalEl.innerHTML =
      '<div class="qf-overlay"></div>' +
      '<div class="qf-dialog" role="dialog" aria-modal="true" aria-labelledby="qfTitle">' +
        '<header class="qf-head">' +
          '<h3 id="qfTitle">Quick fill from listing text</h3>' +
          '<button class="qf-close" aria-label="Close">×</button>' +
        '</header>' +
        '<p class="qf-hint">Paste the listing text (Facebook Marketplace, Craigslist, BoatTrader, broker email…). We\'ll auto-extract make, model, year, length, engine, hours, location and asking price.</p>' +
        '<textarea id="qfText" rows="10" spellcheck="false" placeholder="Paste listing text here…"></textarea>' +
        '<div class="qf-actions">' +
          '<button class="ops-btn ops-btn-ghost" id="qfCancel" type="button">Cancel</button>' +
          '<button class="ops-btn ops-btn-primary" id="qfApply" type="button">Extract &amp; fill</button>' +
        '</div>' +
        '<div class="qf-preview" id="qfPreview" hidden></div>' +
      '</div>';
    document.body.appendChild(modalEl);
    injectStyles();

    modalEl.querySelector('.qf-overlay').addEventListener('click', closeModal);
    modalEl.querySelector('.qf-close').addEventListener('click', closeModal);
    modalEl.querySelector('#qfCancel').addEventListener('click', closeModal);
    modalEl.querySelector('#qfApply').addEventListener('click', extractAndFill);
    return modalEl;
  }

  function injectStyles() {
    if (document.getElementById('qfStyles')) return;
    const style = document.createElement('style');
    style.id = 'qfStyles';
    style.textContent =
      '#qfModal{position:fixed;inset:0;z-index:200;display:none;align-items:center;justify-content:center;}' +
      '#qfModal.is-open{display:flex;}' +
      '.qf-overlay{position:absolute;inset:0;background:rgba(6,12,24,0.72);backdrop-filter:blur(6px);}' +
      '.qf-dialog{position:relative;width:min(640px,calc(100% - 32px));max-height:90vh;overflow:auto;background:var(--bg-card);border:1px solid var(--line-strong);border-radius:18px;padding:24px;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:14px;}' +
      '.qf-head{display:flex;align-items:center;justify-content:space-between;}' +
      '.qf-head h3{font-size:1.1rem;font-weight:700;color:var(--text);}' +
      '.qf-close{font-size:1.4rem;color:var(--text-mute);width:32px;height:32px;border-radius:8px;display:grid;place-items:center;}' +
      '.qf-close:hover{background:rgba(255,255,255,0.06);color:var(--text);}' +
      '.qf-hint{font-size:0.9rem;color:var(--text-mute);line-height:1.5;}' +
      '.qf-dialog textarea{background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;padding:12px 14px;color:var(--text);font-size:0.9rem;font-family:inherit;line-height:1.5;resize:vertical;min-height:160px;}' +
      '.qf-dialog textarea:focus{outline:none;border-color:var(--accent-hi);box-shadow:0 0 0 3px rgba(96,165,250,0.18);}' +
      '.qf-actions{display:flex;gap:10px;justify-content:flex-end;}' +
      '.qf-preview{padding:14px;border-radius:12px;background:rgba(96,165,250,0.06);border:1px solid rgba(96,165,250,0.22);font-size:0.88rem;color:var(--text-soft);}' +
      '.qf-preview ul{list-style:none;display:flex;flex-direction:column;gap:4px;}' +
      '.qf-preview li{display:flex;justify-content:space-between;gap:12px;}' +
      '.qf-preview li span:first-child{color:var(--text-mute);text-transform:uppercase;letter-spacing:0.06em;font-size:0.74rem;font-weight:600;}' +
      '.qf-preview li span:last-child{color:var(--text);font-weight:500;}';
    document.head.appendChild(style);
  }

  function openModal() {
    ensureModal().classList.add('is-open');
    setTimeout(() => modalEl.querySelector('#qfText').focus(), 80);
  }
  function closeModal() {
    if (modalEl) {
      modalEl.classList.remove('is-open');
      modalEl.querySelector('#qfText').value = '';
      modalEl.querySelector('#qfPreview').hidden = true;
    }
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalEl && modalEl.classList.contains('is-open')) closeModal();
  });

  // -----------------------------------------------------------
  //  EXTRACTION RULES
  //
  //  These regexes are deliberately conservative — better to skip a
  //  field than to write garbage into the deal card. Each rule
  //  returns either the extracted value or null.
  // -----------------------------------------------------------
  const KNOWN_MAKES = [
    'bayliner','sea ray','chaparral','four winns','fourwinns','mastercraft','malibu',
    'boston whaler','whaler','yamaha','regal','rinker','wellcraft','starcraft','stingray',
    'crownline','larson','cobalt','nautique','correct craft','glastron','formula','axis'
  ];

  function detectMakeModel(t) {
    const lower = t.toLowerCase();
    for (const m of KNOWN_MAKES) {
      const idx = lower.indexOf(m);
      if (idx === -1) continue;
      // Capture make + the next word as model.
      const after = t.substring(idx + m.length, idx + m.length + 30).trim();
      const modelMatch = after.match(/[A-Za-z0-9-]+/);
      const make = m.replace(/\b\w/g, c => c.toUpperCase());
      const model = modelMatch ? modelMatch[0] : '';
      return (make + (model ? ' ' + model : '')).trim();
    }
    return null;
  }

  function detectYear(t) {
    const m = t.match(/\b(19[7-9]\d|20[0-3]\d)\b/);
    return m ? m[0] : null;
  }

  function detectLength(t) {
    // "18 ft", "18'", "18-foot"
    const m = t.match(/(\d{2})\s*(?:'|ft\b|-?\s*foot|feet)/i);
    return m ? (m[1] + ' ft') : null;
  }

  function detectEngine(t) {
    // "MerCruiser 3.0L", "Yamaha 150HP", "Mercury 90", "Volvo Penta 4.3"
    const patterns = [
      /\b(mercruiser|mercury|yamaha|honda|suzuki|tohatsu|evinrude|johnson|volvo penta|volvo|crusader|indmar|pcm)\b[^\n.]{0,40}/i
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m) return m[0].trim().replace(/\s{2,}/g, ' ');
    }
    return null;
  }

  function detectHours(t) {
    const m = t.match(/(\d{1,4})\s*(?:hours|hrs|hr)\b/i);
    return m ? m[1] : null;
  }

  function detectLocation(t) {
    // City, ST  (two-letter state, US biased)
    const m = t.match(/([A-Z][A-Za-z .-]{2,30}),\s*([A-Z]{2})\b/);
    return m ? (m[1].trim() + ', ' + m[2]) : null;
  }

  function detectAsking(t) {
    // "$12,500", "$ 12500", "USD 12,500", "12,500 USD"
    const m = t.match(/\$\s*([\d,]{3,9})/);
    if (m) {
      const n = parseInt(m[1].replace(/,/g, ''), 10);
      if (n > 500 && n < 1000000) return n;
    }
    return null;
  }

  function detectTrailer(t) {
    if (/\btrailer\s+included\b/i.test(t) || /\bw\/?\s*trailer\b/i.test(t) || /\bwith\s+trailer\b/i.test(t)) return 'Yes, included';
    if (/\bno\s+trailer\b/i.test(t)) return 'No';
    return null;
  }

  function detectTitle(t) {
    if (/\bclean\s+title\b/i.test(t)) return 'Clean';
    if (/\bsalvage\b/i.test(t))       return 'Salvage';
    if (/\bbonded\s+title\b/i.test(t))return 'Bonded';
    if (/\bno\s+title\b/i.test(t))    return 'No title';
    return null;
  }

  function extract(text) {
    const t = String(text || '');
    return {
      makeModel:   detectMakeModel(t),
      year:        detectYear(t),
      length:      detectLength(t),
      engine:      detectEngine(t),
      hours:       detectHours(t),
      locationUS:  detectLocation(t),
      askingPrice: detectAsking(t),
      trailer:     detectTrailer(t),
      titleStatus: detectTitle(t)
    };
  }

  // -----------------------------------------------------------
  //  Apply extracted fields to state and repaint the dashboard
  // -----------------------------------------------------------
  function applyFields(fields) {
    let changed = false;
    const set = (key, val) => {
      if (val == null || val === '') return;
      if (Ops.state[key] !== val) {
        Ops.state[key] = val;
        changed = true;
      }
    };
    set('makeModel',   fields.makeModel);
    set('year',        fields.year);
    set('length',      fields.length);
    set('engine',      fields.engine);
    set('hours',       fields.hours);
    set('locationUS',  fields.locationUS);
    set('trailer',     fields.trailer);
    set('titleStatus', fields.titleStatus);
    if (fields.askingPrice != null) {
      Ops.state.askingPrice = fields.askingPrice;
      const inp = document.getElementById('askingPrice');
      if (inp) inp.value = fields.askingPrice;
      changed = true;
    }
    if (changed) {
      Ops.persist({ toast: 'Listing parsed into the deal.', variant: 'success' });
      Ops.broadcast();
      // Refresh contenteditable visible values.
      ['makeModel','year','length','engine','hours','locationUS','trailer','titleStatus'].forEach(k => {
        const el = document.querySelector('[data-field="' + k + '"]');
        if (el && Ops.state[k] != null) el.textContent = Ops.state[k];
      });
    } else {
      Ops.toast('Nothing new found in that text.', 'error');
    }
  }

  function extractAndFill() {
    const text = (modalEl.querySelector('#qfText').value || '').trim();
    if (!text) { Ops.toast('Paste some listing text first.', 'error'); return; }
    const fields = extract(text);

    // Show preview before committing — no surprises.
    const preview = modalEl.querySelector('#qfPreview');
    const lines = [];
    Object.keys(fields).forEach(k => {
      if (fields[k] != null && fields[k] !== '') {
        lines.push('<li><span>' + k + '</span><span>' + Ops.esc(fields[k]) + '</span></li>');
      }
    });
    if (!lines.length) {
      preview.innerHTML = '<em style="color:var(--text-dim);">Nothing recognized — try pasting more of the listing.</em>';
      preview.hidden = false;
      return;
    }
    preview.innerHTML = '<strong style="display:block;margin-bottom:6px;color:var(--accent-hi);font-size:0.78rem;letter-spacing:0.06em;text-transform:uppercase;">Detected fields</strong><ul>' + lines.join('') + '</ul>';
    preview.hidden = false;

    applyFields(fields);
    setTimeout(closeModal, 1100);
  }

  // -----------------------------------------------------------
  //  Wire-up
  // -----------------------------------------------------------
  function boot() {
    const btn = document.getElementById('btnQuickFill');
    if (btn) btn.addEventListener('click', openModal);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
