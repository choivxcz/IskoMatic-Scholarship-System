from pathlib import Path
from copy import deepcopy
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'output/documents';OUT.mkdir(parents=True,exist_ok=True)
doc=Document(r'D:/Downloads/IskoMatic_FinalDocu (1).docx')
p=list(doc.paragraphs)
def replace(par,text):
    proto=next((r for r in par.runs if r.text.strip()),None)
    fmt=deepcopy(proto._r.rPr) if proto is not None and proto._r.rPr is not None else None
    par.clear();r=par.add_run(text)
    if fmt is not None:r._r.insert(0,fmt)
def cell_text(c,text):
    replace(c.paragraphs[0],text)
    for q in c.paragraphs[1:]:q._p.getparent().remove(q._p)
def image_at(index,name,width):
    q=p[index];q.clear();q.add_run().add_picture(str(Path(__file__).parent/'diagrams'/f'{name}.png'),width=Inches(width))
    q.alignment=WD_ALIGN_PARAGRAPH.CENTER
    q.paragraph_format.first_line_indent=Inches(0)
    q.paragraph_format.space_before=Pt(4);q.paragraph_format.space_after=Pt(2)
    q.paragraph_format.keep_with_next=True
    q.paragraph_format.line_spacing=1

replace(p[62],'PDF/Excel report generation, full backup and restore, and in-app model retraining are not included in the current version. Records export to CSV, and the model is retrained offline with train_ml_model.py.')
replace(p[63],'The system runs on one workstation and requires the local Python bridge and MySQL service to be running; a one-click installer is not yet available.')
replace(p[95],p[95].text.replace('report/output functions','dashboard and CSV export functions'))
replace(p[100],p[100].text.replace('Decision operations are subject to backend authorization checks.','Only ADMIN accounts can record official scholarship decisions and approve staff accounts; the backend rejects these requests from LYDO_OFFICIAL accounts.'))
replace(p[130],'Figure 5. Class Diagram')
replace(p[135],'Figure 6. Entity Relationship Diagram (ERD)')
replace(p[144],p[144].text.replace('The Actual result column is intentionally not filled with assumed outcomes.','Cases were executed on 15 November 2026 through the system\'s services against a temporary copy of the database, using fictional records only.'))
replace(p[154],'Add PDF and Excel report generation if required by LYDO. Records currently export to CSV.')
replace(p[156],'Add export of Activity Log entries and verify that audit records are protected against unauthorized changes.')
replace(p[166],'[Insert screenshots for A.1-A.6 here. Add the actual date, test case ID, and brief caption for every image.]')

env=doc.tables[2]
for row,txt in [(1,'Windows 11 Home (build 26200)'),(2,'Tauri 2 desktop app (React 18 + TypeScript 5.6, WebView2) with a local Python bridge; MySQL Server 8.0.43'),(3,'Tauri 2, React 18, TypeScript 5.6, Vite 6; Python 3.14.3, pytest 9.1.1, mysql-connector-python 9.6.0, pandas 3.0.1, NumPy 2.4.4, scikit-learn 1.8.0, joblib 1.5.3')]:cell_text(env.cell(row,1),txt)
results=[
'Applicant saved and retrieved with the same name and email.',
'Search by last name returned the new applicant.',
'Phone changed to 09179998888; the new value appeared on re-fetch.',
'Archived applicant was absent from active records and still retrievable as archived.',
'Application saved and linked to the correct applicant ID with the entered details.',
'DRAFT → SUBMITTED was saved. SUBMITTED → APPROVED was rejected ("Cannot change application status from SUBMITTED to APPROVED."); status stayed SUBMITTED.',
'4Ps sample flagged not eligible and not scored; reason "Applicant is a 4Ps beneficiary."',
'Eligible sample scored 63.8% (Qualified) with all 9 input contributions explained.',
'Screening result saved, linked to the application and model version rf-3.0.0.',
'Interview linked to the application. No decision options before the interview; after a PASSED result, Approved / Waitlisted / Rejected were offered; Approved was saved and no further decisions were allowed.'
]
for i,txt in enumerate(results,1):
    cell_text(doc.tables[4].cell(i,3),txt);cell_text(doc.tables[4].cell(i,4),'Passed')
