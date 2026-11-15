from pathlib import Path
from copy import deepcopy
import shutil
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase.pdfmetrics import stringWidth
from pdf2image import convert_from_path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT=Path(__file__).resolve().parents[2]
work=Path(__file__).parent/'gantt';work.mkdir(exist_ok=True)
target=ROOT/'output/documents/IskoMatic_FinalDocu_Revised.docx'
backup=work/'before-gantt.docx'
if not backup.exists():
    shutil.copy2(target,backup)
    shutil.copy2(target.with_suffix('.pdf'),work/'before-gantt.pdf')
doc=Document(backup)
old=doc.tables[6]
rows=[[c.text for c in r.cells] for r in old.rows[1:]]
periods=[(1,1),(1,3),(3,5),(5,6),(6,6),(7,8),(8,8),(9,9),(10,10),(10,10)]
labels=[
'Project planning and scope\nconfirmation',
'Requirements gathering and SRS',
'System analysis and design',
'Iteration 1 - applicant module',
'Iteration 1 - testing and review',
'Iteration 2 - AI screening\nand interviews',
'Iteration 2 - testing and review',
'Iteration 3 - decisions and dashboard',
'Integration, system testing,\nand final documentation',
'Deployment and user manual']
W=451.4; H=294; LABEL=185; CELL=(W-LABEL)/10; HEADER=25; ROW=25
c=canvas.Canvas(str(work/'gantt-chart.pdf'),pagesize=(W,H))
blue=HexColor('#538DD0');dark=HexColor('#356AA8');line=HexColor('#BECBDD')
c.setFillColor(blue);c.rect(0,H-HEADER,W,HEADER,fill=1,stroke=0)
c.setFillColor(white);c.setFont('Times-Bold',10)
c.drawString(7,H-16,'Activity / target week')
for j in range(10):c.drawCentredString(LABEL+(j+.5)*CELL,H-16,f'{j+1}')
for i,(label,(start,end)) in enumerate(zip(labels,periods)):
    top=HEADER+i*ROW;bottom=H-top-ROW
    c.setFillColor(HexColor('#F3F6FA') if i%2==0 else white)
    c.rect(0,bottom,W,ROW,fill=1,stroke=0)
    c.setFillColor(HexColor('#111111'));c.setFont('Times-Roman',9.5)
    lines=label.split('\n');base=H-top-(ROW-len(lines)*10.5)/2-8
    c.drawString(6,base,str(i+1)+'.')
    for k,s in enumerate(lines):c.drawString(22,base-k*10.5,s)
    c.setStrokeColor(line);c.setLineWidth(.35)
    c.line(0,bottom,W,bottom)
    for j in range(11):c.line(LABEL+j*CELL,H-top,LABEL+j*CELL,bottom)
    x=LABEL+(start-1)*CELL+3;w=(end-start+1)*CELL-6
    c.setFillColor(blue);c.setStrokeColor(dark);c.setLineWidth(.5)
    c.rect(x,bottom+7,w,11,fill=1,stroke=1)
c.setStrokeColor(HexColor('#59687A'));c.setLineWidth(.6)
c.rect(0,H-HEADER-10*ROW,W,HEADER+10*ROW,fill=0,stroke=1)
c.setFillColor(blue);c.rect(3,4,15,6,fill=1,stroke=0)
c.setFillColor(HexColor('#333333'));c.setFont('Times-Roman',9)
c.drawString(23,4,'Planned work period (Weeks 1-10)')
c.save()
convert_from_path(str(work/'gantt-chart.pdf'),dpi=300,poppler_path=r'C:/Users/Karl Sebastian/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin')[0].save(work/'gantt-chart.png')

pic=doc.add_paragraph();pic.alignment=WD_ALIGN_PARAGRAPH.CENTER
pic.paragraph_format.space_after=Pt(3);pic.paragraph_format.line_spacing=1
pic.paragraph_format.keep_with_next=True
pic.add_run().add_picture(str(work/'gantt-chart.png'),width=Inches(6.27))
pic.runs[0]._r.xpath('.//wp:docPr')[0].set('descr','Ten-week Gantt chart: planning W1; requirements W1-3; design W3-5; applicant module W5-6 and testing W6; screening and interviews W7-8 and testing W8; decisions and dashboard W9; integration, documentation and deployment W10.')
old._tbl.addprevious(pic._p)
cap=doc.add_paragraph('Appendix Figure B.1. Ten-Week Project Gantt Chart')
cap.alignment=WD_ALIGN_PARAGRAPH.CENTER;cap.paragraph_format.space_after=Pt(6)
cap.paragraph_format.keep_with_next=True
for r in cap.runs:r.font.name='Times New Roman';r.font.size=Pt(11);r.italic=True
old._tbl.addprevious(cap._p)

# Retain every milestone from the source schedule in a compact supporting key.
table=doc.add_table(rows=11,cols=2);table.style=old.style
table.alignment=WD_TABLE_ALIGNMENT.CENTER;table.autofit=False
table.columns[0].width=Inches(.48);table.columns[1].width=Inches(5.79)
table.cell(0,0).text='Task';table.cell(0,1).text='Expected output / milestone'
for i,row in enumerate(rows,1):table.cell(i,0).text=str(i);table.cell(i,1).text=row[2]
for i,row in enumerate(table.rows):
    row.cells[0].width=Inches(.48);row.cells[1].width=Inches(5.79)
    pr=row._tr.get_or_add_trPr();pr.append(OxmlElement('w:cantSplit'))
    if i==0:pr.append(OxmlElement('w:tblHeader'))
    for cell in row.cells:
        cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
        if i==0:
            sh=OxmlElement('w:shd');sh.set(qn('w:fill'),'538DD0');cell._tc.get_or_add_tcPr().append(sh)
        for p in cell.paragraphs:
            p.paragraph_format.space_before=Pt(2);p.paragraph_format.space_after=Pt(2)
            p.paragraph_format.line_spacing=1
            for r in p.runs:
                r.font.name='Times New Roman';r.font.size=Pt(10.5)
                if i==0:r.bold=True;r.font.color.rgb=RGBColor(255,255,255)
    row.cells[0].paragraphs[0].alignment=WD_ALIGN_PARAGRAPH.CENTER
old._tbl.addprevious(table._tbl);old._tbl.getparent().remove(old._tbl)
target=target.with_name('IskoMatic_FinalDocu_With_Gantt.docx')
doc.save(target)
print('Replaced schedule table with Gantt chart; retained all 10 milestone descriptions.')
