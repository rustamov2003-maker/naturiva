/* Shared behavior: theme, mobile menu, analytics hooks, copy link, FAQ tracking. */
(function () {
  "use strict";
  var cfg = window.NATURIVA_CONFIG || {};

  // ---------------------------------------------------------------- analytics
  window.dataLayer = window.dataLayer || [];
  window.naturivaTrack = function (event, props) {
    var payload = Object.assign({ event: event }, props || {});
    window.dataLayer.push(payload);
    if (cfg.analytics && cfg.analytics.debug) console.info("[naturiva]", payload);
  };
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-track]");
    if (el) window.naturivaTrack(el.getAttribute("data-track"), { book: el.getAttribute("data-book") || undefined });
  });
  document.addEventListener("toggle", function (e) {
    var d = e.target;
    if (d.matches && d.matches("details[data-faq]") && d.open) {
      window.naturivaTrack("faq_opened", { id: d.id });
    }
  }, true);

  // ---------------------------------------------------------------- theme toggle
  var btn = document.querySelector("[data-theme-toggle]");
  var modes = ["auto", "light", "dark"];
  function current() { return document.documentElement.dataset.theme || "auto"; }
  function label() { if (btn) btn.textContent = current().charAt(0).toUpperCase() + current().slice(1); }
  label();
  if (btn) btn.addEventListener("click", function () {
    var next = modes[(modes.indexOf(current()) + 1) % modes.length];
    if (next === "auto") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try { next === "auto" ? localStorage.removeItem("naturiva-theme") : localStorage.setItem("naturiva-theme", next); } catch (err) {}
    label();
  });

  // ---------------------------------------------------------------- mobile menu
  var menuBtn = document.querySelector("[data-menu-toggle]");
  var nav = document.getElementById("main-nav");
  if (menuBtn && nav) {
    menuBtn.addEventListener("click", function () {
      var open = menuBtn.getAttribute("aria-expanded") === "true";
      menuBtn.setAttribute("aria-expanded", String(!open));
      nav.classList.toggle("open", !open);
      menuBtn.textContent = open ? "Menu" : "Close";
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) { menuBtn.click(); menuBtn.focus(); }
    });
  }

  // ---------------------------------------------------------------- copy link
  document.querySelectorAll("[data-copy-link]").forEach(function (b) {
    b.addEventListener("click", function () {
      var done = function () { b.textContent = "Link copied"; setTimeout(function () { b.textContent = "Copy link"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(location.href).then(done, function () { b.textContent = "Copy the address bar"; });
      else b.textContent = "Copy the address bar";
    });
  });

  // ---------------------------------------------------------------- open FAQ from hash
  if (location.hash) {
    var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target && target.tagName === "DETAILS") target.open = true;
  }
})();
