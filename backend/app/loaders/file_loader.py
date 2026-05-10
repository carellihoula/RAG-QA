"""Loads various file types into LangChain Documents."""
from pathlib import Path
from langchain_core.documents import Document as LCDocument
from langchain_community.document_loaders import PyPDFLoader, TextLoader, CSVLoader

SUPPORTED_EXTENSIONS = {
    '.pdf', '.docx', '.doc', '.pptx', '.ppt',
    '.txt', '.md', '.markdown', '.csv', '.html', '.htm', '.xlsx', '.xls',
}


def load_file(path: Path) -> tuple[list[LCDocument], str]:
    """Returns (docs, source_type). source_type is the canonical format name."""
    ext = path.suffix.lower()

    if ext == '.pdf':
        return PyPDFLoader(str(path)).load(), 'pdf'

    if ext in ('.docx', '.doc'):
        return _load_docx(path), 'docx'

    if ext in ('.pptx', '.ppt'):
        return _load_pptx(path), 'pptx'

    if ext in ('.xlsx', '.xls'):
        return _load_xlsx(path), 'xlsx'

    if ext == '.csv':
        return CSVLoader(str(path)).load(), 'csv'

    if ext in ('.html', '.htm'):
        return _load_html_file(path), 'html'

    if ext in ('.txt', '.md', '.markdown'):
        docs = TextLoader(str(path), encoding='utf-8').load()
        # Assign page numbers so downstream metadata works
        for i, doc in enumerate(docs):
            doc.metadata.setdefault('page', i)
        return docs, 'md' if ext in ('.md', '.markdown') else 'txt'

    raise ValueError(f"Unsupported extension: {ext}")


def _load_docx(path: Path) -> list[LCDocument]:
    import docx2txt
    text = docx2txt.process(str(path))
    return [LCDocument(page_content=text or '', metadata={'page': 1, 'source': str(path)})]


def _load_pptx(path: Path) -> list[LCDocument]:
    from pptx import Presentation
    prs = Presentation(str(path))
    docs = []
    for i, slide in enumerate(prs.slides, 1):
        texts = [
            shape.text.strip()
            for shape in slide.shapes
            if hasattr(shape, 'text') and shape.text.strip()
        ]
        if texts:
            docs.append(LCDocument(
                page_content='\n'.join(texts),
                metadata={'page': i, 'source': str(path)},
            ))
    return docs or [LCDocument(page_content='Empty presentation', metadata={'page': 1})]


def _load_xlsx(path: Path) -> list[LCDocument]:
    import openpyxl
    wb = openpyxl.load_workbook(str(path), read_only=True, data_only=True)
    docs = []
    for idx, sheet in enumerate(wb.worksheets, 1):
        rows = [
            ', '.join(str(c) for c in row if c is not None)
            for row in sheet.iter_rows(values_only=True)
            if any(c is not None for c in row)
        ]
        if rows:
            docs.append(LCDocument(
                page_content=f'Sheet: {sheet.title}\n\n' + '\n'.join(rows),
                metadata={'page': idx, 'source': str(path)},
            ))
    return docs or [LCDocument(page_content='Empty spreadsheet', metadata={'page': 1})]


def _load_html_file(path: Path) -> list[LCDocument]:
    from bs4 import BeautifulSoup
    content = path.read_text(encoding='utf-8', errors='ignore')
    soup = BeautifulSoup(content, 'lxml')
    for tag in soup(['script', 'style', 'nav', 'footer']):
        tag.decompose()
    text = soup.get_text(separator='\n', strip=True)
    return [LCDocument(page_content=text, metadata={'page': 1, 'source': str(path)})]