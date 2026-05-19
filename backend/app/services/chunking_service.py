"""Source-aware chunking strategies with section-context injection."""
from langchain_core.documents import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter, MarkdownHeaderTextSplitter
from app.config import settings


def _splitter(chunk_size: int, chunk_overlap: int | None = None, extra_separators: list[str] | None = None) -> RecursiveCharacterTextSplitter:
    overlap = chunk_overlap if chunk_overlap is not None else settings.chunk_overlap
    separators = (extra_separators or []) + ["\n\n", "\n", " ", ""]
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        separators=separators,
    )


_PROSE      = _splitter(settings.chunk_size)
_PARAGRAPH  = _splitter(settings.chunk_size, extra_separators=["\n\n\n"])
_LARGE      = _splitter(2000, chunk_overlap=200)   # dense academic text


class ChunkingService:
    """Picks the right splitting strategy based on the document source type."""

    def chunk(self, docs: list[Document], source_type: str) -> list[Document]:
        strategies = {
            'pdf':       self._prose,
            'docx':      self._prose,
            'pptx':      self._slides,
            'txt':       self._paragraph,
            'md':        self._markdown,
            'html':      self._paragraph,
            'url':       self._paragraph,
            'csv':       self._tabular,
            'xlsx':      self._tabular,
            'wikipedia': self._wikipedia,
            'arxiv':     self._arxiv,
            'rss':       self._rss,
        }
        chunks = strategies.get(source_type, self._prose)(docs)
        self._clean(chunks)
        if source_type in ('md', 'wikipedia'):
            self._inject_section_headers(chunks)
        return chunks

    # ── Strategies ────────────────────────────────────────────────────────────

    def _prose(self, docs: list[Document]) -> list[Document]:
        """Fixed-size recursive splitting — good for PDF, DOCX."""
        return _PROSE.split_documents(docs)

    def _paragraph(self, docs: list[Document]) -> list[Document]:
        """Paragraph-first splitting — preserves web/HTML structure better."""
        return _PARAGRAPH.split_documents(docs)

    def _slides(self, docs: list[Document]) -> list[Document]:
        """Each slide stays as one chunk; split only if a slide is unusually long."""
        chunks = []
        for doc in docs:
            if len(doc.page_content) > settings.chunk_size:
                chunks.extend(_PROSE.split_documents([doc]))
            else:
                chunks.append(doc)
        return chunks

    def _markdown(self, docs: list[Document]) -> list[Document]:
        """Split on Markdown headers (#, ##, ###), then recursively split large sections."""
        md_splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")],
            strip_headers=False,
        )
        chunks = []
        for doc in docs:
            sections = md_splitter.split_text(doc.page_content)
            for section in sections:
                # Propagate page/source metadata from the parent doc
                for k, v in doc.metadata.items():
                    section.metadata.setdefault(k, v)
                if len(section.page_content) > settings.chunk_size:
                    chunks.extend(_PROSE.split_documents([section]))
                else:
                    chunks.append(section)
        return chunks or _PROSE.split_documents(docs)

    def _tabular(self, docs: list[Document]) -> list[Document]:
        """Row-level chunking for CSV/XLSX.
        CSVLoader already produces one doc per row (self-describing key:value format).
        For XLSX (one doc per sheet), group rows into batches to stay within chunk_size.
        """
        chunks = []
        for doc in docs:
            lines = doc.page_content.splitlines()

            # CSVLoader rows are already small — keep as-is
            if len(lines) <= 5:
                chunks.append(doc)
                continue

            # XLSX: sheet header + many data rows → group rows
            sheet_header = lines[0] if lines[0].startswith('Sheet:') else ''
            data_lines = lines[1:] if sheet_header else lines

            group: list[str] = []
            row_start = 1
            for i, line in enumerate(data_lines, 1):
                group.append(line)
                candidate = (f"{sheet_header}\n" if sheet_header else '') + '\n'.join(group)
                if len(candidate) >= settings.chunk_size or i == len(data_lines):
                    chunks.append(Document(
                        page_content=candidate.strip(),
                        metadata={**doc.metadata, 'row_start': row_start, 'row_end': row_start + len(group) - 1},
                    ))
                    row_start += len(group)
                    group = []
        return chunks or docs

    def _wikipedia(self, docs: list[Document]) -> list[Document]:
        """Wikipedia is already split by section; only refine oversized sections."""
        chunks = []
        for doc in docs:
            if len(doc.page_content) > settings.chunk_size:
                chunks.extend(_PARAGRAPH.split_documents([doc]))
            else:
                chunks.append(doc)
        return chunks

    def _arxiv(self, docs: list[Document]) -> list[Document]:
        """arXiv papers arrive as abstract + metadata — keep as single chunk."""
        return docs

    def _rss(self, docs: list[Document]) -> list[Document]:
        """Each RSS entry is one doc (title + summary) — split only if very long."""
        chunks = []
        for doc in docs:
            if len(doc.page_content) > settings.chunk_size:
                chunks.extend(_PROSE.split_documents([doc]))
            else:
                chunks.append(doc)
        return chunks

    # ── Post-processing ───────────────────────────────────────────────────────

    @staticmethod
    def _clean(chunks: list[Document]) -> None:
        """Remove NUL bytes — PostgreSQL rejects them in text fields."""
        for chunk in chunks:
            chunk.page_content = chunk.page_content.replace('\x00', ' ')

    @staticmethod
    def _inject_section_headers(chunks: list[Document]) -> None:
        """For structured sources, prefix each chunk with its section heading.
        Makes retrieved chunks self-contained without relying on surrounding context.
        """
        for chunk in chunks:
            section = (
                chunk.metadata.get('h1') or
                chunk.metadata.get('h2') or
                chunk.metadata.get('h3') or
                ''
            )
            if section and not chunk.page_content.startswith(f"[{section}]"):
                chunk.page_content = f"[{section}]\n\n{chunk.page_content}"


chunking_service = ChunkingService()