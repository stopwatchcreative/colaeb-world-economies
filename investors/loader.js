/* Colaeb investor pages (/investors and list pages; footer loads this from @main): loads the map, Investor Match and page scripts in order (one footer tag per page). */
(function () {
  var G = "https://cdn.jsdelivr.net/gh/stopwatchcreative/colaeb-world-economies@";
  [
    "5f1616ce0f6bf6157b1f1d006dffae72e4e55777/network/cn.min.js",
    "f7dbfb2d8658f60c5a4e7257d59cf315d69c91fb/investors/match.min.js",
    "ee66a8a285bdc80c3802706bdc052f9c94fcfb1e/investors/submit.min.js",
    "f7dbfb2d8658f60c5a4e7257d59cf315d69c91fb/investors/extras.min.js",
    "fb8463852fba1ef8be6d81c27553a345ce048b03/investors/ticker.min.js",
    "666fad3f3745b1cb5cdc79be7982ff28aa86d104/investors/page.min.js"
  ].forEach(function (p) { var s = document.createElement("script"); s.src = G + p; s.async = false; document.body.appendChild(s); });
})();
