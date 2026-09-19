"""Build the NATURIVA static site.

    python build.py

Inputs
  content/knowledge/*.json   structured knowledge base (one record per topic)
  content/customer_faq.json  buyer questions about the books
  content/books.json         the library (titles, contents, Amazon links)
  content/ingredients.json   ingredient glossary
  content/paths.json         "Find your starting point" learning paths
  src/pages/*.html           hand-written page bodies with a <!--meta {...}--> header

Outputs (written next to this file)
  *.html                     top-level pages
  books/<slug>.html          one page per book
  knowledge/index.html       knowledge hub
  knowledge/<id>.html        one article per supported topic
  assets/js/kb.js            the data the assistant and search run on
  sitemap.xml                only when SITE_URL is set
"""
import html
import itertools
import json
import re
from urllib.parse import quote
from pathlib import Path

ROOT = Path(__file__).parent
CONTENT = ROOT / "content"
SRC = ROOT / "src" / "pages"

# ---------------------------------------------------------------- site config
# Set SITE_URL to the live domain (e.g. "https://www.example.com") to emit
# canonical URLs, og:url and sitemap.xml. Left empty, they are omitted.
SITE_URL = ""
SITE_NAME = "NATURIVA"
TAGLINE = "Natural Formulation & Beauty Education"
SLOGAN = "More Than Recipes. A Better Understanding of Natural Beauty."
AUTHOR = "Nigar Rustamova"

NAV = [
    ("skincare", "skincare.html", "Natural Skincare"),
    ("soapmaking", "soapmaking.html", "Soapmaking"),
    ("candles", "candles.html", "Candle Making"),
    ("ingredients", "ingredients.html", "Ingredients"),
    ("formulation", "formulation.html", "Formulation"),
    ("books", "books.html", "Books"),
    ("faq", "faq.html", "FAQ"),
    ("assistant", "assistant.html", "AI Knowledge Assistant"),
]

CATEGORY_ORDER = ["Getting Started", "Safety", "Soapmaking", "Natural Skincare", "Formulation", "Ingredients", "Candle Making"]
CATEGORY_HUB = {
    "Soapmaking": "soapmaking.html", "Natural Skincare": "skincare.html", "Formulation": "formulation.html",
    "Ingredients": "ingredients.html", "Candle Making": "candles.html",
}


def load(name):
    return json.loads((CONTENT / name).read_text(encoding="utf-8"))


knowledge = []
for f in sorted((CONTENT / "knowledge").glob("*.json")):
    knowledge += json.loads(f.read_text(encoding="utf-8"))
K = {k["id"]: k for k in knowledge}
customer = load("customer_faq.json")
books = load("books.json")
B = {b["id"]: b for b in books}
ingredients = load("ingredients.json")
images = load("images.json")
paths = load("paths.json")

# Topics the books don't cover get no public article (they'd be thin pages);
# the assistant still knows about them so it can say so honestly.
PUBLISHED = [k for k in knowledge if k.get("coverage") != "gap"]


def esc(s):
    return html.escape(str(s), quote=True)


