/* Colaeb investor pages (/investors and list pages; footer loads this from @main): loads the map, Investor Match and page scripts in order (one footer tag per page). */
(function () {
  var G = "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@";
  [
    "5f1616ce0f6bf6157b1f1d006dffae72e4e55777/network/cn.min.js",
    "f7dbfb2d8658f60c5a4e7257d59cf315d69c91fb/investors/match.min.js",
    "a43005517e782352eeeb90eacd7010ab4e10ebfc/investors/submit.min.js",
    "f36d91e855850aeb700ec5c26fc8f42f97add17b/investors/extras.min.js",
    "fb8463852fba1ef8be6d81c27553a345ce048b03/investors/ticker.min.js",
    "f36d91e855850aeb700ec5c26fc8f42f97add17b/investors/page.min.js"
  ].forEach(function (p) { var s = document.createElement("script"); s.src = G + p; s.async = false; document.body.appendChild(s); });
})();
