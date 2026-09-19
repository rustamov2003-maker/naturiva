/* NATURIVA Knowledge Engine (prototype)
 * ---------------------------------------------------------------------------
 * Answers questions from the structured knowledge base in kb.js, which build.py
 * generates from content/*.json. Everything it says comes from the books.
 *
 * Public interface (keep this stable when swapping in a real backend):
 *
 *   NaturivaEngine.ask(question, context) -> Promise<Result>
 *   NaturivaEngine.search(query, limit)   -> Array<{doc, score}>
 *
 *   Result = {
 *     kind: "knowledge" | "partial" | "gap" | "customer" | "ingredient" | "book" | "none",
 *     doc:  the matched record (shape depends on kind),
 *     alternatives: [doc, ...]   // related records worth offering
 *     followUp: { prompt, options: [{label, id}] } | null
 *     notice: string | null      // e.g. the "not enough information" line
 *   }
 *
 * Production path (see README.md): books -> text extraction -> chunking ->
 * embeddings -> vector store -> retrieval -> LLM -> answer + source citation.
 * Set NATURIVA_CONFIG.assistantEndpoint to a URL that accepts
 * POST {question, history} and returns a Result; the UI stays the same and the
 * local matcher below becomes the offline fallback.
 */
(function () {
  "use strict";
  var KB = window.NATURIVA_KB;
  if (!KB) return;

  var NOT_ENOUGH = "The available book material does not provide enough information to answer this reliably.";
  var CONSULT = "You may want to consult a qualified professional or current regulatory guidance.";

  // ---------------------------------------------------------------- text normalisation
  var STOP = new Set(("a an the and or but if of to in on at for with from by about as is are was were be been being " +
    "do does did doing have has had i me my mine we our you your it its this that these those there here what which who whom " +
    "why how when where can could should would will shall may might must just so very really too also than then into onto " +
    "up down out over under again any some all more most other such no not only own same few both each get got make made " +
    "making use using used need want know tell explain please im ive id dont doesnt didnt cant wont whats hows thing things " +
    "way ways something anything help one").split(" "));

  // Synonyms and spelling variants collapse to one canonical token.
  var CANON = {
    tunnelling: "tunnel", tunneling: "tunnel", tunneled: "tunnel", tunnels: "tunnel",
    middle: "center", centre: "center", sides: "side", edges: "edge",
    mould: "mold", moulds: "mold", molds: "mold", pillar: "mold",
    colour: "color", colours: "color", colors: "color", colored: "color", coloured: "color", colorant: "color", colorants: "color", dye: "color", dyes: "color",
    sterilise: "sterilize", sterilising: "sterilize", sterilization: "sterilize", sterilisation: "sterilize", sanitize: "sterilize", disinfect: "sterilize",
    scent: "fragrance", scented: "fragrance", scents: "fragrance", perfume: "fragrance", fo: "fragrance", fragrances: "fragrance",
    eo: "essential", eos: "essential",
    cp: "cold", hp: "hot",
    wicks: "wick", wicking: "wick",
    accelerated: "accelerate", accelerating: "accelerate", acceleration: "accelerate", accelerates: "accelerate", fast: "accelerate", quickly: "accelerate",
    seized: "seize", seizing: "seize", riced: "rice", ricing: "rice", curdled: "rice", curdle: "rice",
    separated: "separate", separating: "separate", separation: "separate", separates: "separate", split: "separate", splitting: "separate",
    emulsify: "emulsion", emulsified: "emulsion", emulsions: "emulsion", emulsifier: "emulsion",
    infused: "macerate", infusion: "macerate", infuse: "macerate", maceration: "macerate", macerated: "macerate", macerates: "macerate",
    curing: "cure", cured: "cure", cures: "cure",
    lotion: "cream", creams: "cream", moisturizer: "cream", moisturiser: "cream",
    naoh: "lye", hydroxide: "lye", caustic: "lye",
    soaps: "soap", soapmaking: "soap", candles: "candle", candlemaking: "candle",
    skincare: "skin", cosmetics: "cosmetic", formulating: "formulation", formulate: "formulation", formula: "formulation", formulas: "formulation", recipe: "formulation", recipes: "formulation",
    preservatives: "preservative", preserve: "preservative", preserved: "preservative", preservation: "preservative",
    actives: "active", hydrosols: "hydrosol",
    beginners: "beginner", newbie: "beginner", novice: "beginner", new: "beginner", starting: "start", begin: "start", started: "start",
    frosted: "frost", frosting: "frost",
    grainy: "grain", gritty: "grain", grains: "grain",
    rancid: "rancidity", oxidize: "rancidity", oxidized: "rancidity", oxidation: "rancidity",
    gelled: "gel", gelling: "gel",
    white: "white", ash: "ash", powder: "powder", coating: "coating", film: "coating", layer: "layer", layers: "layer", layered: "layer",
    oils: "oil", butters: "butter",
    equipment: "tool", tools: "tool", gear: "tool",
    temp: "temperature", temps: "temperature", hot: "hot", heat: "heat",
    burning: "burn", burns: "burn", burned: "burn", burnt: "burn"
  };

  function stem(w) {
    if (CANON[w]) return CANON[w];
    var s = w;
    if (s.length > 5 && /ies$/.test(s)) s = s.slice(0, -3) + "y";
    else if (s.length > 5 && /ing$/.test(s)) s = s.slice(0, -3);
    else if (s.length > 4 && /ed$/.test(s)) s = s.slice(0, -2);
    else if (s.length > 3 && /s$/.test(s) && !/ss$/.test(s)) s = s.slice(0, -1);
    return CANON[s] || s;
  }

  function norm(text) {
    return String(text || "").toLowerCase()
      .replace(/<[^>]+>/g, " ")
      .replace(/[’']/g, "")
      .replace(/%/g, " percent ")
      .replace(/[^a-z0-9°\s-]/g, " ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ").trim();
  }

  function tokens(text) {
    return norm(text).split(" ").filter(function (w) { return w && !STOP.has(w); }).map(stem).filter(function (w) { return w && !STOP.has(w); });
  }

  function set(arr) { return new Set(arr); }

  // ---------------------------------------------------------------- index
  var docs = [];
  var byId = {};
  var booksById = {};
  (KB.books || []).forEach(function (b) { booksById[b.id] = b; });

  function addDoc(d) {
    d._title = set(tokens(d.title));
    d._vars = (d.variations || []).map(function (v) { return set(tokens(v)); });
    d._kwPhrases = (d.keywords || []).map(norm).filter(function (p) { return p.indexOf(" ") > -1; });
    d._kw = set([].concat.apply([], (d.keywords || []).map(tokens)));
    d._body = set(tokens(d.bodyText || ""));
    docs.push(d);
    byId[d.id] = d;
  }

  (KB.knowledge || []).forEach(function (k) {
    addDoc({
      id: k.id, kind: k.coverage === "gap" ? "gap" : (k.coverage === "partial" ? "partial" : "knowledge"),
      title: k.title, variations: k.question_variations, keywords: k.keywords,
      bodyText: k.short_answer + " " + k.detailed_answer, rec: k
    });
  });
  (KB.customer || []).forEach(function (c) {
    addDoc({ id: "faq:" + c.id, kind: "customer", title: c.q, variations: [], keywords: c.keywords, bodyText: c.a, rec: c });
  });
  (KB.ingredients || []).forEach(function (i, n) {
    var name = i.n.replace(/\(.*?\)/g, "");
    addDoc({
      id: "ing:" + n, kind: "ingredient", title: "What does " + name + " do?",
      variations: [name, "what is " + name, name + " benefits"], keywords: [name.toLowerCase().trim()].concat(i.inci ? [i.inci.toLowerCase()] : []),
      bodyText: i.fn + " " + (i.caution || ""), rec: i
    });
  });

  // inverse document frequency over title/variation/keyword tokens
  var df = {};
  docs.forEach(function (d) {
    var all = new Set();
    d._title.forEach(function (t) { all.add(t); });
    d._kw.forEach(function (t) { all.add(t); });
    d._vars.forEach(function (v) { v.forEach(function (t) { all.add(t); }); });
    all.forEach(function (t) { df[t] = (df[t] || 0) + 1; });
  });
  var N = docs.length;
  function idf(t) { return Math.log(1 + N / ((df[t] || 0) + 0.5)); }

  // ---------------------------------------------------------------- scoring
  function score(d, q, qn) {
    var qMass = 0, strong = 0, s = 0;
    q.forEach(function (t) {
      var w = idf(t);
      qMass += w;
      var inTitle = d._title.has(t) || d._vars.some(function (v) { return v.has(t); });
      if (inTitle) { s += 2 * w; strong += w; }
      else if (d._kw.has(t)) { s += 1.6 * w; strong += w; }
      else if (d._body.has(t)) { s += 0.35 * w; }
    });
    d._kwPhrases.forEach(function (p) { if (qn.indexOf(p) > -1) s += 3 + p.split(" ").length; });
    // best whole-question similarity (idf-weighted Jaccard) against title + variations
    var best = 0;
    [d._title].concat(d._vars).forEach(function (v) {
      var inter = 0, uni = 0, seen = new Set();
      q.forEach(function (t) { seen.add(t); if (v.has(t)) inter += idf(t); uni += idf(t); });
      v.forEach(function (t) { if (!seen.has(t)) uni += idf(t); });
      if (uni) best = Math.max(best, inter / uni);
    });
    s += 8 * best;
    var coverage = qMass ? strong / qMass : 0;
    if (d.kind === "ingredient") s *= 0.85; // prefer explanatory topics when both match
    return { s: s, coverage: coverage, sim: best };
  }

  function rank(q, qn) {
    return docs.map(function (d) {
      var r = score(d, q, qn);
      return { doc: d, score: r.s, coverage: r.coverage, sim: r.sim };
    }).filter(function (r) { return r.score > 0; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function confident(r) {
    if (!r) return false;
    return (r.coverage >= 0.5 && r.score >= 5) || r.sim >= 0.45 || (r.coverage >= 0.34 && r.score >= 9);
  }

  // ---------------------------------------------------------------- intents
  var LEARN_RE = /\b(learn|get started|getting started|start|begin|beginning|get into|interested in|want to make|teach me|course|which book|what book|recommend a book)\b/;

  function bookIntent(qn) {
    if (!LEARN_RE.test(qn)) return null;
    var hit = null, hits = 0;
    (KB.books || []).forEach(function (b) {
      var m = b.discovery_keywords.some(function (k) { return new RegExp("\\b" + k + "s?\\b").test(qn); });
      if (m) { hits++; hit = hit || b; }
    });
    return hits === 1 ? hit : null;
  }

  function followUpChoice(qn, ctx) {
    if (!ctx || !ctx.pending || !ctx.pending.length) return null;
    var q = set(tokens(qn));
    if (q.size === 0 || q.size > 6) return null;
    var best = null, bestHits = 0;
    ctx.pending.forEach(function (o) {
      var hits = 0;
      tokens(o.label).forEach(function (t) { if (q.has(t)) hits++; });
      if (hits > bestHits) { bestHits = hits; best = o; }
    });
    return best && byId[best.id] ? byId[best.id] : null;
  }

  function relatedDocs(rec) {
    return (rec.related_topics || []).map(function (id) { return byId[id]; }).filter(Boolean);
  }

  function resultFor(doc, alternatives) {
    var rec = doc.rec;
    return {
      kind: doc.kind,
      doc: doc,
      alternatives: alternatives || (rec.related_topics ? relatedDocs(rec) : []),
      followUp: rec.follow_up || null,
      notice: doc.kind === "gap" ? NOT_ENOUGH : null
    };
  }

  var SENSITIVE_RE = /\b(sell|selling|legal|law|regulat|fda|label|licen|insur|pregnan|breastfeed|baby|child|allerg|eczema|psoriasis|acne|medical|doctor|disease|cure my|treat|spf|sunscreen)\w*/;

  // ---------------------------------------------------------------- local engine
  function localAsk(question, ctx) {
    var qn = norm(question);
    var q = tokens(question);

    var chosen = followUpChoice(qn, ctx);
    if (chosen) return resultFor(chosen);

    var book = bookIntent(qn);
    if (book) {
      var track = KB.paths && KB.paths.tracks[book.id];
      var starter = track ? track.safety.topics.slice(0, 1).concat(track.foundations.topics.slice(0, 3)) : [];
      return {
        kind: "book", doc: { id: "book:" + book.id, kind: "book", rec: book },
        alternatives: starter.map(function (id) { return byId[id]; }).filter(Boolean),
        followUp: null, notice: null
      };
    }

    if (!q.length) return { kind: "none", doc: null, alternatives: [], followUp: null, notice: NOT_ENOUGH };

    var ranked = rank(q, qn);
    var top = ranked[0];
    if (confident(top)) {
      var alts = relatedDocs(top.doc.rec);
      if (!alts.length) alts = ranked.slice(1, 4).map(function (r) { return r.doc; });
      return resultFor(top.doc, alts);
    }
    return {
      kind: "none", doc: null,
      alternatives: ranked.filter(function (r) { return r.doc.kind !== "ingredient" && r.coverage >= 0.2; }).slice(0, 3).map(function (r) { return r.doc; }),
      followUp: null,
      notice: NOT_ENOUGH,
      consult: SENSITIVE_RE.test(qn) ? CONSULT : null
    };
  }

  // ---------------------------------------------------------------- remote engine (future RAG)
  function remoteAsk(question, ctx) {
    var cfg = window.NATURIVA_CONFIG || {};
    return fetch(cfg.assistantEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question, history: (ctx && ctx.history) || [] })
    }).then(function (r) {
      if (!r.ok) throw new Error("Assistant endpoint returned " + r.status);
      return r.json();
    });
  }

  window.NaturivaEngine = {
    NOT_ENOUGH: NOT_ENOUGH,
    CONSULT: CONSULT,
    byId: function (id) { return byId[id] || null; },
    book: function (id) { return booksById[id] || null; },
    ask: function (question, ctx) {
      var cfg = window.NATURIVA_CONFIG || {};
      if (cfg.assistantEndpoint) {
        return remoteAsk(question, ctx).catch(function () { return localAsk(question, ctx); });
      }
      return Promise.resolve(localAsk(question, ctx));
    },
    search: function (query, limit) {
      var q = tokens(query);
      if (!q.length) return [];
      return rank(q, norm(query)).filter(function (r) { return r.coverage >= 0.34 || r.sim >= 0.3; }).slice(0, limit || 12);
    }
  };
})();
