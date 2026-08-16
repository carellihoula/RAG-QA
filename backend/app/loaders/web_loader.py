"""Loads web-based sources into LangChain Documents."""
import ipaddress
import socket
from urllib.parse import urlparse

from langchain_core.documents import Document as LCDocument
from app.config import settings

SUPPORTED_WEB_TYPES = {'url', 'wikipedia'}

_MAX_REDIRECTS = 5


class UnsafeUrlError(ValueError):
    """Raised when a user-supplied URL resolves to a non-public/internal address."""


def _is_public_ip(ip: str) -> bool:
    addr = ipaddress.ip_address(ip)
    return not (
        addr.is_private or addr.is_loopback or addr.is_link_local
        or addr.is_reserved or addr.is_multicast or addr.is_unspecified
    )


def _assert_safe_url(url: str) -> None:
    """Blocks SSRF: only plain http(s) URLs resolving to public IPs are allowed.
    Cloud metadata endpoints (169.254.169.254), the internal Docker network,
    and loopback are all covered by the private/link-local/loopback checks."""
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https'):
        raise UnsafeUrlError(f"Unsupported URL scheme: {parsed.scheme or '(none)'}")
    if not parsed.hostname:
        raise UnsafeUrlError("URL has no host")

    try:
        addrinfo = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise UnsafeUrlError(f"Could not resolve host: {parsed.hostname}")

    for family, _, _, _, sockaddr in addrinfo:
        ip = sockaddr[0]
        if not _is_public_ip(ip):
            raise UnsafeUrlError(f"URL resolves to a non-public address: {ip}")


def load_web(source_type: str, url: str) -> tuple[list[LCDocument], str, str]:
    """Returns (docs, source_type, auto_title)."""
    if source_type == 'url':
        return _load_url(url)
    if source_type == 'wikipedia':
        return _load_wikipedia(url)
    raise ValueError(f"Unsupported web source type: {source_type}")


def _load_url(url: str) -> tuple[list[LCDocument], str, str]:
    import requests
    import trafilatura

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; RAG-QA/1.0)'}
    max_bytes = settings.max_upload_mb * 1024 * 1024

    # Validate + fetch manually hop-by-hop so every redirect target is also
    # checked — requests' allow_redirects=True would let a validated URL
    # redirect to an internal address after the fact (TOCTOU SSRF bypass).
    current_url = url
    for _ in range(_MAX_REDIRECTS):
        _assert_safe_url(current_url)
        resp = requests.get(current_url, headers=headers, timeout=20, stream=True, allow_redirects=False)
        if resp.is_redirect or resp.is_permanent_redirect:
            location = resp.headers.get('Location')
            resp.close()
            if not location:
                raise UnsafeUrlError("Redirect without a Location header")
            current_url = location if '://' in location else requests.compat.urljoin(current_url, location)
            continue
        resp.raise_for_status()
        break
    else:
        raise UnsafeUrlError("Too many redirects")

    content = resp.raw.read(max_bytes + 1, decode_content=True)
    resp.close()
    if len(content) > max_bytes:
        raise ValueError(f"URL response exceeds the {settings.max_upload_mb}MB limit")

    # Pass raw bytes, not resp.text — requests' encoding guess is unreliable on
    # pages without an explicit charset; trafilatura/lxml detect it more robustly.
    text = trafilatura.extract(content, output_format='markdown', include_formatting=True, url=current_url)
    meta = trafilatura.extract_metadata(content)
    auto_title = (meta.title if meta and meta.title else None) or url

    if not text:
        # Fallback for pages trafilatura can't confidently extract (e.g. JS-only shells)
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'lxml')
        for tag in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe']):
            tag.decompose()
        main = soup.find('main') or soup.find('article') or soup.find('body') or soup
        text = main.get_text(separator='\n', strip=True)

    return [LCDocument(page_content=text, metadata={'page': 1, 'source': url})], 'url', auto_title


def _load_wikipedia(query: str) -> tuple[list[LCDocument], str, str]:
    import wikipedia as wp
    from urllib.parse import unquote

    # Wikimedia now rejects requests without a descriptive User-Agent (403,
    # plain-text body) — the `wikipedia` package defaults to the generic
    # "python-requests/x.y" one, which gets blocked. Without this, every
    # lookup fails with a confusing "Expecting value: line 1 column 1"
    # (json.loads choking on the non-JSON error body), unrelated to the
    # search term itself.
    wp.set_user_agent('RAG-QA/1.0 (+https://ragqa.duckdns.org; contact: carellihoula10@gmail.com)')

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
