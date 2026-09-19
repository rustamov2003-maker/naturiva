/* Formula batch scaler (formulation page). */
(function () {
  "use strict";
  var rows = document.getElementById("sc-rows");
  if (!rows) return;
  var target = document.getElementById("sc-target");
  var EXAMPLE = [
    ["Chamomile flower water", 100], ["Deionized water", 20], ["Vegetable glycerin", 3], ["Sodium lactate 60%", 2],
    ["Panthenol", 1], ["Cocamidopropyl betaine", 30], ["Aloe leaf extract (10:1)", 10], ["Coco-glucoside", 5],
    ["Hydrolyzed silk", 5], ["Cranberry extract", 3], ["Betaine", 2], ["Caprylyl glycol", 1.5],
    ["Polysorbate 80", 1.2], ["Geogard Ultra", 1.8], ["Lavender oil", 0.3]
  ];

  function fmt(n) { return (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

  function addRow(name, g) {
    var tr = document.createElement("tr");
    tr.innerHTML = '<td><input type="text" aria-label="Ingredient name"></td>' +
      '<td class="num"><input type="number" min="0" step="0.01" inputmode="decimal" aria-label="Original grams"></td>' +
      '<td class="num pct">–</td><td class="num new">–</td>' +
      '<td><button type="button" class="rm" aria-label="Remove ingredient">×</button></td>';
    tr.querySelector('input[type="text"]').value = name || "";
    tr.querySelector('input[type="number"]').value = g == null ? "" : g;
    rows.appendChild(tr);
    return tr;
  }

  function calc() {
    var list = Array.prototype.slice.call(rows.querySelectorAll("tr"));
    var total = list.reduce(function (s, tr) { return s + (parseFloat(tr.querySelector('input[type="number"]').value) || 0); }, 0);
    var t = parseFloat(target.value) || 0;
    list.forEach(function (tr) {
      var g = parseFloat(tr.querySelector('input[type="number"]').value) || 0;
      var pct = total ? g / total : 0;
      tr.querySelector(".pct").textContent = total ? fmt(pct * 100) : "–";
      tr.querySelector(".new").textContent = total ? fmt(pct * t) : "–";
    });
    document.getElementById("sc-total").textContent = fmt(total) + " g";
    document.getElementById("sc-newtotal").textContent = (total ? fmt(t) : "0") + " g";
  }

  EXAMPLE.forEach(function (r) { addRow(r[0], r[1]); });
  calc();
  rows.addEventListener("input", calc);
  target.addEventListener("input", calc);
  rows.addEventListener("click", function (e) {
    var b = e.target.closest(".rm");
    if (b) { b.closest("tr").remove(); calc(); }
  });
  document.getElementById("sc-add").addEventListener("click", function () { addRow("", null).querySelector("input").focus(); calc(); });
  document.getElementById("sc-clear").addEventListener("click", function () { rows.innerHTML = ""; addRow("", null).querySelector("input").focus(); calc(); });
})();
