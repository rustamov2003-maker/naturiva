# NATURIVA: Natural Formulation & Beauty Education

A knowledge platform built around Nigar Rustamova's *The Art Of* books:

- *The Art of Natural Skincare*
- *The Art of Personal Soapmaking*
- *The Big Book of Sweet Dessert Candles*

It's a static site with no framework and no server requirement. Open `index.html` directly, or serve the folder:

```
python -m http.server 8765    # then visit http://127.0.0.1:8765
```

## Editing content

All content lives in `content/`. Edit it, then rebuild:

```
python build.py               # regenerates every page + assets/js/kb.js
node tests/engine.test.js     # assistant regression tests (52 questions)
```

| File | What it holds |
|---|---|
| `content/knowledge/*.json` | One record per topic, with `id`, `title`, `category`, `book`, `chapter`, `keywords`, `question_variations`, `short_answer`, `detailed_answer`, `practical_guidance`, `warnings`, `related_topics` and an optional `follow_up`. `coverage: "partial"` or `"gap"` marks topics the books only partly cover or don't cover; gap topics get no public page, and the assistant says the books don't cover them. |
| `content/customer_faq.json` | Buyer questions ("Is this just a recipe book?", "Which book should I start with?") |
| `content/books.json` | The library. Set `amazon_url` for each book to turn on its **Buy on Amazon** buttons. |
| `content/ingredients.json` | Ingredient glossary |
| `content/paths.json` | "Find your starting point" learning paths |
| `src/pages/*.html` | Hand-written page bodies with a `<!--meta {...}-->` header (title, description, JSON-LD) |

In `build.py`, set `SITE_URL` to the live domain to emit canonical URLs, `og:url` and `sitemap.xml`.

## Site map

- **Home**: the positioning, an interactive formula card, the assistant, free answers, learning paths, the library and the author.
- **Craft pages**: `skincare.html`, `soapmaking.html`, `candles.html`. Each has core ideas, one sample from the book, knowledge cards and a book CTA.
- **Other pages**: `ingredients.html`, `formulation.html` (with a batch scaler), `faq.html` (knowledge base search, buyer FAQ and craft FAQ), `assistant.html`, `start.html`.
- **Book pages**: `books/<slug>.html`. Each has a hero, what you'll learn, who it's for, the full table of contents, topics, sample answers, FAQ, an ask box, why the book exists, and a purchase CTA.
- **Knowledge articles**: `knowledge/<id>.html`, one SEO page per supported topic. Each has a short answer, explanation, what to do, watch out for, the source chapter, related questions and the related book. `knowledge/index.html` is the hub.

## The Knowledge Assistant

`assets/js/engine.js` is an offline, book-grounded matcher. It works in five stages:

1. It normalizes text and maps synonyms to one form (for example, *burning down the middle* matches *tunneling*).
2. It scores each topic against its title, question variations and keywords.
3. It handles follow-ups: after "Would you like to troubleshoot the wick…?", a reply of "The wick." continues the conversation.
4. It detects book intent ("I want to learn candles") and answers with the right book.
5. If nothing matches confidently, it replies: *"The available book material does not provide enough information to answer this reliably."*

### Moving to a real LLM (RAG)

The UI already renders the structured answer shape. For production:

1. Extract the book text, then chunk it by chapter and section, keeping the book and chapter metadata.
2. Create embeddings and load them into a vector store.
3. Build an endpoint that retrieves the top chunks and asks the LLM to answer *only* from them. The endpoint should return the same `Result` shape documented at the top of `engine.js`, including source book and chapter.
4. Set `assistantEndpoint` in `assets/js/config.js`. The local engine stays as the offline fallback.

## Instagram pathways

Every knowledge article has a short, stable URL. Link a post straight to its answer, for example:

- `/knowledge/why-soap-accelerates.html`
- `/knowledge/why-do-candles-tunnel.html`
- `/knowledge/what-is-gel-phase.html`
- `/knowledge/what-is-a-macerated-oil.html`
- `/knowledge/how-to-choose-a-wick.html`

Each article links on to its source chapter, related questions, the assistant and the book. You can also pre-fill the assistant with a question: `/assistant.html?q=Why%20is%20my%20candle%20tunneling%3F`.

## Analytics

`site.js` pushes events to `window.dataLayer`:

- `knowledge_question_submitted`
- `knowledge_answer_viewed`
- `book_viewed`
- `amazon_clicked`
- `faq_opened`
- `search_used`
- `learning_path_started`
- `learning_path_completed`

To connect GTM, GA4 or Plausible, edit `assets/js/config.js`. No credentials are included.

## Source review

Issues found while reviewing the source PDFs are kept in `NOTES-private.md` (local only, not committed).

## Hosting

| Where | What |
|---|---|
| VPS (nginx vhost `naturiva`) | http://naturiva.129.121.111.249.nip.io/ — site in `/var/www/naturiva`, sources in `/srv/naturiva-src`, config in `/etc/nginx/sites-available/naturiva` |
| GitHub Pages (preview) | https://rustamov2003-maker.github.io/naturiva/ |

Run `./deploy.sh` to rebuild and publish to the VPS. `robots.txt` currently asks search engines not to index the site; remove that rule when the real domain goes live.

## To add before launch

- Real cover images and product or ingredient photography. The covers are typographic placeholders; see `.cover` in `style.css`.
- Amazon URLs in `content/books.json`.
- `SITE_URL` in `build.py`.
