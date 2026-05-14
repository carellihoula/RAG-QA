"""Loads web-based sources into LangChain Documents."""
from langchain_core.documents import Document as LCDocument

SUPPORTED_WEB_TYPES = {'url', 'wikipedia', 'arxiv', 'rss'}


def load_web(source_type: str, url: str) -> tuple[list[LCDocument], str, str]:
    """Returns (docs, source_type, auto_title)."""
    if source_type == 'url':
        return _load_url(url)
    if source_type == 'wikipedia':
        return _load_wikipedia(url)
    if source_type == 'arxiv':
        return _load_arxiv(url)
    if source_type == 'rss':
        return _load_rss(url)
    raise ValueError(f"Unsupported web source type: {source_type}")


def _load_url(url: str) -> tuple[list[LCDocument], str, str]:
    import requests
    from bs4 import BeautifulSoup

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; RAG-QA/1.0)'}
    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.content, 'lxml')
    title_tag = soup.find('title')
    auto_title = title_tag.get_text(strip=True) if title_tag else url

    for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
        tag.decompose()

    main = soup.find('main') or soup.find('article') or soup.find('body') or soup
    text = main.get_text(separator='\n', strip=True)

    return [LCDocument(page_content=text, metadata={'page': 1, 'source': url})], 'url', auto_title


def _load_wikipedia(query: str) -> tuple[list[LCDocument], str, str]:
    import wikipedia as wp
    from urllib.parse import unquote

    # Accept full Wikipedia URL or plain search query
    search_term = query.strip()
    if 'wikipedia.org/wiki/' in search_term:
        search_term = unquote(search_term.split('/wiki/')[-1].replace('_', ' '))

    wp.set_lang('en')
    try:
        page = wp.page(search_term, auto_suggest=True)
    except wp.DisambiguationError as e:
        page = wp.page(e.options[0], auto_suggest=False)
    except wp.PageError:
        # Try without auto_suggest as fallback
        results = wp.search(search_term, results=1)
        if not results:
            raise ValueError(f'Wikipedia page not found: {query}')
        page = wp.page(results[0], auto_suggest=False)

    # Split into sections so page metadata makes sense
    sections = page.content.split('\n\n== ')
    docs = []
    for i, section in enumerate(sections, 1):
        if section.strip():
            docs.append(LCDocument(
                page_content=section.strip(),
                metadata={'page': i, 'source': page.url},
            ))

    return docs or [LCDocument(page_content=page.content, metadata={'page': 1})], 'wikipedia', page.title


def _load_arxiv(input_str: str) -> tuple[list[LCDocument], str, str]:
    import arxiv

    # Accept full URL or bare ID like "2401.12345"
    paper_id = input_str.strip()
    for prefix in ['https://arxiv.org/abs/', 'http://arxiv.org/abs/', 'arxiv:']:
        paper_id = paper_id.replace(prefix, '')

    client = arxiv.Client()
    results = list(client.results(arxiv.Search(id_list=[paper_id])))
    if not results:
        raise ValueError(f'arXiv paper not found: {input_str}')

    paper = results[0]
    content = (
        f"Title: {paper.title}\n\n"
        f"Authors: {', '.join(a.name for a in paper.authors)}\n\n"
        f"Published: {paper.published.strftime('%Y-%m-%d')}\n\n"
        f"Abstract:\n{paper.summary}\n\n"
        f"Categories: {', '.join(paper.categories)}"
    )
    return (
        [LCDocument(page_content=content, metadata={'page': 1, 'source': paper.entry_id})],
        'arxiv',
        paper.title,
    )


def _load_rss(url: str) -> tuple[list[LCDocument], str, str]:
    import feedparser
    from bs4 import BeautifulSoup

    feed = feedparser.parse(url)
    if feed.bozo and not feed.entries:
        raise ValueError(f'Could not parse RSS feed: {url}')

    docs = []
    for i, entry in enumerate(feed.entries[:30], 1):
        raw = (
            entry.get('summary', '')
            or (entry.get('content') or [{}])[0].get('value', '')
        )
        text = BeautifulSoup(raw, 'lxml').get_text(separator='\n', strip=True)
        full = f"{entry.get('title', 'Untitled')}\n\n{text}"
        docs.append(LCDocument(
            page_content=full,
            metadata={'page': i, 'source': entry.get('link', url)},
        ))

    auto_title = feed.feed.get('title', url)
    return docs, 'rss', auto_title
