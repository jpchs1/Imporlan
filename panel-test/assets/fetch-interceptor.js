/**
 * Fetch Interceptor - Imporlan Panel
 * Redirects API calls from Fly.dev backend to local PHP API
 * Must load BEFORE the React bundle (index-*.js)
 */
(function() {
  'use strict';

  var FLY_DEV_ORIGIN = 'https://app-bxlfgnkv.fly.dev';
  var LOCAL_API = '/api';

  var originalFetch = window.fetch;

  window.fetch = function(input, init) {
    var url = (typeof input === 'string') ? input : (input && input.url ? input.url : '');

    if (url.indexOf(FLY_DEV_ORIGIN) === 0) {
      // Rewrite: https://app-bxlfgnkv.fly.dev/api/auth/login -> /api/auth/login
      var newUrl = url.replace(FLY_DEV_ORIGIN, '');
      // Ensure it starts with /api
      if (newUrl.indexOf('/api') !== 0) {
        newUrl = LOCAL_API + newUrl;
      }
      return originalFetch.call(this, newUrl, init);
    }

    return originalFetch.call(this, input, init);
  };
})();