cell_text(doc.tables[4].cell(8,2),doc.tables[4].cell(8,2).text.replace('probability/classification','probability / classification'))
cell_text(doc.tables[5].cell(7,1),'python -m pytest tests, 15 Nov 2026: 31 passed (19 unit tests; 12 integration tests on a temporary database copy).')

image_at(69,'architecture',5.81)
image_at(74,'context',6.27)
image_at(96,'dfd',5.90)
image_at(101,'usecase',6.00)
image_at(129,'classes',6.27)
for i in [70,75,97,126,130,135]:
    p[i].alignment=WD_ALIGN_PARAGRAPH.CENTER;p[i].paragraph_format.keep_with_next=False
    p[i].paragraph_format.first_line_indent=Inches(0)
    p[i].paragraph_format.space_after=Pt(5)

# Replace the broken cached TOC with a proper Word TOC field.
for sdt in list(doc._element.body.findall(qn('w:sdt'))):sdt.getparent().remove(sdt)
toc=p[35];toc.clear();toc.style=doc.styles['Normal']
for kind in ['begin','instruction','separate','text','end']:
    r=OxmlElement('w:r')
    if kind=='instruction':
        e=OxmlElement('w:instrText');e.set(qn('xml:space'),'preserve');e.text=' TOC \\o "1-2" \\h \\z \\u '
    elif kind=='text':e=OxmlElement('w:t');e.text='Table of contents'
    else:e=OxmlElement('w:fldChar');e.set(qn('w:fldCharType'),kind)
    r.append(e);toc._p.append(r)

# Normalize subsection heading levels while retaining the reference typography.
for i in [44,66]:p[i].style=doc.styles['Heading 2']
for i,text in [(50,'1.3 Project Scope and Limitations'),(147,'4.1 System Improvements'),(152,'4.2 Future Enhancements')]:
    replace(p[i],text)
    for num in list(p[i]._p.xpath('./w:pPr/w:numPr')):num.getparent().remove(num)
    num=OxmlElement('w:numPr');nid=OxmlElement('w:numId');nid.set(qn('w:val'),'0');num.append(nid);p[i]._p.get_or_add_pPr().append(num)

# Remove spacer paragraphs and stale manual page breaks that caused the blank page
# and the separated use-case caption. Explicit section starts retain the structure.
remove=set(range(36,43))|set(range(76,95))|set(range(102,126))|{64,131,136,145,162,167,170}
for i in sorted(remove):
    if p[i]._p.getparent() is not None:p[i]._p.getparent().remove(p[i]._p)
for q in doc.paragraphs:
    for br in list(q._p.xpath('.//w:br[@w:type="page"]')):br.getparent().remove(br)
for i in [34,43,65,71,95,99,127,132,137,143,146,163,168,171]:p[i].paragraph_format.page_break_before=True
for q in doc.paragraphs:
    if q.style.name.startswith('Heading'):
        q.paragraph_format.keep_with_next=True
        for r in q.runs:r.font.name='Times New Roman';r.font.size=Pt(12)

# Preserve table designs and stop individual records splitting across pages.
for t in doc.tables:
    for row in t.rows:
        pr=row._tr.get_or_add_trPr()
        if pr.find(qn('w:cantSplit')) is None:pr.append(OxmlElement('w:cantSplit'))
    header=t.rows[0]._tr.get_or_add_trPr()
    if header.find(qn('w:tblHeader')) is None:header.append(OxmlElement('w:tblHeader'))
    for c in t.rows[0].cells:
        for q in c.paragraphs:q.paragraph_format.keep_with_next=True

# The longer observed outcomes fit on two pages with the same table design.
for row in doc.tables[4].rows:
    for c in row.cells:
        for q in c.paragraphs:
            q.alignment=WD_ALIGN_PARAGRAPH.LEFT
            q.paragraph_format.line_spacing=1
            q.paragraph_format.space_before=Pt(2);q.paragraph_format.space_after=Pt(2)
            for r in q.runs:r.font.size=Pt(11)

# Keep captions / diagram descriptions as body text, never TOC entries.
doc.core_properties.title='IskoMatic System Documentation'
doc.core_properties.subject='AI-Assisted Scholarship Applicant Screening and Management System'
doc.save(OUT/'IskoMatic_FinalDocu_Revised.docx')
print(OUT/'IskoMatic_FinalDocu_Revised.docx')