def strip_tags(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip()


def paras(text):
    return "".join(f"<p>{esc(p.strip())}</p>" for p in text.split("\n\n") if p.strip())


def book_url(bid, root):
    return f"{root}books/{B[bid]['slug']}.html"


def article_url(kid, root):
    return f"{root}knowledge/{kid}.html"


def book_names(k):
    return " · ".join(B[b]["title"] for b in k["book"])


def source_line(k):
    parts = [f"<em>{esc(B[b]['title'])}</em>" for b in k["book"]]
    ch = k.get("chapter")
    return f"Source: {', '.join(parts)}" + (f" — {esc(ch)}" if ch else "")


def amazon_button(b, root, cls="btn"):
    if b.get("amazon_url"):
        return (f'<a class="{cls} amazon" href="{esc(b["amazon_url"])}" target="_blank" rel="noopener sponsored" '
                f'data-track="amazon_clicked" data-book="{b["id"]}">Buy on Amazon</a>')
    return (f'<span class="{cls} is-disabled" aria-disabled="true" title="The Amazon listing will be linked here once it is live">'
            f'Amazon listing coming soon</span>')


def cover(b, root, size=""):
    sub = f'<span class="cv-sub">{esc(b.get("subtitle", ""))}</span>' if b.get("subtitle") else ""
    return (f'<div class="cover {size}" style="--c:{b["color"]}" aria-hidden="true">'
            f'<span class="cv-series">{esc(b["series"])}</span>'
            f'<span class="cv-title">{esc(b["title"].replace("The Art of ", ""))}</span>{sub}'
            f'<span class="cv-author">{esc(b["author"])}</span></div>')



def banner(slot, root, cls="banner"):
    """Responsive <picture> for an image prepared by tools/images.py."""
    spec = images.get(slot)
    if not spec:
        return ""
    base = f"{root}assets/img/{slot}"
    return (f'<figure class="{cls}">'
            f'<picture>'
            f'<source type="image/webp" sizes="100vw" srcset="{base}-800.webp 800w, {base}-1200.webp 1200w, {base}-2400.webp 2400w">'
            f'<img src="{base}-1200.jpg" srcset="{base}-800.jpg 800w, {base}-1200.jpg 1200w, {base}-2400.jpg 2400w" sizes="100vw" '
            f'alt="{esc(spec["alt"])}" loading="lazy" decoding="async" width="2400" height="1340">'
            f'</picture></figure>')

# ---------------------------------------------------------------- reusable blocks
_ask_ids = itertools.count(1)


def ask_box(root, placeholder="Ask a question, e.g. “Why is my candle tunneling?”", suggestions=None):
    n = next(_ask_ids)
    chips = ""
    if suggestions:
        chips = '<div class="ask-chips">' + "".join(
            f'<a class="chip-link" href="{root}assistant.html?q={quote(s)}">{esc(s)}</a>' for s in suggestions) + "</div>"
    return f"""<form class="ask-box" action="{root}assistant.html" method="get" role="search" data-ask-form>
  <label class="visually-hidden" for="ask-{n}">Ask the Knowledge Assistant</label>
  <input id="ask-{n}" name="q" type="text" autocomplete="off" placeholder="{esc(placeholder)}" required>
  <button class="btn" type="submit">Ask</button>
</form>{chips}"""


def knowledge_card(k, root, heading="h3"):
    return (f'<article class="k-card"><p class="k-cat">{esc(k["category"])}</p>'
            f'<{heading}><a href="{article_url(k["id"], root)}">{esc(k["title"])}</a></{heading}>'
            f'<p>{esc(k["short_answer"])}</p>'
            f'<p class="k-src">{esc(book_names(k))}</p></article>')


def try_block(ids, root, heading="Try the knowledge"):
    cards = []
    for kid in ids:
        k = K[kid]
        b = B[k["book"][0]]
        cards.append(f"""<article class="try">
  <p class="eyebrow">Free answer · {esc(k["category"])}</p>
  <h3>{esc(k["title"])}</h3>
  <p>{esc(k["short_answer"])}</p>
  <p class="try-links"><a href="{article_url(kid, root)}">Read the full answer</a><span aria-hidden="true"> · </span><a href="{book_url(b['id'], root)}">Go deeper in {esc(b["short"])}</a></p>
</article>""")
    return f'<div class="try-grid">{"".join(cards)}</div>'


def faq_details(items, root):
    """items: list of (question, answer_html, anchor)"""
    out = ['<div class="faq">']
    for q, a, anchor in items:
        out.append(f'<details id="{anchor}" data-faq><summary>{esc(q)}</summary><div class="a">{a.replace("{ROOT}", root)}</div></details>')
    out.append("</div>")
    return "".join(out)


def knowledge_answer_html(k, root):
    """Full answer body for FAQ accordions."""
    s = f'<p><strong>{esc(k["short_answer"])}</strong></p>{paras(k["detailed_answer"])}'
    s += f'<p class="k-src">{source_line(k)} · <a href="{article_url(k["id"], root)}">Open the article</a></p>'
    return s


# ---------------------------------------------------------------- generated sections for src pages
def faq_page_blocks(root):
    cust = faq_details([(c["q"], c["a"], "faq-" + c["id"]) for c in customer], root)
    groups = []
    for cat in CATEGORY_ORDER:
        items = [k for k in PUBLISHED if k.get("faq") and k["category"] == cat]
        if not items:
            continue
        cid = re.sub(r"[^a-z]+", "-", cat.lower())
        groups.append(f'<section class="faq-group" id="{cid}" aria-labelledby="h-{cid}"><h3 id="h-{cid}">{esc(cat)}</h3>'
                      + faq_details([(k["title"], knowledge_answer_html(k, root), k["id"]) for k in items], root)
                      + "</section>")
    return cust, "\n".join(groups)


def faq_jsonld():
    ents = [{"@type": "Question", "name": c["q"],
             "acceptedAnswer": {"@type": "Answer", "text": strip_tags(c["a"].replace("{ROOT}", ""))}} for c in customer]
    ents += [{"@type": "Question", "name": k["title"],
              "acceptedAnswer": {"@type": "Answer", "text": k["short_answer"] + " " + k["detailed_answer"].replace("\n\n", " ")}}
             for k in PUBLISHED if k.get("faq")]
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": ents}


DOM_LABEL = {"skincare": "Skincare", "soap": "Soap", "candles": "Candles"}


def glossary_html():
    out = []
    for i in sorted(ingredients, key=lambda x: x["n"].lower()):
        text = " ".join([i["n"], i.get("inci", ""), i["cat"], i["fn"], i.get("use", ""), i.get("caution", "")])
        out.append(f'<article class="ing" data-dom="{" ".join(i["dom"])}" data-text="{esc(text.lower())}">')
        out.append(f'<p class="cat">{esc(i["cat"])} · {" · ".join(DOM_LABEL[d] for d in i["dom"])}</p>')
        out.append(f'<h3>{esc(i["n"])}</h3>')
        if i.get("inci"):
            out.append(f'<p class="inci">{esc(i["inci"])}</p>')
        out.append(f'<p>{esc(i["fn"])}</p>')
        if i.get("use"):
            out.append(f'<p class="use"><span>Used at</span> {esc(i["use"])}</p>')
        if i.get("caution"):
            out.append(f'<p class="caution">{esc(i["caution"])}</p>')
        out.append("</article>")
    return "\n".join(out)


def library_cards(root):
    out = []
    for b in books:
        topics = "".join(f"<li>{esc(t)}</li>" for t in b["topics"][:6])
        out.append(f"""<article class="lib-card" id="{b['short'].lower().replace(' ', '-')}">
  <a class="lib-cover" href="{book_url(b['id'], root)}" tabindex="-1">{cover(b, root)}</a>
  <div class="lib-body">
    <p class="eyebrow">{esc(b['series'])} · {esc(b['short'])}</p>
    <h3><a href="{book_url(b['id'], root)}">{esc(b['title'])}</a></h3>
    <p>{esc(b['tagline'])}</p>
    <p class="lib-for"><strong>For:</strong> {esc(b['who_for'][0])}</p>
    <ul class="topic-list">{topics}</ul>
    <div class="lib-actions"><a class="btn" href="{book_url(b['id'], root)}" data-track="book_viewed" data-book="{b['id']}">Explore the book</a>{amazon_button(b, root, "btn ghost")}</div>
  </div>
</article>""")
    return "\n".join(out)


def hub_topics(category, root, extra=()):
    items = [k for k in PUBLISHED if k["category"] == category or k["id"] in extra]
    return '<div class="k-grid">' + "".join(knowledge_card(k, root) for k in items) + "</div>"


def knowledge_hub_body(root):
    sections = []
    for cat in CATEGORY_ORDER:
        items = [k for k in PUBLISHED if k["category"] == cat]
        if not items:
            continue
        cid = re.sub(r"[^a-z]+", "-", cat.lower())
        links = "".join(
            f'<li><a href="{article_url(k["id"], root)}">{esc(k["title"])}</a><span>{esc(k["short_answer"])}</span></li>'
            for k in items)
        sections.append(f'<section class="hub-cat" id="{cid}"><h2>{esc(cat)}</h2><ul class="hub-list">{links}</ul></section>')
    return "\n".join(sections)


BLOCK_FUNCS = {
    "LIBRARY": library_cards,
    "GLOSSARY": lambda root: glossary_html(),
    "INGREDIENT_COUNT": lambda root: str(len(ingredients)),
    "TOPIC_COUNT": lambda root: str(len(PUBLISHED)),
    "FAQ_CUSTOMER": lambda root: faq_page_blocks(root)[0],
    "FAQ_KNOWLEDGE": lambda root: faq_page_blocks(root)[1],
    "HUB_SOAP": lambda root: hub_topics("Soapmaking", root, ("lye-safety",)),
    "HUB_SKIN": lambda root: hub_topics("Natural Skincare", root),
    "HUB_FORMULATION": lambda root: hub_topics("Formulation", root),
    "HUB_CANDLES": lambda root: hub_topics("Candle Making", root, ("candle-safety",)),
    "HUB_INGREDIENTS": lambda root: hub_topics("Ingredients", root),
    "TRY_HOME": lambda root: try_block(["why-soap-accelerates", "why-do-candles-tunnel", "what-is-a-macerated-oil"], root),
    "TRY_SOAP": lambda root: try_block(B["soap"]["try"], root),
    "TRY_SKIN": lambda root: try_block(B["skin"]["try"], root),
    "TRY_CANDLES": lambda root: try_block(B["candles"]["try"], root),
    "ASK_BOX": lambda root: ask_box(root),
    "AMAZON_SOAP": lambda root: amazon_button(B["soap"], root),
    "AMAZON_SKIN": lambda root: amazon_button(B["skin"], root),
    "AMAZON_CANDLES": lambda root: amazon_button(B["candles"], root),
    "COVER_SOAP": lambda root: cover(B["soap"], root, "sm"),
    "COVER_SKIN": lambda root: cover(B["skin"], root, "sm"),
    "COVER_CANDLES": lambda root: cover(B["candles"], root, "sm"),
}


BANNER_RE = re.compile(r"\{\{BANNER:([a-z0-9-]+)\}\}")


def render_blocks(body, root):
    body = BANNER_RE.sub(lambda m: banner(m.group(1), root), body)
    for key, fn in BLOCK_FUNCS.items():
        token = "{{" + key + "}}"
        if token in body:
            body = body.replace(token, fn(root))
    return body.replace("{ROOT}", root)


# ---------------------------------------------------------------- layout
def url_for(rel):
    if not SITE_URL:
        return ""
    return SITE_URL.rstrip("/") + "/" + ("" if rel == "index.html" else rel)


def head(meta, rel, root):
    title, desc = meta["title"], meta["description"]
    tags = [
        f"<title>{esc(title)}</title>",
        f'<meta name="description" content="{esc(desc)}">',
        '<meta name="theme-color" content="#f1f3ee">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        f'<meta property="og:type" content="{meta.get("og_type", "website")}">',
        f'<meta property="og:title" content="{esc(meta.get("og_title", title))}">',
        f'<meta property="og:description" content="{esc(meta.get("og_description", desc))}">',
        '<meta property="og:locale" content="en_US">',
        '<meta name="twitter:card" content="summary_large_image">' if meta.get("og_image") else '<meta name="twitter:card" content="summary">',
        f'<link rel="icon" href="{root}assets/img/favicon.svg" type="image/svg+xml">',
        f'<link rel="preload" href="{root}assets/fonts/YoungSerif-400-latin.woff2" as="font" type="font/woff2" crossorigin>',
        f'<link rel="preload" href="{root}assets/fonts/InstrumentSans-400-latin.woff2" as="font" type="font/woff2" crossorigin>',
        f'<link rel="stylesheet" href="{root}assets/css/fonts.css">',
        f'<link rel="stylesheet" href="{root}assets/css/style.css">',
    ]
    if meta.get("og_image") in images:
        img = f'{root}assets/img/{meta["og_image"]}-1200.jpg'
        if SITE_URL:
            img = SITE_URL.rstrip("/") + "/" + img.replace(root, "", 1)
        tags.append(f'<meta property="og:image" content="{img}">')
        tags.append(f'<meta property="og:image:alt" content="{esc(images[meta["og_image"]]["alt"])}">')
    if SITE_URL:
        tags += [f'<link rel="canonical" href="{url_for(rel)}">', f'<meta property="og:url" content="{url_for(rel)}">']
    for block in meta.get("jsonld", []):
        tags.append('<script type="application/ld+json">' + json.dumps(block, ensure_ascii=False) + "</script>")
    return "\n".join(tags)


def header(active, root):
    items = []
    for key, href, label in NAV:
        cur = ' aria-current="page"' if key == active else ""
        cls = ' class="ai"' if key == "assistant" else ""
        items.append(f'<li><a href="{root}{href}"{cls}{cur}>{label}</a></li>')
    return f"""<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-row">
    <a class="brand" href="{root}index.html" aria-label="NATURIVA home">
      <span class="brand-name">NATURIVA<span class="dot">.</span></span>
      <span class="brand-sub">{TAGLINE}</span>
    </a>
    <div class="head-actions">
      <a class="ask-pill" href="{root}assistant.html"><span aria-hidden="true">✦</span> Ask</a>
      <button class="theme-btn" type="button" data-theme-toggle aria-label="Switch color theme">Auto</button>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="main-nav" data-menu-toggle>Menu</button>
    </div>
  </div>
  <nav class="main-nav" id="main-nav" aria-label="Main">
    <div class="wrap"><ul>{''.join(items)}</ul></div>
  </nav>
</header>"""


def footer(root):
    nav = "".join(f'<li><a href="{root}{h}">{l}</a></li>' for _, h, l in NAV)
    lib = "".join(f'<li><a href="{book_url(b["id"], root)}">{esc(b["title"])}</a></li>' for b in books)
    return f"""<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <span class="brand-name">NATURIVA<span class="dot">.</span></span>
        <p class="slogan">{SLOGAN}</p>
        <p class="foot-note">Educational content from the books of {AUTHOR}.</p>
      </div>
      <div><p class="eyebrow">Explore</p><ul>{nav}</ul></div>
      <div><p class="eyebrow">Library</p><ul>{lib}
        <li><a href="{root}knowledge/index.html">All knowledge articles</a></li>
        <li><a href="{root}start.html">Find your starting point</a></li></ul></div>
    </div>
    <p class="fine">Everything on this site is drawn from the books and shared for learning. Follow the safety protocol, patch test every product, and run every soap recipe through a lye calculator. Products made for sale need additional testing and must meet the regulations in your market.</p>
  </div>
</footer>"""


def page(meta, body, rel):
    depth = rel.count("/")
    root = "../" * depth
    scripts = []
    if meta.get("kb"):
        scripts += ["kb.js", "engine.js"]
    scripts += ["site.js"] + meta.get("scripts", []) + ["widget.js"]
    script_tags = "\n".join(f'<script src="{root}assets/js/{s}" defer></script>' for s in scripts)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head(meta, rel, root)}
