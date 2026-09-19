/* Floating Knowledge Assistant: available on every page.
 * The knowledge base (kb.js, engine.js, chat.js) loads only when the chat is
 * first opened, so pages stay light. A one-time hint appears after a short
 * delay once per browser session; it never opens the chat on its own. */
(function () {
  "use strict";
  if (document.getElementById("chat-log")) return; // the full assistant page has its own chat
  var ROOT = document.body.getAttribute("data-root") || "";
  var SUGGESTIONS = [
    "I'm a beginner. Where should I start?",
    "Why is my candle tunneling?",
    "What is gel phase?",
    "Why is pH important?"
  ];

  var wrap = document.createElement("div");
  wrap.className = "cw";
  wrap.innerHTML =
    '<div class="cw-hint" hidden><button type="button" class="cw-hint-open">Have a question about soap, skincare or candles? <strong>Ask the books.</strong></button>' +
    '<button type="button" class="cw-hint-close" aria-label="Dismiss">×</button></div>' +
    '<section class="cw-panel" id="cw-panel" role="dialog" aria-modal="false" aria-labelledby="cw-title" hidden>' +
      '<header class="cw-head"><div><p class="cw-title" id="cw-title"><span aria-hidden="true">✦</span> Knowledge Assistant</p>' +
      '<p class="cw-sub">Answers from the books, with the chapter to read next</p></div>' +
      '<div class="cw-head-actions"><a href="' + ROOT + 'assistant.html" class="cw-expand">Full screen</a>' +
      '<button type="button" class="cw-close" aria-label="Close chat">×</button></div></header>' +
      '<div class="cw-log chat-log" role="log" aria-live="polite">' +
        '<div class="msg bot"><div class="bubble"><p class="ans-short">What would you like to understand?</p>' +
        '<p>Ask anything about soapmaking, skincare formulation, ingredients or candle making.</p>' +
        '<div class="also">' + SUGGESTIONS.map(function (s) { return '<button type="button" data-ask="' + s.replace(/"/g, "&quot;") + '">' + s + "</button>"; }).join("") + "</div></div></div>" +
      "</div>" +
      '<form class="cw-form chat-form" autocomplete="off"><label class="visually-hidden" for="cw-input">Your question</label>' +
      '<input id="cw-input" type="text" placeholder="Type your question…" enterkeyhint="send"><button class="btn" type="submit">Ask</button></form>' +
    "</section>" +
    '<button type="button" class="cw-launch" aria-controls="cw-panel" aria-expanded="false"><span aria-hidden="true">✦</span> Ask</button>';
  document.body.appendChild(wrap);

  var panel = wrap.querySelector(".cw-panel");
  var launch = wrap.querySelector(".cw-launch");
  var hint = wrap.querySelector(".cw-hint");
  var input = wrap.querySelector("#cw-input");
  var ready = null, pendingQuestion = null, chat = null;

  function load(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = ROOT + "assets/js/" + src;
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  function ensureReady() {
    if (ready) return ready;
    ready = (window.NATURIVA_KB ? Promise.resolve() : load("kb.js"))
      .then(function () { return window.NaturivaEngine ? null : load("engine.js"); })
      .then(function () { return window.NaturivaChat ? null : load("chat.js"); })
      .then(function () {
        chat = window.NaturivaChat.mount({
          log: wrap.querySelector(".cw-log"), form: wrap.querySelector(".cw-form"),
          scope: panel, scrollInside: true, surface: "widget"
        });
        if (pendingQuestion) { chat.ask(pendingQuestion); pendingQuestion = null; }
      });
    return ready;
  }

  function open() {
    hideHint(true);
    panel.hidden = false;
    wrap.classList.add("is-open");
    launch.setAttribute("aria-expanded", "true");
    ensureReady();
    input.focus({ preventScroll: true });
  }
  function close() {
    panel.hidden = true;
    wrap.classList.remove("is-open");
    launch.setAttribute("aria-expanded", "false");
    launch.focus();
  }
  function hideHint(remember) {
    hint.hidden = true;
    if (remember) { try { sessionStorage.setItem("naturiva-hint", "1"); } catch (e) {} }
  }

  launch.addEventListener("click", function () { panel.hidden ? open() : close(); });
  wrap.querySelector(".cw-close").addEventListener("click", close);
  wrap.querySelector(".cw-hint-open").addEventListener("click", open);
  wrap.querySelector(".cw-hint-close").addEventListener("click", function () { hideHint(true); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) close(); });

  // Suggestions typed before the engine finishes loading are queued, not lost.
  panel.addEventListener("click", function (e) {
    var a = e.target.closest("[data-ask]");
    if (a && !chat) { pendingQuestion = a.getAttribute("data-ask"); ensureReady(); }
  });
  wrap.querySelector(".cw-form").addEventListener("submit", function (e) {
    if (chat) return;
    e.preventDefault();
    pendingQuestion = input.value; input.value = "";
    ensureReady();
  });

  // Header "Ask" pill opens the widget instead of leaving the page.
  document.querySelectorAll(".ask-pill").forEach(function (a) {
    a.addEventListener("click", function (e) { e.preventDefault(); open(); });
  });

  var seen = false;
  try { seen = sessionStorage.getItem("naturiva-hint") === "1"; } catch (e) {}
  if (!seen) setTimeout(function () { if (panel.hidden) hint.hidden = false; }, 9000);
})();
