(function () {
  "use strict";
  var originalFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    var options = arguments[1] || {};
    if (
      typeof url === "string" &&
      url.indexOf("/api/auth/register") !== -1 &&
      (options.method || "").toUpperCase() === "POST"
    ) {
      return originalFetch.apply(this, arguments).then(function (response) {
        if (response.ok) {
          try {
            var body = options.body ? JSON.parse(options.body) : {};
            originalFetch("/api/register-hook.php", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: body.email || "",
                name: body.name || "",
                phone: body.phone || "",
              }),
            }).catch(function () {});
          } catch (e) {}
        }
        return response;
      });
    }
    return originalFetch.apply(this, arguments);
  };
})();