<script>try{{var t=localStorage.getItem("naturiva-theme");if(t)document.documentElement.dataset.theme=t}}catch(e){{}}</script>
<script src="{root}assets/js/config.js"></script>
</head>
<body data-root="{root}" data-page="{esc(meta.get('nav') or rel)}">
{header(meta.get("nav"), root)}
<main id="main">
{render_blocks(body, root)}
</main>
{footer(root)}
{script_tags}
</body>
</html>
"""


def write(rel, html_text):
    out = ROOT / rel
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html_text, encoding="utf-8")


# ---------------------------------------------------------------- generated pages
def build_article(k):
    root = "../"
    b0 = B[k["book"][0]]
    guidance = "".join(f"<li>{esc(g)}</li>" for g in k.get("practical_guidance", []))
    warnings = "".join(f"<li>{esc(w)}</li>" for w in k.get("warnings", []))
    related = [K[r] for r in k.get("related_topics", []) if r in K and K[r].get("coverage") != "gap"]
    rel_html = "".join(f'<li><a href="{r["id"]}.html">{esc(r["title"])}</a></li>' for r in related)
    partial = ""
    if k.get("coverage") == "partial":
        partial = f'<p class="note-inline"><strong>What the books don\'t cover:</strong> {esc(k["gap"])}</p>'
    hub = CATEGORY_HUB.get(k["category"])
    crumbs = f'<a href="index.html">Knowledge</a> <span aria-hidden="true">/</span> ' + (
        f'<a href="{root}{hub}">{esc(k["category"])}</a>' if hub else esc(k["category"]))
    q = quote(k["title"])
    body = f"""<article class="article">
