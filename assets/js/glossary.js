/* Ingredient glossary: text search + craft filter over server-rendered cards. */
(function () {
  "use strict";
  var input = document.getElementById("ing-search");
  var chips = document.querySelectorAll("[data-dom-filter]");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".ing"));
  var count = document.getElementById("ing-count");
  var empty = document.getElementById("ing-empty");
  if (!input || !cards.length) return;
  var dom = "all";

  function apply() {
    var terms = input.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (c) {
      var okDom = dom === "all" || c.getAttribute("data-dom").split(" ").indexOf(dom) > -1;
      var text = c.getAttribute("data-text");
      var okText = terms.every(function (t) { return text.indexOf(t) > -1; });
      c.hidden = !(okDom && okText);
      if (!c.hidden) shown++;
    });
    count.textContent = shown + " of " + cards.length + " ingredients";
    empty.hidden = shown > 0;
  }

  input.addEventListener("input", apply);
  chips.forEach(function (b) {
    b.addEventListener("click", function () {
      dom = b.getAttribute("data-dom-filter");
      chips.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      apply();
    });
  });
  var q = new URLSearchParams(location.search).get("q");
  if (q) input.value = q;
  apply();
})();
