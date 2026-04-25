/**
 * Imporlan — US Operations Deal Desk
 * Phase 2 / sync — frontend ↔ backend bridge.
 *
 * Loads the deal from /api/us_operations_api.php on boot when the
 * server reachable + token present, otherwise falls back to the
 * Phase-1 localStorage state. Every Storage.save also fires a
 * debounced POST ?action=save so multiple US collaborators converge.
 *
 * Token is held in localStorage under 'imporlan.us_operations.token'.
 * Set it via the prompt that appears when you click "Sync" in the
 * header, or by calling window.__usOps.setToken('...').
 */
(function () {
  'use strict';
  const Ops = window.__usOps;
  if (!Ops) return;

  const TOKEN_KEY = 'imporlan.us_operations.token';
  const API_PATH  = '/api/us_operations_api.php';

  // ----------------------------------------------------------
  //  TOKEN MANAGEMENT
  // ----------------------------------------------------------
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || null; } catch (e) { return null; }
  }
  function setToken(tok) {
    try {
      if (tok) localStorage.setItem(TOKEN_KEY, tok);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* noop */ }
  }
  Ops.getToken = getToken;
  Ops.setToken = setToken;

  // ----------------------------------------------------------
  //  FETCH WRAPPER
  // ----------------------------------------------------------
  function api(action, opts) {
    opts = opts || {};
    const url = API_PATH + '?action=' + encodeURIComponent(action)
      + (opts.query ? '&' + opts.query : '');
    const headers = { 'Content-Type': 'application/json' };
    const tok = getToken();
    if (tok) headers['X-Ops-Token'] = tok;

    const init = {
      method: opts.method || 'GET',
      headers,
      cache: 'no-store',
      credentials: 'same-origin'
    };
    if (opts.body) init.body = JSON.stringify(opts.body);

    return fetch(url, init).then(res => {
      // Try to parse JSON regardless of status so we surface server errors.
      return res.text().then(txt => {
        let json = null;
        try { json = txt ? JSON.parse(txt) : null; } catch (e) { /* not JSON */ }
        if (!res.ok) {
          const msg = (json && json.error) || ('HTTP ' + res.status);
          const err = new Error(msg);
          err.status = res.status;
          err.body = json;
          throw err;
        }
        return json;
      });
    });
  }

  // ----------------------------------------------------------
  //  SYNC STATE
  // ----------------------------------------------------------
  let onlineMode = false;
  let saveTimer  = null;
  let lastSaveAt = null;
  let inFlight   = false;

  function setSyncStatus(label, variant) {
    Ops.setStatus(label, variant);
  }

  // Read ?deal=US-XXX from the URL — overrides the in-state dealNumber
  // so the same dashboard can show any deal.
  function dealFromQuery() {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get('deal') || null;
    } catch (e) { return null; }
  }
  Ops.dealFromQuery = dealFromQuery;

  // Repaint everything after the state has been replaced.
  function repaintAll() {
    document.dispatchEvent(new CustomEvent('usops:state', { detail: Ops.state }));
    if (Ops.paintPipeline)    Ops.paintPipeline();
    if (Ops.paintKPIs)        Ops.paintKPIs();
    if (Ops.paintRefit)       Ops.paintRefit();
    if (Ops.paintChecklists)  Ops.paintChecklists();
    if (Ops.paintTeam)        Ops.paintTeam();
    if (Ops.paintOffers)      Ops.paintOffers();
    if (Ops.paintInquiries)   Ops.paintInquiries();
    if (Ops.paintVesselPhoto) Ops.paintVesselPhoto();
    if (Ops.paintPnL)         Ops.paintPnL();
    if (Ops.paintComps)       Ops.paintComps();
    if (Ops.paintBridge)      Ops.paintBridge();

    // Refresh editable / scalar fields the user can see.
    document.querySelectorAll('[contenteditable="true"][data-field]').forEach(node => {
      const k = node.getAttribute('data-field');
      if (Ops.state[k] != null) node.textContent = Ops.state[k];
    });
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(el => {
      if (el.id in Ops.state) el.value = Ops.state[el.id] != null ? Ops.state[el.id] : '';
    });
  }

  // Pull remote -> overwrite local (called on boot, manual "Pull").
  // Tolerates 404 — if the deal doesn't exist yet, we start from
  // defaults with the right dealNumber and the first push will
  // create the row in the DB.
  function pull() {
    const dn = dealFromQuery() || Ops.state.dealNumber || 'US-2026-001';
    Ops.state.dealNumber = dn;
    return api('get', { query: 'deal_number=' + encodeURIComponent(dn) }).then(json => {
      if (!json || !json.ok || !json.deal) throw new Error('Empty response');
      const remote = json.deal.payload || {};
      const merged = Ops.mergeDefaults(remote, Ops.defaultState());
      merged.dealNumber = dn;
      Ops.state = merged;
      Ops.Storage.save(Ops.state);
      onlineMode = true;
      Ops.toast('Pulled latest deal from server.', 'success');
      setSyncStatus('Online · synced', 'saving');
      repaintAll();
      return true;
    }).catch(err => {
      // 404 = deal not in DB yet. Stay online so the first edit
      // pushes a new row. Anything else falls back to local-only.
      if (err && err.status === 404) {
        const fresh = Ops.defaultState();
        fresh.dealNumber = dn;
        Ops.state = fresh;
        Ops.Storage.save(Ops.state);
        onlineMode = true;
        Ops.toast('New deal — start editing and it will be saved on the server.', 'success');
        setSyncStatus('Online · new deal');
        repaintAll();
        return true;
      }
      throw err;
    });
  }
  Ops.pull = pull;

  // Push local -> server, debounced.
  function pushSoon() {
    if (!onlineMode) return;
    if (saveTimer) clearTimeout(saveTimer);
    setSyncStatus('Saving…', 'saving');
    saveTimer = setTimeout(pushNow, 800);
  }

  function pushNow() {
    if (inFlight) { saveTimer = setTimeout(pushNow, 400); return; }
    inFlight = true;
    const dn = Ops.state.dealNumber || dealFromQuery() || 'US-2026-001';
    return api('save', {
      method: 'POST',
      body: { deal_number: dn, payload: Ops.state }
    }).then(json => {
      lastSaveAt = new Date();
      const stamp = lastSaveAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncStatus('Synced ' + stamp);
    }).catch(err => {
      console.warn('[us-ops] push failed:', err);
      setSyncStatus('Offline — saved locally', 'error');
      onlineMode = false;
    }).finally(() => { inFlight = false; });
  }

  // ----------------------------------------------------------
  //  HOOK INTO STATE CHANGES
  // ----------------------------------------------------------
  document.addEventListener('usops:state', pushSoon);

  // ----------------------------------------------------------
  //  HEADER BUTTON — Sync (prompts for token first time, pulls + enables push)
  // ----------------------------------------------------------
  function injectSyncButton() {
    const actions = document.querySelector('.ops-header-actions');
    if (!actions) return;
    if (document.getElementById('btnSync')) return;

    const btn = document.createElement('button');
    btn.id = 'btnSync';
    btn.type = 'button';
    btn.className = 'ops-btn ops-btn-outline';
    btn.title = 'Sync deal with server (multi-user mode)';
    btn.textContent = 'Sync';
    // Place sync before the Reset button.
    const reset = document.getElementById('btnReset');
    if (reset) actions.insertBefore(btn, reset);
    else actions.appendChild(btn);

    btn.addEventListener('click', function () {
      let tok = getToken();
      if (!tok) {
        const entered = window.prompt('Paste the US Operations API token to enable cross-device sync:');
        if (!entered) return;
        setToken(entered.trim());
        tok = entered.trim();
      }
      setSyncStatus('Connecting…', 'saving');
      api('ping').then(() => pull()).catch(err => {
        if (err && err.status === 403) {
          setToken('');
          Ops.toast('Token rejected. Try again.', 'error');
          setSyncStatus('Offline');
        } else if (err && err.status === 503) {
          Ops.toast('Server has no token configured yet.', 'error');
          setSyncStatus('Offline — server not ready', 'error');
        } else {
          Ops.toast('Could not reach the API.', 'error');
          setSyncStatus('Offline');
        }
      });
    });
  }

  // ----------------------------------------------------------
  //  AUTO-CONNECT ON BOOT IF TOKEN PRESENT
  // ----------------------------------------------------------
  function autoConnect() {
    if (!getToken()) {
      setSyncStatus('Offline — local only');
      return;
    }
    api('ping').then(() => pull()).catch(err => {
      if (err && err.status === 403) {
        setToken('');
        setSyncStatus('Offline — token rejected');
      } else {
        setSyncStatus('Offline — local only');
      }
    });
  }

  function boot() {
    injectSyncButton();
    autoConnect();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
