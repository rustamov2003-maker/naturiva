/* Regression test for the knowledge engine: node tests/engine.test.js
   Each case: [question, expected doc id | kind]. Run after editing content/. */
global.window = globalThis;
require("../assets/js/kb.js");
require("../assets/js/engine.js");
const E = window.NaturivaEngine;

const cases = [
  // soap
  ["Why did my soap accelerate?", "why-soap-accelerates"],
  ["my soap batter thickened so fast I couldn't pour it", "why-soap-accelerates"],
  ["How long should soap cure?", "how-long-should-soap-cure"],
  ["Why does my soap need to cure?", "how-long-should-soap-cure"],
  ["What is gel phase?", "what-is-gel-phase"],
  ["What is the difference between cold process and hot process?", "cold-vs-hot-process-soap"],
  ["How do oils affect the final soap?", "how-oils-affect-soap"],
  ["What happens if I use too much fragrance?", "too-much-fragrance"],
  ["Why did my soap develop a white coating?", "soda-ash-white-coating"],
  ["Can I use milk in soap?", "milk-in-soap"],
  ["How do I work with honey?", "honey-in-soap"],
  ["my soap riced", "soap-seized-or-riced"],
  ["is lye dangerous", "lye-safety"],
  // skincare / formulation
  ["What is a macerated oil?", "what-is-a-macerated-oil"],
  ["Why is pH important?", "why-is-ph-important"],
  ["What is the difference between a serum and a cream?", "serum-vs-cream"],
  ["Why did my emulsion separate?", "why-does-my-emulsion-separate"],
  ["What should I do if my formulation separates?", "why-does-my-emulsion-separate"],
  ["How should I approach formulation as a beginner?", "how-to-approach-formulation"],
  ["What are active ingredients?", "what-are-active-ingredients"],
  ["What is the purpose of a hydrosol?", "what-is-a-hydrosol"],
  ["How do I choose a carrier oil?", "choosing-a-carrier-oil"],
  ["What should I know before making skincare products?", "how-to-approach-formulation"],
  ["What's the difference between essential oils and fragrance oils?", "essential-vs-fragrance-oils"],
  ["do creams need preservatives", "do-i-need-a-preservative"],
  ["What does shea butter do?", "ing:"],
  // candles
  ["Why is my candle tunneling?", "why-do-candles-tunnel"],
  ["Why is my candle burning down the middle?", "why-do-candles-tunnel"],
  ["My candle is tunneling.", "why-do-candles-tunnel"],
  ["Why does the wax remain around the sides?", "why-do-candles-tunnel"],
  ["The candle only burns in the center.", "why-do-candles-tunnel"],
  ["Why does my candle have wet spots?", "candle-wet-spots"],
  ["How do I choose a wick?", "how-to-choose-a-wick"],
  ["What's the difference between container wax and pillar wax?", "container-vs-pillar-wax"],
  ["How much fragrance should I use?", "candle-fragrance-load"],
  ["Why is the top of my candle uneven?", "uneven-candle-top"],
  ["Why does my candle have a rough surface?", "uneven-candle-top"],
  ["Why does my candle have frosting?", "candle-frosting"],
  ["How should I prepare a candle before burning it?", "how-to-burn-a-candle"],
  // getting started & books
  ["I'm completely new to soapmaking. Where should I start?", "book"],
  ["I'm a beginner. Where should I start?", "where-to-start-as-a-beginner"],
  ["Which section should I study first as a beginner?", "where-to-start-as-a-beginner"],
  ["I want to learn how to make candles", "book"],
  ["Do I need special equipment?", "equipment-you-need"],
  ["Is this just a recipe book?", "faq:is-this-just-a-recipe-book"],
  ["Who is this book for?", "faq:who-are-the-books-for"],
  ["Which book should I start with?", "faq:which-book-should-i-start-with"],
  // out of scope
  ["How do I make shampoo bars?", "none"],
  ["Can I sell my soap on Etsy without a license?", "faq:can-i-make-products-to-sell"],
  ["What is the capital of France?", "none"],
  ["How do I make lip gloss?", "none"]
];

let pass = 0;
(async () => {
  for (const [q, want] of cases) {
    const r = await E.ask(q, { history: [], pending: [] });
    const got = r.kind === "none" ? "none" : r.kind === "book" ? "book" : r.doc.id;
    const ok = want.endsWith(":") ? got.startsWith(want) : got === want;
    if (ok) pass++;
    console.log((ok ? "  ok  " : "FAIL  ") + q.padEnd(62) + " -> " + got + (ok ? "" : "   (want " + want + ")"));
  }
  // follow-up conversation
  const ctx = { history: [], pending: [] };
  const first = await E.ask("Why is my candle tunneling?", ctx);
  ctx.pending = first.followUp.options;
  const second = await E.ask("The wick.", ctx);
  const fuOk = second.doc && second.doc.id === "how-to-choose-a-wick";
  console.log((fuOk ? "  ok  " : "FAIL  ") + "follow-up 'The wick.' -> " + (second.doc && second.doc.id));
  console.log(`\n${pass + (fuOk ? 1 : 0)}/${cases.length + 1} passed`);
  process.exitCode = pass === cases.length && fuOk ? 0 : 1;
})();
