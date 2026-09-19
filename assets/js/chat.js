/* Knowledge Assistant chat component.
 * NaturivaChat.mount({ log, form, scope }) wires a conversation to NaturivaEngine.
 * Used by the full assistant page (auto-mounted on #chat-log) and by the
 * floating chat widget (widget.js). Answers explain and point to the book;
 * they never reproduce whole chapters. */
(function () {
  "use strict";
  var ROOT = document.body.getAttribute("data-root") || "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function paras(t) { return String(t).split(/\n\n+/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }
  function list(items, cls) {
    return items && items.length ? '<ul class="' + (cls || "") + '">' + items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>" : "";
  }
  function bookUrl(b) { return ROOT + "books/" + b.slug + ".html"; }
  function articleUrl(id) { return ROOT + "knowledge/" + id + ".html"; }

  function mount(opts) {
    var E = window.NaturivaEngine, KB = window.NATURIVA_KB;
    var log = opts.log, form = opts.form, scope = opts.scope || document;
    if (!E || !log || !form) return null;
    var input = form.querySelector("input");
    var ctx = { history: [], pending: [] };
    var published = new Set(KB.published || []);

    function sourceLine(rec) {
      var titles = rec.book.map(function (id) { return "<em>" + esc(E.book(id).title) + "</em>"; }).join(", ");
      return '<p class="src">Source: ' + titles + (rec.chapter ? " — " + esc(rec.chapter) : "") + "</p>";
    }
    function chips(docs, label) {
      if (!docs || !docs.length) return "";
      return '<div class="also"><span class="also-label">' + esc(label) + "</span>" + docs.map(function (d) {
        var t = d.kind === "customer" ? d.rec.q : d.title;
        return '<button type="button" data-ask="' + esc(t) + '">' + esc(t) + "</button>";
      }).join("") + "</div>";
    }
    function followUp(fu) {
      if (!fu) return "";
      ctx.pending = fu.options;
      return '<div class="follow"><p>' + esc(fu.prompt) + '</p><div class="also">' + fu.options.map(function (o) {
        return '<button type="button" data-follow="' + esc(o.id) + '">' + esc(o.label) + "</button>";
      }).join("") + "</div></div>";
    }
    function learnMore(rec) {
      var b = E.book(rec.book[0]);
      var art = published.has(rec.id) ? ' · <a href="' + articleUrl(rec.id) + '">Open the full article</a>' : "";
      return '<div class="learn"><span class="ans-label">Learn more</span><p>The book goes deeper on this' +
        (rec.chapter ? " in <strong>" + esc(rec.chapter) + "</strong>" : "") + '. <a href="' + bookUrl(b) +
        '" data-track="book_viewed" data-book="' + b.id + '">Explore ' + esc(b.title) + "</a>" + art + "</p></div>";
    }

    function renderKnowledge(res) {
      var r = res.doc.rec, h = "";
      h += '<span class="ans-label">Short answer</span><p class="ans-short">' + esc(r.short_answer) + "</p>";
      if (res.kind === "partial") h += '<p class="gap-note"><strong>What the books don\'t cover:</strong> ' + esc(r.gap) + "</p>";
      h += '<span class="ans-label">Explanation</span>' + paras(r.detailed_answer);
      if (r.practical_guidance && r.practical_guidance.length) h += '<span class="ans-label">What to do</span>' + list(r.practical_guidance, "checks");
      if (r.warnings && r.warnings.length) h += '<div class="ans-warn"><span class="ans-label">Watch out for</span>' + list(r.warnings) + "</div>";
      h += learnMore(r) + sourceLine(r);
      h += followUp(res.followUp);
      if (!res.followUp) ctx.pending = [];
      h += chips((res.alternatives || []).slice(0, 3), "Related:");
      return h;
    }
    function renderGap(res) {
      ctx.pending = [];
      return '<p class="ans-short">' + esc(E.NOT_ENOUGH) + "</p>" +
        '<span class="ans-label">What the books do cover</span>' + paras(res.doc.rec.detailed_answer) +
        "<p>" + esc(E.CONSULT) + "</p>" + chips(res.alternatives, "Related topics:");
    }
    function renderCustomer(res) {
      ctx.pending = [];
      return '<span class="ans-label">About the books</span>' + res.doc.rec.a.replace(/\{ROOT\}/g, ROOT) +
        '<p class="src">Source: the NATURIVA library · <a href="' + ROOT + 'books.html">Browse all books</a></p>';
    }
    function renderIngredient(res) {
      var i = res.doc.rec;
      ctx.pending = [];
      return '<span class="ans-label">' + esc(i.cat) + '</span><p class="ans-short">' + esc(i.n) + (i.inci ? ' <span class="muted">(' + esc(i.inci) + ")</span>" : "") + "</p>" +
        "<p>" + esc(i.fn) + "</p>" + (i.use ? "<p><strong>Used at:</strong> " + esc(i.use) + "</p>" : "") +
        (i.caution ? '<div class="ans-warn"><span class="ans-label">Watch out for</span><p>' + esc(i.caution) + "</p></div>" : "") +
        '<p class="src">Source: ingredient tables in the books · <a href="' + ROOT + 'ingredients.html">Open the ingredient glossary</a></p>';
    }
    function renderBook(res) {
      var b = res.doc.rec;
      ctx.pending = [];
      var first = b.summary.split(". ").slice(0, 2).join(". ").replace(/\.?$/, ".");
      return '<p class="ans-short">' + esc(b.title) + " is the most relevant starting point.</p><p>" + esc(first) + "</p>" +
        '<div class="book-card"><div><p class="ans-label">' + esc(b.series) + " · " + esc(b.short) + "</p><strong>" + esc(b.title) + "</strong><p>" + esc(b.tagline) +
        '</p></div><a class="btn" href="' + bookUrl(b) + '" data-track="book_viewed" data-book="' + b.id + '">Explore the ' + esc(b.short.toLowerCase()) + " book</a></div>" +
        chips(res.alternatives, "A good first question:");
    }
    function renderNone(res) {
      ctx.pending = [];
      var h = '<p class="ans-short">' + esc(E.NOT_ENOUGH) + "</p>";
      if (res.consult) h += "<p>" + esc(res.consult) + "</p>";
      if (res.alternatives && res.alternatives.length) h += chips(res.alternatives, "The books do cover:");
      else h += "<p>Try asking about soapmaking, skincare formulation, ingredients or candle making.</p>";
      return h;
    }
    var RENDER = { knowledge: renderKnowledge, partial: renderKnowledge, gap: renderGap, customer: renderCustomer, ingredient: renderIngredient, book: renderBook, none: renderNone };

    function add(html, who) {
      var el = document.createElement("div");
      el.className = "msg " + who;
      el.innerHTML = who === "bot" ? '<div class="bubble">' + html + "</div>" : esc(html);
      log.appendChild(el);
      return el;
    }
    function reveal(el) {
      if (opts.scrollInside) log.scrollTop = el.offsetTop - log.offsetTop - 8;
      else el.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }

    function ask(question, forcedId) {
      question = String(question || "").trim();
      if (!question) return;
      reveal(add(question, "user"));
      ctx.history.push({ role: "user", content: question });
      window.naturivaTrack && naturivaTrack("knowledge_question_submitted", { question: question, surface: opts.surface || "page" });
      var thinking = add('<span class="typing">Looking through the books…</span>', "bot");
      var forced = forcedId && E.byId(forcedId);
      var p = forced
        ? Promise.resolve({ kind: forced.kind, doc: forced, alternatives: (forced.rec.related_topics || []).map(E.byId).filter(Boolean), followUp: forced.rec.follow_up || null })
        : E.ask(question, ctx);
      p.then(function (res) {
        setTimeout(function () {
          thinking.querySelector(".bubble").innerHTML = (RENDER[res.kind] || renderNone)(res);
          reveal(thinking);
          ctx.history.push({ role: "assistant", content: res.doc ? res.doc.id : "none" });
          window.naturivaTrack && naturivaTrack("knowledge_answer_viewed", { kind: res.kind, id: res.doc ? res.doc.id : null });
        }, 280);
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = input.value;
      input.value = "";
      ask(v);
    });
    scope.addEventListener("click", function (e) {
      var a = e.target.closest("[data-ask]");
      if (a && scope.contains(a)) { ask(a.getAttribute("data-ask")); return; }
      var f = e.target.closest("[data-follow]");
      if (f && scope.contains(f)) ask(f.textContent, f.getAttribute("data-follow"));
    });
    return { ask: ask };
  }

  window.NaturivaChat = { mount: mount };

  // Full assistant page
  var pageLog = document.getElementById("chat-log");
  if (pageLog) {
    var chat = mount({ log: pageLog, form: document.getElementById("chat-form"), scope: document.querySelector(".assistant-page") || document, surface: "page" });
    var q = new URLSearchParams(location.search).get("q");
    if (chat && q) chat.ask(q);
  }
})();
