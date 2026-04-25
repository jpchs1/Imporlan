/**
 * Imporlan — US Operations / Insights module (Phase 4)
 *
 * Two pieces of decision support:
 *
 *   1) Comparable-sales card.  Until we have a live comps API hooked
 *      up (NADA, BoatTrader sold listings, etc.), this seeds a small
 *      static reference table for the boat segments we trade most
 *      and filters it by the make / model / length the user typed
 *      into the hero card. The card surfaces an average and suggests
 *      a target buy + resale anchor based on that average.
 *
 *   2) Import-to-Chile bridge.  Compares the projected US-flip profit
 *      with the projected profit if the boat is shipped to Chile via
 *      the Imporlan all-inclusive door-to-door service. Uses the
 *      live deal numbers (asking, refit, transport) and a couple of
 *      tunable assumptions (Chile resale uplift, all-in import cost)
 *      to recommend a path.
 */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  // -----------------------------------------------------------
  //  COMPS — hand-curated reference for the segments Imporlan trades.
  //  Prices are rough US-market medians for clean, working boats.
  //  Tune over time; replace with live data in a future pass.
  // -----------------------------------------------------------
  const COMPS = [
    // make,    model regex,    year-bucket, length-ft, price USD
    { make: 'Bayliner',  model: '185',    year: 2010, length: 18, price: 11500 },
    { make: 'Bayliner',  model: '185',    year: 2014, length: 18, price: 14500 },
    { make: 'Bayliner',  model: '195',    year: 2012, length: 19, price: 13000 },
    { make: 'Bayliner',  model: 'Element',year: 2018, length: 16, price: 13500 },
    { make: 'Bayliner',  model: 'Capri',  year: 2002, length: 18, price: 6800  },
    { make: 'Sea Ray',   model: '185',    year: 2008, length: 18, price: 12500 },
    { make: 'Sea Ray',   model: '210',    year: 2012, length: 21, price: 22000 },
    { make: 'Sea Ray',   model: 'Sundeck',year: 2010, length: 24, price: 28500 },
    { make: 'Chaparral', model: '180',    year: 2008, length: 18, price: 13000 },
    { make: 'Chaparral', model: '210',    year: 2014, length: 21, price: 26500 },
    { make: 'Four Winns',model: '180',    year: 2010, length: 18, price: 12500 },
    { make: 'Four Winns',model: 'Horizon',year: 2014, length: 21, price: 23000 },
    { make: 'Mastercraft',model:'X-Star', year: 2010, length: 22, price: 42000 },
    { make: 'Malibu',    model: 'Wakesetter',year:2012,length:22,  price: 47000 },
    { make: 'Boston Whaler',model:'Montauk',year:2008,length:17,   price: 18500 },
    { make: 'Boston Whaler',model:'Outrage',year:2010,length:23,   price: 39500 },
    { make: 'Yamaha',    model: '212',    year: 2014, length: 21, price: 27500 },
    { make: 'Yamaha',    model: '242',    year: 2016, length: 24, price: 39000 }
  ];

  // -----------------------------------------------------------
  //  Helpers
  // -----------------------------------------------------------
  function parseLengthFt(s) {
    if (!s) return null;
    const m = String(s).match(/(\d{1,3})/);
    return m ? parseInt(m[1], 10) : null;
  }
  function parseYear(s) {
    if (!s) return null;
    const m = String(s).match(/(19|20)\d{2}/);
    return m ? parseInt(m[0], 10) : null;
  }

  function score(comp, ctx) {
    let s = 0;
    if (ctx.make && comp.make && comp.make.toLowerCase() === ctx.make.toLowerCase()) s += 4;
    if (ctx.model && comp.model && new RegExp(comp.model.split(/\s+/)[0], 'i').test(ctx.model)) s += 3;
    if (ctx.year   && Math.abs(comp.year   - ctx.year) <= 3) s += 2;
    if (ctx.length && Math.abs(comp.length - ctx.length) <= 2) s += 1;
    return s;
  }

  function pickComps(state) {
    // Hero "makeModel" can be 'Bayliner 185' or 'Bayliner / 185 BR'; split heuristically.
    const mm = String(state.makeModel || '').replace(/\s*\/\s*/g, ' ').trim();
    const tokens = mm.split(/\s+/).filter(Boolean);
    const make  = tokens[0] || null;
    const model = tokens.slice(1).join(' ') || null;

    const ctx = {
      make,
      model,
      year:   parseYear(state.year),
      length: parseLengthFt(state.length)
    };
    return COMPS
      .map(c => ({ ...c, _score: score(c, ctx) }))
      .filter(c => c._score >= 3)
      .sort((a, b) => b._score - a._score)
      .slice(0, 6);
  }

  function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((s, n) => s + n, 0) / arr.length;
  }

  // -----------------------------------------------------------
  //  Comps render
  // -----------------------------------------------------------
  function paintComps() {
    const list = document.getElementById('compsList');
    const hint = document.getElementById('compsHint');
    if (!list) return;

    const matches = pickComps(Ops.state);
    if (!matches.length) {
      list.innerHTML = '';
      list.innerHTML = '<li style="grid-template-columns:1fr;justify-content:center;color:var(--text-dim);font-style:italic;">Set make / model / year in the hero card to see matching comps.</li>';
      if (hint) hint.style.display = 'none';
      return;
    }

    list.innerHTML = matches.map(c =>
      '<li>' +
        '<span class="ops-offer-date">' + c.year + ' · ' + c.length + ' ft</span>' +
        '<span class="ops-offer-side is-us">' + Ops.esc(c.make + ' ' + c.model) + '</span>' +
        '<span class="ops-offer-amount">' + Ops.money(c.price) + '</span>' +
        '<span class="ops-offer-note">Match score ' + c._score + '/10 — adjust hero specs to refine.</span>' +
      '</li>'
    ).join('');

    if (hint) {
      const a = avg(matches.map(c => c.price));
      const target = Math.round(a * 0.65);   // open at 35% under comps avg
      const resale = Math.round(a * 0.95);   // list at ~5% under comps avg to move fast
      const $ = id => document.getElementById(id);
      $('compsAvg').textContent    = 'Avg comp: ' + Ops.money(a);
      $('compsTarget').textContent = 'Suggested target buy: ' + Ops.money(target) + ' (35% under comps avg)';
      $('compsResale').textContent = 'Suggested resale: ' + Ops.money(resale) + ' (5% under comps avg, sells fast)';
      hint.style.display = '';
    }
  }
  Ops.paintComps = paintComps;

  // -----------------------------------------------------------
  //  Import-to-Chile bridge
  // -----------------------------------------------------------
  // Tunable defaults (state-overridable down the road).
  const CL_UPLIFT      = 0.45;   // 45% resale premium in Chile vs US list.
  const CL_IMPORT_COST = 8500;   // USD all-in import including taxes + service.

  function paintBridge() {
    // US flip projection (use existing Ops helpers).
    const usProfit = Ops.projectedProfit ? Ops.projectedProfit() : 0;
    const usSale   = Ops.toNum(Ops.state.listPrice);
    const usMargin = usSale > 0 ? (usProfit / usSale * 100) : 0;

    // Chile import projection.
    const buy    = Ops.buyPriceUsed ? Ops.buyPriceUsed() : 0;
    const refit  = Ops.refitTotal  ? Ops.refitTotal()    : 0;
    const pickup = Ops.pickupTotal ? Ops.pickupTotal()   : 0;
    const allInUsa = buy + refit + pickup;
    const clSale = Math.round(usSale * (1 + CL_UPLIFT));
    const clCost = allInUsa + CL_IMPORT_COST;
    const clProfit = clSale - clCost;
    const clMargin = clSale > 0 ? (clProfit / clSale * 100) : 0;

    const $ = id => document.getElementById(id);
    $('flipUsProfit').textContent = Ops.money(usProfit);
    $('flipUsMargin').textContent = Ops.pct(usMargin) + ' margin';
    $('flipClProfit').textContent = Ops.money(clProfit);
    $('flipClMargin').textContent = Ops.pct(clMargin) + ' margin';

    // Color the import card based on whether Chile beats US flip.
    const card = document.getElementById('flipClProfit')?.closest('.ops-kpi');
    if (card) {
      card.classList.toggle('is-loss', clProfit < usProfit);
    }

    // Update labels with the active assumptions.
    const upL = $('clUpliftLabel'); if (upL) upL.textContent = '+' + Math.round(CL_UPLIFT * 100) + '%';
    const ic  = $('clImportCostLabel'); if (ic)  ic.textContent  = Ops.money(CL_IMPORT_COST);
  }
  Ops.paintBridge = paintBridge;

  // -----------------------------------------------------------
  //  Recommendation modal (uses native confirm to keep deps zero)
  // -----------------------------------------------------------
  function recommend() {
    const usProfit = Ops.projectedProfit();
    const usSale   = Ops.toNum(Ops.state.listPrice);
    const buy      = Ops.buyPriceUsed();
    const refit    = Ops.refitTotal();
    const pickup   = Ops.pickupTotal();
    const allInUsa = buy + refit + pickup;
    const clSale   = Math.round(usSale * (1 + CL_UPLIFT));
    const clProfit = clSale - allInUsa - CL_IMPORT_COST;

    if (usSale <= 0) {
      Ops.toast('Set a list price first so we can compare.', 'error');
      return;
    }
    if (clProfit > usProfit * 1.25) {
      Ops.toast('Recommend: import to Chile (~' + Ops.money(clProfit - usProfit) + ' more profit).', 'success');
    } else if (usProfit > clProfit) {
      Ops.toast('Recommend: flip in US (faster cycle, ~' + Ops.money(usProfit - clProfit) + ' upside).', 'success');
    } else {
      Ops.toast('Both paths similar — pick by speed-to-cash.', 'success');
    }
  }

  // -----------------------------------------------------------
  //  Boot
  // -----------------------------------------------------------
  function boot() {
    paintComps();
    paintBridge();

    const refresh = document.getElementById('btnRefreshComps');
    if (refresh) refresh.addEventListener('click', function () {
      paintComps();
      Ops.toast('Comps refreshed.', 'success');
    });
    const decide = document.getElementById('btnFlipDecision');
    if (decide) decide.addEventListener('click', recommend);

    document.addEventListener('usops:state', function () {
      paintComps();
      paintBridge();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