<div class="wrap article-grid">
  <div class="article-main">
    <nav class="crumbs" aria-label="Breadcrumb">{crumbs}</nav>
    <h1>{esc(k["title"])}</h1>
    <div class="short-answer"><p class="eyebrow">Short answer</p><p>{esc(k["short_answer"])}</p></div>
    {partial}
    <section aria-labelledby="h-expl"><h2 id="h-expl">Explanation</h2>{paras(k["detailed_answer"])}</section>
    {f'<section aria-labelledby="h-do"><h2 id="h-do">What to do</h2><ul class="checks">{guidance}</ul></section>' if guidance else ''}
    {f'<aside class="safety" aria-labelledby="h-warn"><h2 id="h-warn">Watch out for</h2><ul>{warnings}</ul></aside>' if warnings else ''}
    <p class="k-src">{source_line(k)}</p>
    <div class="article-tools">
      <a class="btn" href="{root}assistant.html?q={q}">Ask a follow-up question</a>
      <button class="btn ghost" type="button" data-copy-link>Copy link</button>
    </div>
  </div>
  <aside class="article-side">
    <div class="side-book">
      <p class="eyebrow">Learn more</p>
      <a href="{book_url(b0['id'], root)}">{cover(b0, root, "sm")}</a>
      <p>This topic is covered in <strong>{esc(b0["title"])}</strong>{f", in {esc(k['chapter'])}" if k.get("chapter") else ""}.</p>
      <a class="btn ghost" href="{book_url(b0['id'], root)}" data-track="book_viewed" data-book="{b0['id']}">Explore the book</a>
    </div>
    {f'<div class="side-related"><p class="eyebrow">Related questions</p><ul>{rel_html}</ul></div>' if rel_html else ''}
  </aside>
