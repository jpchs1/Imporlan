(function() {
  var IMAGE_MAP = {
    "photo-1605281317010-fe5ffe798166": "cobalt-r30.jpg",
    "photo-1544551763-46a013bb70d5": "cobalt-cs23.jpg",
    "photo-1567899378494-47b22a2ae96a": "cobalt-a29.jpg",
    "photo-1559494007-9f5847c49d94": "cobalt-r30.jpg"
  };

  function getBasePath() {
    var path = window.location.pathname;
    if (path.indexOf("/test/panel") !== -1) return "/test/panel";
    if (path.indexOf("/panel-test") !== -1) return "/panel-test";
    return "/panel";
  }

  function replaceImages() {
    var basePath = getBasePath();
    var images = document.querySelectorAll("img");
    var replaced = 0;
    for (var i = 0; i < images.length; i++) {
      var src = images[i].getAttribute("src") || "";
      for (var key in IMAGE_MAP) {
        if (src.indexOf(key) !== -1) {
          images[i].setAttribute("src", basePath + "/assets/" + IMAGE_MAP[key]);
          images[i].style.objectFit = "cover";
          replaced++;
          break;
        }
      }
    }
    return replaced;
  }

  function init() {
    replaceImages();
    var observer = new MutationObserver(function() {
      replaceImages();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
