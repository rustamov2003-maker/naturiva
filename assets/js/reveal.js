/* Quiet scroll reveal. Nothing is hidden without JS, and it is skipped when
   the visitor prefers reduced motion. */
(function () {
  "use strict";
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
  var targets = [];
  document.querySelectorAll(".section > .wrap, .article-main > section, .book-hero-grid > *").forEach(function (el) {
    el.classList.add("reveal"); targets.push(el);
  });
  document.querySelectorAll(".try-grid, .k-grid, .lib-grid, .levels, .principles, .ing-grid").forEach(function (el) {
    el.classList.add("reveal-stagger"); targets.push(el);
  });
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });
  targets.forEach(function (t) { io.observe(t); });
  // Anything already in view when the page loads appears immediately.
  requestAnimationFrame(function () {
    targets.forEach(function (t) { if (t.getBoundingClientRect().top < innerHeight * 0.92) t.classList.add("in"); });
  });
})();