</div>
</article>"""
    meta = {
        "title": f"{k['title']} | NATURIVA",
        "description": k["short_answer"][:155],
        "og_type": "article",
        "nav": None,
        "jsonld": [
            {"@context": "https://schema.org", "@type": "Article", "headline": k["title"],
             "description": k["short_answer"], "inLanguage": "en",
             "author": {"@type": "Person", "name": AUTHOR},
             "isBasedOn": [{"@type": "Book", "name": B[b]["title"], "author": {"@type": "Person", "name": AUTHOR}} for b in k["book"]],
             "publisher": {"@type": "Organization", "name": SITE_NAME}},
            {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Knowledge", **({"item": url_for("knowledge/index.html")} if SITE_URL else {})},
                {"@type": "ListItem", "position": 2, "name": k["title"]}]},
        ],
    }
    write(f"knowledge/{k['id']}.html", page(meta, body, f"knowledge/{k['id']}.html"))


def build_book(b):
    root = "../"
    rel = f"books/{b['slug']}.html"
    learn = "".join(f"<li>{esc(x)}</li>" for x in b["learn"])
    who = "".join(f"<li>{esc(x)}</li>" for x in b["who_for"])
    inside = "".join(
        f'<div class="toc-part"><h3>{esc(p["part"])}</h3><ol>' + "".join(f"<li>{esc(c)}</li>" for c in p["chapters"]) + "</ol></div>"
        for p in b["inside"])
    topics = "".join(f'<li>{esc(t)}</li>' for t in b["topics"])
    faqs = faq_details([(K[i]["title"], knowledge_answer_html(K[i], root), i) for i in b["faq_ids"]], root)
    suggestions = [K[i]["title"] for i in b["try"]]
    sub = f'<p class="book-subtitle">{esc(b["subtitle"])}</p>' if b.get("subtitle") else ""
    body = f"""<section class="book-hero">
  <div class="wrap book-hero-grid">
    <div>{cover(b, root, "lg")}</div>
    <div>
      <p class="eyebrow">{esc(b["series"])} series · by {esc(b["author"])}</p>
      <h1>{esc(b["title"])}</h1>{sub}
      <p class="lede">{esc(b["tagline"])}</p>
      <p>{esc(b["summary"])}</p>
      <p class="book-meta">English · {esc(b["pages"])}</p>
      <div class="actions">{amazon_button(b, root)}<a class="btn ghost" href="#ask">Ask about this book</a></div>
    </div>
  </div>
