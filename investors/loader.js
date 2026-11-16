/* Colaeb investor pages (/investors and list pages; footer loads this from @main).
   Reads investors/version.json from GitHub (cached ~5 min) and loads the map data and
   page scripts from that exact commit on jsDelivr, so updates go live within minutes
   without purging the CDN. If the version file is slow or missing, falls back to the
   pinned commits below. */
(function () {
  var REPO = "stopwatchcreative/colaeb-world-economies";
  var G = "https://cdn.jsdelivr.net/gh/" + REPO + "@";
  var PINNED = [
    "5f1616ce0f6bf6157b1f1d006dffae72e4e55777/network/cn.min.js",
    "f7dbfb2d8658f60c5a4e7257d59cf315d69c91fb/investors/match.min.js",
    "a43005517e782352eeeb90eacd7010ab4e10ebfc/investors/submit.min.js",
    "f36d91e855850aeb700ec5c26fc8f42f97add17b/investors/extras.min.js",
    "fb8463852fba1ef8be6d81c27553a345ce048b03/investors/ticker.min.js",
    "f36d91e855850aeb700ec5c26fc8f42f97add17b/investors/page.min.js"
  ];
  var FILES = ["network/cn.min.js", "investors/match.min.js", "investors/submit.min.js", "investors/extras.min.js", "investors/ticker.min.js", "investors/page.min.js"];
  var started = false;
  function run(sha) {
    if (started) return; started = true;
    var cfg = window.CN_CONFIG = window.CN_CONFIG || {};
    var list = PINNED;
    if (sha) {
      var at = G + sha + "/investors/";
      cfg.feed = at + "investors-feed-enriched.json";
      cfg.deals = at + "enrich/yid-deals.json";
      cfg.profileMap = at + "enrich/profiles.json";
      cfg.firmVerified = at + "enrich/firm-verified.json";
      cfg.firstSeen = at + "enrich/first-seen.json";
      cfg.dataVersion = sha;
      list = FILES.map(function (f) { return sha + "/" + f; });
    }
    list.forEach(function (p) { var s = document.createElement("script"); s.src = G + p; s.async = false; document.body.appendChild(s); });
  }
  setTimeout(function () { run(""); }, 2000);
  try {
    fetch("https://raw.githubusercontent.com/" + REPO + "/main/investors/version.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (v) { run(v && /^[0-9a-f]{40}$/.test(v.sha) ? v.sha : ""); })
      .catch(function () { run(""); });
  } catch (e) { run(""); }
})();
