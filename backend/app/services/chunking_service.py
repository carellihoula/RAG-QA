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


class ChunkingService:
    """Picks the right splitting strategy based on the document source type."""

    def chunk(self, docs: list[Document], source_type: str) -> list[Document]:
        strategies = {
            'pdf':       self._prose,
            'md':        self._markdown,
            'html':      self._markdown,
            'url':       self._markdown,
            'csv':       self._csv_rows,
            'xlsx':      self._sheet_rows,
            'wikipedia': self._wikipedia,
        }
        chunks = strategies.get(source_type, self._prose)(docs)
        self._clean(chunks)
        if source_type in ('md', 'wikipedia', 'html', 'url'):
            self._inject_section_headers(chunks)
        return chunks

    # ── Strategies ────────────────────────────────────────────────────────────

    def _prose(self, docs: list[Document]) -> list[Document]:
        """Fixed-size recursive splitting — good for PDF, DOCX."""
        return _PROSE.split_documents(docs)

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

    _TABULAR_MAX_ROWS = 40   # cap chunk density so a chunk stays a coherent retrieval unit
    _TABULAR_OVERLAP  = 2    # rows repeated across a chunk boundary

    def _csv_rows(self, docs: list[Document]) -> list[Document]:
        """CSVLoader returns one Document per row (key:value format).
        Group consecutive rows into chunks bounded by chunk_size AND row count,
        with a small row overlap so a boundary-straddling query still sees context."""
        chunks = []
        n = len(docs)
        i = 0
        while i < n:
            group = [docs[i]]
            size = len(docs[i].page_content)
            j = i + 1
            while (
                j < n
                and len(group) < self._TABULAR_MAX_ROWS
                and size + len(docs[j].page_content) < settings.chunk_size
            ):
                group.append(docs[j])
                size += len(docs[j].page_content)
                j += 1
            chunks.append(Document(
                page_content='\n\n'.join(d.page_content for d in group),
                metadata={**docs[i].metadata, 'row_start': i + 1, 'row_end': j},
            ))
            i = max(j - self._TABULAR_OVERLAP, i + 1)
        return chunks or docs

    def _sheet_rows(self, docs: list[Document]) -> list[Document]:
        """XLSX loader returns one Document per sheet: 'Sheet: x' + 'Columns: a, b, c'
        header lines, then one line per data row. The header block is repeated on
        every chunk so a chunk is never just bare values with no column context."""
        chunks = []
        for doc in docs:
            lines = doc.page_content.splitlines()
            if not lines:
                continue
            header_lines = []
            idx = 0
            while idx < len(lines) and (lines[idx].startswith('Sheet:') or lines[idx].startswith('Columns:')):
                header_lines.append(lines[idx])
                idx += 1
            sheet_header = '\n'.join(header_lines)
            data_lines = lines[idx:]
            header_budget = len(sheet_header) + 1 if sheet_header else 0

            n = len(data_lines)
            i = 0
            while i < n:
                group = [data_lines[i]]
                size = header_budget + len(data_lines[i])
                j = i + 1
                while (
                    j < n
                    and len(group) < self._TABULAR_MAX_ROWS
                    and size + len(data_lines[j]) < settings.chunk_size
                ):
                    group.append(data_lines[j])
                    size += len(data_lines[j])
                    j += 1
                content = (f"{sheet_header}\n" if sheet_header else '') + '\n'.join(group)
                chunks.append(Document(
                    page_content=content.strip(),
                    metadata={**doc.metadata, 'row_start': i + 1, 'row_end': j},
                ))
                i = max(j - self._TABULAR_OVERLAP, i + 1)
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