</section>
<section class="section"><div class="wrap split">
  <div><h2>What you'll learn</h2><ul class="checks">{learn}</ul></div>
  <div><h2>Who it's for</h2><ul class="plain">{who}</ul></div>
</div></section>
<section class="section"><div class="wrap">
  <h2>Inside the book</h2>
  <p class="lede">The complete table of contents.</p>
  <div class="toc-grid">{inside}</div>
</div></section>
<section class="section"><div class="wrap">
  <h2>Topics covered</h2>
  <ul class="topic-list lg">{topics}</ul>
</div></section>
<section class="section tinted"><div class="wrap">
  <p class="eyebrow">Sample educational content</p>
  <h2>Try the knowledge</h2>
  <p class="lede">Real questions, answered from the book. The full chapters go further.</p>
  {try_block(b["try"], root)}
</div></section>
<section class="section"><div class="wrap narrow">
  <h2>Frequently asked questions</h2>
  {faqs}
</div></section>
<section class="section" id="ask"><div class="wrap narrow">
  <p class="eyebrow">✦ AI Knowledge Assistant</p>
  <h2>Ask about {esc(b["short"].lower())}</h2>
  <p class="lede">Get an answer grounded in the books, with the chapter to read next.</p>
  {ask_box(root, "Ask a question about " + b["short"].lower(), suggestions)}
