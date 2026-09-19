/* Home: the interactive formula card. */
(function () {
  "use strict";
  var card = document.getElementById("formula-card");
  if (!card) return;
  var bar = card.querySelector(".fc-bar");
  var list = card.querySelector(".fc-list");
  var explain = document.getElementById("fc-explain");
  var TEXT = {
    a: "Phase A · Water phase (67.8%). Chamomile flower water is the soothing base; panthenol, sodium lactate and glycerin hydrate. Warm gently to 30–35 °C to dissolve.",
    b: "Phase B · Cleansing base (24.2%). Mild cocamidopropyl betaine and coco-glucoside cleanse without stripping; aloe hydrates. Pour slowly into Phase A so it doesn't foam.",
    c: "Phase C · Actives (6.8%). Cranberry, silk and betaine add care, caprylyl glycol supports the preservative, and polysorbate 80 disperses the lavender oil in water.",
    d: "Phase D · Preservation & scent (1.1%). A broad-spectrum preservative at 1% and lavender oil at 0.17%. Then the pH is brought to 4.5–5.5, matching skin's acid mantle."
  };
  var DEFAULT = explain.textContent;
  var locked = null;

  function show(phase) {
    var on = !!phase;
    bar.classList.toggle("is-focused", on);
    list.classList.toggle("is-focused", on);
    card.querySelectorAll("[data-phase]").forEach(function (el) {
      el.classList.toggle("on", el.getAttribute("data-phase") === phase);
    });
    bar.querySelectorAll(".fc-seg").forEach(function (s) { s.setAttribute("aria-pressed", String(s.getAttribute("data-phase") === phase)); });
    explain.textContent = phase ? TEXT[phase] : DEFAULT;
  }

  bar.querySelectorAll(".fc-seg").forEach(function (seg) {
    var p = seg.getAttribute("data-phase");
    seg.setAttribute("aria-pressed", "false");
    seg.addEventListener("mouseenter", function () { if (!locked) show(p); });
    seg.addEventListener("focus", function () { if (!locked) show(p); });
    seg.addEventListener("click", function () { locked = locked === p ? null : p; show(locked || p); });
  });
  bar.addEventListener("mouseleave", function () { if (!locked) show(null); });
})();
