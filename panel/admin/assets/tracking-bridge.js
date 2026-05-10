/**
 * Tracking Bridge - /panel/admin/ (React bundle)
 *
 * Admin parallel to /panel/user/assets/tracking-bridge.js. Same route
 * engine, adapted to the admin endpoints:
 *
 *   action=admin_list_vessels   -> response shape {success, vessels|items}
 *   action=vessel_positions     -> filter to USA-Chile corridor bounding box
 *
 * Admin CRUD endpoints (admin_create_vessel / admin_update_vessel /
 * admin_delete_vessel) are NOT intercepted -- those are admin write actions
 * that must pass through unchanged.
 *
 * Behaviour identical to the user bridge: resolve origin + destination
 * ports, snap to AIS when within 800 km of the corridor, snap to
 * destination + flip status='arrived' when within 80 km, otherwise project
 * a position along the route based on elapsed time vs ETA. Speed/course
 * = -1 (AIS unknown sentinel) is sanitised to null so the UI hides them.
 */
(function () {
  'use strict';

  // ============================================
  // Route engine (mirror of panel/assets/tracking-enhancer.js)
  // ============================================
  var PORT_COORDS = {
    // USA East Coast
    'miami':           { lat: 25.7741, lon: -80.1918 },
    'fort lauderdale': { lat: 26.0928, lon: -80.1244 },
    'jacksonville':    { lat: 30.3322, lon: -81.6557 },
    'savannah':        { lat: 32.0809, lon: -81.0912 },
    'charleston':      { lat: 32.7765, lon: -79.9311 },
    'norfolk':         { lat: 36.8508, lon: -76.2859 },
    'baltimore':       { lat: 39.2904, lon: -76.6122 },
    'new york':        { lat: 40.6892, lon: -74.0445 },
    'philadelphia':    { lat: 39.9526, lon: -75.1652 },
    // USA Gulf Coast
    'houston':         { lat: 29.7269, lon: -95.0409 },
    'galveston':       { lat: 29.3013, lon: -94.7977 },
    'new orleans':     { lat: 29.9511, lon: -90.0715 },
    'mobile':          { lat: 30.6954, lon: -88.0399 },
    'tampa':           { lat: 27.9506, lon: -82.4572 },
    // USA West Coast
    'long beach':      { lat: 33.7701, lon: -118.1937 },
    'los angeles':     { lat: 33.7406, lon: -118.2769 },
    'oakland':         { lat: 37.8044, lon: -122.2711 },
    'san francisco':   { lat: 37.7749, lon: -122.4194 },
    'seattle':         { lat: 47.6062, lon: -122.3321 },
    // Chile
    'san antonio':     { lat: -33.5953, lon: -71.6086 },
    'valparaiso':      { lat: -33.0472, lon: -71.6127 }
  };
  var PANAMA_CANAL = { lat: 8.4503, lon: -79.4506 };
  var OFF_ROUTE_KM = 800;
  var ARRIVED_KM = 80;

  function normalizePortLabel(label) {
    if (!label) return null;
    var first = String(label).split(',')[0].trim().toLowerCase();
    if (first.normalize) first = first.normalize('NFD').replace(/[̀-ͯ]/g, '');
    return PORT_COORDS[first] ? first : null;
  }
  function getPortCoords(label) {
    var k = normalizePortLabel(label);
    return k ? PORT_COORDS[k] : null;
  }
  function buildRouteWaypoints(o, d) {
    if (!o || !d) return null;
    if (o.lon > -100) return [o, PANAMA_CANAL, d];
    return [o, d];
  }
  function haversineKm(a, b) {
    var R = 6371, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r;
    var dLon = (b.lon - a.lon) * r;
    var l1 = a.lat * r, l2 = b.lat * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(l1) * Math.cos(l2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function routeLengthKm(p) {
    var t = 0;
    for (var i = 1; i < p.length; i++) t += haversineKm(p[i - 1], p[i]);
    return t;
  }
  function positionAtFraction(p, f) {
    var T = routeLengthKm(p);
    var tg = Math.max(0, Math.min(1, f)) * T;
    var a = 0;
    for (var i = 1; i < p.length; i++) {
      var seg = haversineKm(p[i - 1], p[i]);
      if (a + seg >= tg) {
        var t = seg === 0 ? 0 : (tg - a) / seg;
        return {
          lat: p[i - 1].lat + (p[i].lat - p[i - 1].lat) * t,
          lon: p[i - 1].lon + (p[i].lon - p[i - 1].lon) * t
        };
      }
      a += seg;
    }
    return p[p.length - 1];
  }
  function distanceToPolyline(p, pt) {
    var m = Infinity;
    for (var i = 0; i < p.length; i++) {
      var d = haversineKm(p[i], pt);
      if (d < m) m = d;
    }
    return m;
  }
  function timeProgress(v) {
    var s = v.last_position_update || v.created_at;
    var e = v.eta_manual || v.pos_eta;
    var st = s ? new Date(String(s).replace(' ', 'T') + 'Z').getTime() : null;
    var et = e ? new Date(String(e).replace(' ', 'T') + 'Z').getTime() : null;
    if (!st || !et || et <= st) return 0.5;
    var n = Date.now();
    if (n <= st) return 0.05;
    if (n >= et) return 0.95;
    return (n - st) / (et - st);
  }
  function resolveVesselPosition(v) {
    var origin = getPortCoords(v.origin_label);
    var destination = getPortCoords(v.destination_label);
    var route = buildRouteWaypoints(origin, destination);
    if (!route) return null;
    var aLat = parseFloat(v.lat);
    var aLon = parseFloat(v.lon);
    var ais = (!isNaN(aLat) && !isNaN(aLon)) ? { lat: aLat, lon: aLon } : null;
    if (ais && haversineKm(ais, destination) <= ARRIVED_KM) {
      return { lat: destination.lat, lon: destination.lon, arrived: true, projected: false };
    }
    if (ais && distanceToPolyline(route, ais) <= OFF_ROUTE_KM) {
      return { lat: ais.lat, lon: ais.lon, arrived: false, projected: false };
    }
    var pt = positionAtFraction(route, timeProgress(v));
    return { lat: pt.lat, lon: pt.lon, arrived: false, projected: true };
  }

  function fixVessel(v) {
    if (!v || typeof v !== 'object') return;
    // vessel_detail responses don't carry top-level lat/lon -- only inside
    // current_position. Hoist them so the resolver sees the real AIS point;
    // otherwise it always falls through to the time-projection branch and
    // drags MSC Pamela / Maersk Seletar (already on route) off into Chile.
    if ((v.lat == null || v.lat === '') && v.current_position && v.current_position.lat != null) {
      v.lat = v.current_position.lat;
    }
    if ((v.lon == null || v.lon === '') && v.current_position && v.current_position.lon != null) {
      v.lon = v.current_position.lon;
    }
    var r = resolveVesselPosition(v);
    if (!r) return; // unknown ports, leave as-is
    v.lat = String(r.lat);
    v.lon = String(r.lon);
    if (r.arrived) v.status = 'arrived';
    if (v.current_position && typeof v.current_position === 'object') {
      v.current_position.lat = r.lat;
      v.current_position.lon = r.lon;
    }
    sanitizeTelemetry(v);
  }

  // Backend AIS reports speed=-1 / course=-1 when the value is unknown.
  // The React UI prints them verbatim ("-1.00 kn") which looks broken.
  // Convert to null so the UI hides the field via its existing falsy check.
  function isUnknownNumber(n) {
    if (n == null || n === '') return false;
    var f = parseFloat(n);
    return !isNaN(f) && f < 0;
  }
  function sanitizeTelemetry(v) {
    if (!v) return;
    if (isUnknownNumber(v.speed))  v.speed = null;
    if (isUnknownNumber(v.course)) v.course = null;
    if (v.current_position && typeof v.current_position === 'object') {
      if (isUnknownNumber(v.current_position.speed))  v.current_position.speed = null;
      if (isUnknownNumber(v.current_position.course)) v.current_position.course = null;
    }
  }

  // ============================================
  // vessel_positions track history filter
  // ----------------------------------------------
  // The AIS feed returns the ship's full historical track. For some vessels
  // that includes Europe/Africa coordinates from before/after the booked
  // USA -> Chile transit (MSC Pamela has Hamburg/Antwerp positions; CMA CGM
  // Thalassa has positions off Portugal). The /panel/user/ React bundle
  // draws a polyline through the entire track, producing visible Atlantic
  // crossings on the map.
  //
  // We constrain the polyline to the Americas + Pacific corridor by dropping
  // any position whose (lat, lon) falls outside a generous bounding box that
  // still covers every plausible US-port-to-Chile route.
  // ============================================
  var CORRIDOR_LON_MIN = -135;  // West coast US (~-122) with margin
  var CORRIDOR_LON_MAX = -65;   // East coast US (~-74) with margin
  var CORRIDOR_LAT_MIN = -40;   // South of Valparaiso (-33)
  var CORRIDOR_LAT_MAX = 52;    // North of New York (40) / Seattle (47)
  function inCorridor(lat, lon) {
    return lon >= CORRIDOR_LON_MIN && lon <= CORRIDOR_LON_MAX &&
           lat >= CORRIDOR_LAT_MIN && lat <= CORRIDOR_LAT_MAX;
  }
  function filterPositions(positions) {
    if (!Array.isArray(positions)) return positions;
    return positions.filter(function (p) {
      var lat = parseFloat(p.lat);
      var lon = parseFloat(p.lon != null ? p.lon : p.lng);
      if (isNaN(lat) || isNaN(lon)) return false;
      return inCorridor(lat, lon);
    });
  }

  function shouldIntercept(url) {
    if (typeof url !== 'string') {
      if (url && url.url) url = url.url; else return false;
    }
    if (url.indexOf('tracking_api.php') === -1) return false;
    return url.indexOf('action=admin_list_vessels') !== -1 ||
           url.indexOf('action=vessel_detail') !== -1 ||
           url.indexOf('action=vessel_positions') !== -1;
  }

  // ============================================
  // fetch monkey-patch
  // ============================================
  if (window.__impTrackingBridgePatched) return;
  window.__impTrackingBridgePatched = true;

  var origFetch = window.fetch.bind(window);
  window.fetch = function () {
    var url = arguments[0];
    var promise = origFetch.apply(null, arguments);
    if (!shouldIntercept(url)) return promise;
    return promise.then(function (resp) {
      if (!resp || !resp.ok) return resp;
      var cloned;
      try { cloned = resp.clone(); } catch (e) { return resp; }
      return cloned.json().then(function (data) {
        try {
          if (data && (data.success || data.vessels || data.items)) {
            // admin_list_vessels may return either {vessels:[...]} or {items:[...]}
            if (Array.isArray(data.vessels)) data.vessels.forEach(fixVessel);
            if (Array.isArray(data.items))   data.items.forEach(fixVessel);
            if (data.vessel) fixVessel(data.vessel);
            if (Array.isArray(data.positions)) {
              data.positions = filterPositions(data.positions);
            }
          }
        } catch (e) { return resp; }
        return new Response(JSON.stringify(data), {
          status: resp.status,
          statusText: resp.statusText,
          headers: resp.headers
        });
      }).catch(function () { return resp; });
    });
  };
})();