</div></section>
<section class="section"><div class="wrap narrow">
  <h2>Why this book exists</h2>
  <p class="why">{esc(b["why"])}</p>
</div></section>
<section class="section buy"><div class="wrap buy-row">
  <div>{cover(b, root, "sm")}</div>
  <div>
    <h2>{esc(b["title"])}</h2>
    <p>Complete, structured knowledge: every chapter, formula and troubleshooting note.</p>
    <div class="actions">{amazon_button(b, root)}<a class="btn ghost" href="{root}books.html">Back to the library</a></div>
  </div>
</div></section>"""
    meta = {
        "title": f"{b['title']} by {b['author']} | NATURIVA",
        "description": b["summary"][:155].rsplit(" ", 1)[0] + "…",
        "og_type": "book",
        "nav": "books",
        "jsonld": [{"@context": "https://schema.org", "@type": "Book", "name": b["title"],
                    **({"alternativeHeadline": b["subtitle"]} if b.get("subtitle") else {}),
                    "author": {"@type": "Person", "name": b["author"]}, "inLanguage": "en",
                    "description": b["summary"], "about": b["topics"],
                    **({"url": url_for(rel)} if SITE_URL else {})}],
    }
    write(rel, page(meta, body, rel))


def build_knowledge_hub():
    rel = "knowledge/index.html"
    body = f"""<section class="page-hero"><div class="wrap">
  <p class="eyebrow">Knowledge</p>
  <h1>Every answer, one place.</h1>
  <p class="lede">{len(PUBLISHED)} questions answered from the books, from lye safety to wick sizing. Each article links to the chapter where the book goes deeper.</p>
  {ask_box(root="../")}
</div></section>
<div class="wrap hub">{knowledge_hub_body("../")}</div>"""
    meta = {"title": "Knowledge Articles: Soapmaking, Skincare Formulation & Candle Making | NATURIVA",
            "description": "Clear, book-grounded answers on soapmaking, natural skincare formulation, ingredients and candle making, with the chapter to read next.",
            "nav": None}
    write(rel, page(meta, body, rel))


META_RE = re.compile(r"\A\s*<!--meta\s*(\{.*?\})\s*-->", re.S)


def build():
    built = []
    for src in sorted(SRC.glob("*.html")):
        raw = src.read_text(encoding="utf-8")
        m = META_RE.match(raw)
        if not m:
            raise SystemExit(f"{src.name}: missing <!--meta {{...}} --> header")
        meta = json.loads(m.group(1))
        if meta.pop("faq_jsonld", False):
            meta.setdefault("jsonld", []).append(faq_jsonld())
        write(src.name, page(meta, raw[m.end():].strip(), src.name))
        built.append(src.name)
    for b in books:
        build_book(b)
        built.append(f"books/{b['slug']}.html")
    for k in PUBLISHED:
        build_article(k)
        built.append(f"knowledge/{k['id']}.html")
    build_knowledge_hub()
    built.append("knowledge/index.html")

    kb = {"books": books, "knowledge": knowledge, "customer": customer, "ingredients": ingredients, "paths": paths,
          "published": [k["id"] for k in PUBLISHED]}
    (ROOT / "assets" / "js" / "kb.js").write_text(
        "/* Generated by build.py from content/. Do not edit by hand. */\n"
        "window.NATURIVA_KB = " + json.dumps(kb, ensure_ascii=False) + ";\n", encoding="utf-8")

    if SITE_URL:
        urls = "".join(f"<url><loc>{url_for(p)}</loc></url>" for p in built)
        (ROOT / "sitemap.xml").write_text(
            f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>',
            encoding="utf-8")
    print(f"built {len(built)} pages + assets/js/kb.js")


if __name__ == "__main__":
    build()
