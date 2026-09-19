/* Search the knowledge base (FAQ page). */
(function () {
  "use strict";
  var E = window.NaturivaEngine;
  var input = document.getElementById("kb-search");
  var out = document.getElementById("kb-results");
  if (!E || !input || !out) return;
  var ROOT = document.body.getAttribute("data-root") || "";
  var published = new Set((window.NATURIVA_KB || {}).published || []);
  var timer = null, lastTracked = "";

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function card(d) {
    if (d.kind === "customer") {
      return '<article class="k-card"><p class="k-cat">About the books</p><h3><a href="#faq-' + d.id.slice(4) + '" data-open>' + esc(d.rec.q) + "</a></h3></article>";
    }
    if (d.kind === "ingredient") {
      return '<article class="k-card"><p class="k-cat">Ingredient · ' + esc(d.rec.cat) + '</p><h3><a href="' + ROOT + "ingredients.html?q=" + encodeURIComponent(d.rec.n) + '">' + esc(d.rec.n) + "</a></h3><p>" + esc(d.rec.fn) + "</p></article>";
    }
    var r = d.rec;
    var href = published.has(r.id) ? ROOT + "knowledge/" + r.id + ".html" : ROOT + "assistant.html?q=" + encodeURIComponent(r.title);
    return '<article class="k-card"><p class="k-cat">' + esc(r.category) + '</p><h3><a href="' + href + '">' + esc(r.title) + "</a></h3><p>" + esc(r.short_answer) + "</p></article>";
  }

  function run() {
    var q = input.value.trim();
    if (!q) { out.hidden = true; out.innerHTML = ""; return; }
    var results = E.search(q, 9);
    out.hidden = false;
    if (!results.length) {
      out.innerHTML = '<p class="empty">No articles match “' + esc(q) + '”. Try a broader word, or <a href="' + ROOT + "assistant.html?q=" + encodeURIComponent(q) + '">ask the Knowledge Assistant</a>.</p>';
    } else {
      out.innerHTML = '<p class="count">' + results.length + " result" + (results.length === 1 ? "" : "s") + ' for “' + esc(q) + '”</p><div class="k-grid">' +
        results.map(function (r) { return card(r.doc); }).join("") + "</div>";
    }
    if (q !== lastTracked && q.length > 2) { lastTracked = q; window.naturivaTrack && naturivaTrack("search_used", { query: q, results: results.length }); }
  }

  input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 180); });
  document.querySelectorAll("[data-search-term]").forEach(function (b) {
    b.addEventListener("click", function () { input.value = b.getAttribute("data-search-term"); run(); input.focus(); });
  });
  out.addEventListener("click", function (e) {
    var a = e.target.closest("[data-open]");
    if (!a) return;
    var d = document.getElementById(a.getAttribute("href").slice(1));
    if (d) d.open = true;
  });
  var q = new URLSearchParams(location.search).get("q");
  if (q) { input.value = q; run(); }
})();
