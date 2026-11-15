from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader
from docx import Document
from pdf2image import convert_from_path
from PIL import Image,ImageOps,ImageDraw

root=Path(__file__).resolve().parents[2]
file=root/'output/documents/IskoMatic_FinalDocu_Revised.pdf'
reader=PdfReader(file)
text='\n'.join(p.extract_text() for p in reader.pages)
assert len(reader.pages)==19
assert 'Error! Bookmark not defined' not in text
assert 'PyQt6' not in text
assert 'Figure 2.5' not in text and 'Figure 2.6' not in text
assert 'intentionally not filled' not in text
compact=''.join(text.split())
assert '63.8%' in text and 'rf-3.0.0' in compact
assert '31passed' in compact and '19unittests' in compact
assert '15 November 2026' in text
assert '09179998888' in text
assert all(len(p.extract_text().strip())>200 for p in reader.pages)
doc=Document(file.with_suffix('.docx'))
assert [row.cells[4].text for row in doc.tables[4].rows[1:]]==['Passed']*10
src=ZipFile(r'D:/Downloads/IskoMatic_FinalDocu (1).docx')
dst=ZipFile(file.with_suffix('.docx'))
# Exact original logo and ERD image bytes remain present in the revised package.
newmedia=[dst.read(n) for n in dst.namelist() if n.startswith('word/media/')]
for name in ['image7.jpg','image8.png','image9.jpg']:
    assert src.read('word/media/'+name) in newmedia,name

out=root/'tmp/docu/final-render';out.mkdir(exist_ok=True)
pages=convert_from_path(str(file),dpi=120,poppler_path=r'C:/Users/Karl Sebastian/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')
for i,im in enumerate(pages):im.save(out/f'page-{i+1}.png')
print('Verified 19 pages, 10 Passed outcomes, corrected text, no blank pages or bookmark errors, original logos and ERD preserved.')
print('TOC:\n'+reader.pages[1].extract_text())
print('Test case pages:',[(i+1,[f'TC-{n:02}' for n in range(1,11) if f'TC-{n:02}' in p.extract_text()]) for i,p in enumerate(reader.pages) if 'TC-01' in p.extract_text() or 'TC-06' in p.extract_text() or 'TC-10' in p.extract_text()])
