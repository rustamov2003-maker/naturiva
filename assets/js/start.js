/* Find your starting point: builds a learning path from content/paths.json. */
(function () {
  "use strict";
  var KB = window.NATURIVA_KB;
  var root = document.getElementById("pathfinder");
  if (!KB || !root) return;
  var P = KB.paths;
  var ROOT = document.body.getAttribute("data-root") || "";
  var K = {}; KB.knowledge.forEach(function (k) { K[k.id] = k; });
  var B = {}; KB.books.forEach(function (b) { B[b.id] = b; });
  var published = new Set(KB.published || []);
  var state = { level: null, interest: null };

  var levelBox = root.querySelector("[data-step=level]");
  var interestBox = root.querySelector("[data-step=interest]");
  var result = document.getElementById("path-result");

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function options(box, items, key) {
    box.querySelector(".opts").innerHTML = items.map(function (o) {
      return '<button type="button" class="opt" aria-pressed="false" data-' + key + '="' + o.id + '">' + esc(o.label) + "</button>";
    }).join("");
  }
  options(levelBox, P.levels, "level");
  options(interestBox, P.interests, "interest");

  function select(box, attr, value) {
    box.querySelectorAll(".opt").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-" + attr) === value)); });
  }

  function stepsFor(level, interest) {
    var tracks = P.interest_map[interest] || [interest];
    var seq = P.sequences[level].slice();
    if (P.focus[interest]) {
      // put the focus steps first, keep safety in the path
      seq = P.focus[interest].concat(seq.filter(function (s) { return P.focus[interest].indexOf(s) < 0; }));
    }
    var steps = [];
    if (tracks.length === 1) {
      seq.forEach(function (s) { steps.push({ track: tracks[0], step: P.tracks[tracks[0]][s] }); });
    } else {
      // several crafts: one shared safety step, then the craft-specific steps interleaved
      seq.forEach(function (s) {
        tracks.forEach(function (t) {
          if (s === "safety" && steps.some(function (x) { return x.kind === "safety"; })) return;
          if (level !== "explore" && ["advanced"].indexOf(s) > -1 && t !== tracks[0]) return;
          steps.push({ track: t, step: P.tracks[t][s], kind: s });
        });
      });
    }
    return steps;
  }

  function render() {
    if (!state.level || !state.interest) return;
    var steps = stepsFor(state.level, state.interest);
    var multi = (P.interest_map[state.interest] || [state.interest]).length > 1;
    var html = '<h2 id="path-title">Your learning path</h2><p class="lede">Built from the books. Every step points to a real chapter.</p><ol class="path">';
    steps.forEach(function (x) {
      var s = x.step, b = B[P.tracks[x.track].book];
      var links = s.topics.map(function (id) {
        var k = K[id];
        if (!k) return "";
        var href = published.has(id) ? ROOT + "knowledge/" + id + ".html" : ROOT + "assistant.html?q=" + encodeURIComponent(k.title);
        return '<li><a href="' + href + '">' + esc(k.title) + "</a></li>";
      }).join("");
      html += '<li class="path-step"><div class="path-head"><h3>' + esc(s.title) + (multi ? ' <span class="muted">· ' + esc(b.short) + "</span>" : "") + "</h3>" +
        "<p>" + esc(s.text) + "</p></div>" + '<ul class="path-links">' + links + "</ul>" +
        '<p class="k-src">In the book: <a href="' + ROOT + "books/" + b.slug + '.html">' + esc(b.title) + "</a> — " + esc(s.chapter) + "</p></li>";
    });
    html += "</ol>";
    var tracks = P.interest_map[state.interest] || [state.interest];
    html += '<div class="path-books"><p class="eyebrow">Where this path leads</p><div class="actions">' + tracks.map(function (t) {
      var b = B[P.tracks[t].book];
      return '<a class="btn ghost" href="' + ROOT + "books/" + b.slug + '.html" data-track="book_viewed" data-book="' + b.id + '">Explore ' + esc(b.title) + "</a>";
    }).join("") + '</div><p><button type="button" class="linkish" data-restart>Start over</button></p></div>';
    result.innerHTML = html;
    result.hidden = false;
    result.querySelector("#path-title").focus({ preventScroll: false });
    window.naturivaTrack && naturivaTrack("learning_path_completed", { level: state.level, interest: state.interest });
  }

  root.addEventListener("click", function (e) {
    var l = e.target.closest("[data-level]"), i = e.target.closest("[data-interest]");
    if (l) {
      state.level = l.getAttribute("data-level");
      select(levelBox, "level", state.level);
      interestBox.hidden = false;
      window.naturivaTrack && naturivaTrack("learning_path_started", { level: state.level });
      interestBox.querySelector("h2").focus();
      render();
    }
    if (i) {
      state.interest = i.getAttribute("data-interest");
      select(interestBox, "interest", state.interest);
      render();
    }
  });
  result.addEventListener("click", function (e) {
    if (!e.target.closest("[data-restart]")) return;
    state = { level: null, interest: null };
    select(levelBox, "level", ""); select(interestBox, "interest", "");
    interestBox.hidden = true; result.hidden = true;
    levelBox.querySelector("h2").focus();
  });

  var pre = new URLSearchParams(location.search).get("level");
  if (pre) { var btn = levelBox.querySelector('[data-level="' + pre + '"]'); if (btn) btn.click(); }
})();
