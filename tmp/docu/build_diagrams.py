from pathlib import Path
from math import atan2, cos, sin, pi
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from pdf2image import convert_from_path

OUT=Path(__file__).parent/'diagrams'
OUT.mkdir(exist_ok=True)
POP=r'C:/Users/Karl Sebastian/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin'
INK='#353346'
class Diagram:
    def __init__(self,name,w,h):
        self.name=name; self.w=w; self.h=h
        self.c=canvas.Canvas(str(OUT/(name+'.pdf')),pagesize=(w,h))
    def line(self,pts,color=INK,width=.8,dash=None,arrow=False):
        c=self.c;c.setStrokeColor(HexColor(color));c.setLineWidth(width);c.setDash(dash or [])
        p=c.beginPath();p.moveTo(pts[0][0],self.h-pts[0][1])
        for x,y in pts[1:]:p.lineTo(x,self.h-y)
        c.drawPath(p);c.setDash([])
        if arrow:
            (a,b),(x,y)=pts[-2:];ang=atan2(y-b,x-a)
            p=c.beginPath();p.moveTo(x,self.h-y)
            for t in [-.45,.45]:p.lineTo(x-5*cos(ang+t),self.h-(y-5*sin(ang+t)))
            p.close();c.setFillColor(HexColor(color));c.drawPath(p,fill=1,stroke=0)
    def text(self,x,y,s,size=10,bold=False,align='center',color=INK):
        c=self.c;c.setFillColor(HexColor(color));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size)
        lines=s.split('\n')
        for k,t in enumerate(lines):
            yy=self.h-y-k*size*1.2
            getattr(c,{'center':'drawCentredString','left':'drawString','right':'drawRightString'}[align])(x,yy,t)
    def rect(self,x,y,w,h,label='',fill='#FFFFFF',stroke=INK,size=10):
        c=self.c;c.setFillColor(HexColor(fill));c.setStrokeColor(HexColor(stroke));c.setLineWidth(.8)
        c.rect(x,self.h-y-h,w,h,fill=1,stroke=1)
        if label:self.text(x+w/2,y+h/2-size*.6*(len(label.split('\n'))-1)+size*.32,label,size)
    def ellipse(self,x,y,w,h,label='',size=10):
        c=self.c;c.setFillColor(white);c.setStrokeColor(HexColor(INK));c.setLineWidth(.8)
        c.ellipse(x,self.h-y-h,x+w,self.h-y,fill=1,stroke=1)
        self.text(x+w/2,y+h/2-size*.6*(len(label.split('\n'))-1)+size*.32,label,size)
    def store(self,x,y,w,h,label,size=9):
        c=self.c;c.setFillColor(white);c.setStrokeColor(HexColor(INK));c.setLineWidth(.8)
        c.rect(x,self.h-y-h+5,w,h-10,fill=1,stroke=0)
        c.ellipse(x,self.h-y-h,x+w,self.h-y-h+10,fill=1,stroke=1)
        c.line(x,self.h-y-5,x,self.h-y-h+5);c.line(x+w,self.h-y-5,x+w,self.h-y-h+5)
        c.ellipse(x,self.h-y-10,x+w,self.h-y,fill=1,stroke=1)
        self.text(x+w/2,y+h/2-size*.6*(len(label.split('\n'))-1)+size*.5,label,size)
    def finish(self):
        self.c.showPage();self.c.save()
        convert_from_path(str(OUT/(self.name+'.pdf')),dpi=300,poppler_path=POP)[0].save(OUT/(self.name+'.png'))

d=Diagram('architecture',650,445)
d.rect(260,8,128,38,'LYDO Official /\nAdministrator',size=10)
d.line([(324,46),(324,65)],arrow=True)
d.rect(8,65,532,86,fill='#FDF4FF',stroke='#D99AE6')
d.text(274,79,'Presentation Layer - Tauri / React',10,True)
for x,label in [(20,'Applicant and\nApplication Forms'),(150,'Screening and\nResults Screen'),(280,'Interview and\nDecision Screens'),(410,'Dashboard and\nActivity Log')]:d.rect(x,94,116,42,label,size=9)
d.line([(274,151),(274,166)],arrow=True)
d.rect(167,166,214,33,'Local Python Bridge\nHTTP - 127.0.0.1:8765',fill='#F5F5FF',stroke='#A5A5CC',size=10)
d.line([(274,199),(274,214)],arrow=True)
d.rect(8,214,532,80,fill='#F0FCFB',stroke='#72CECB')
d.text(274,228,'Application Layer - Business Logic',10,True)
for x,label in [(20,'Applicant\nManagement'),(123,'Interview /\nDecision Services'),(226,'Status\nWorkflow'),(329,'CSV Export'),(432,'Authentication\nand Validation')]:d.rect(x,242,96,37,label,size=9)
d.rect(22,327,129,98,fill='#FFF6ED',stroke='#E8B278');d.text(86,342,'Data Layer',10,True)
d.store(42,357,89,48,'MySQL Database',9)
d.line([(86,327),(86,294)],arrow=True);d.line([(100,294),(100,327)],arrow=True)
d.rect(273,327,267,108,fill='#EEFCFF',stroke='#70CDE0');d.text(406,342,'Machine Learning Layer',10,True)
d.store(286,354,101,37,'Saved Model File',9);d.rect(409,354,118,37,'Preprocessing\npandas / NumPy',size=9)
d.rect(351,402,120,25,'Random Forest Classifier',size=9)
d.line([(336,391),(336,414),(351,414)],arrow=True);d.line([(467,391),(467,402)],arrow=True)
d.line([(470,294),(470,354)],arrow=True);d.line([(351,414),(259,414),(259,294)],arrow=True)
d.store(552,78,89,50,'Training\nDataset',10);d.rect(551,180,91,45,'Offline Model\nTraining',size=10)
d.line([(596,128),(596,180)],arrow=True);d.line([(596,225),(596,312),(336,312),(336,354)],arrow=True)
d.finish()

d=Diagram('context',720,155)
d.rect(5,55,91,40,'Applicant',size=12)
d.rect(283,44,126,65,'LYDO Official /\nAdministrator',size=12)
d.ellipse(585,16,129,129,'0.0\nIskoMatic\nScholarship\nScreening and\nManagement\nSystem',11)
d.line([(96,66),(283,66)],arrow=True);d.text(190,46,'Application form and requirements',8.4)
d.line([(283,92),(96,92)],arrow=True);d.text(190,116,'Status updates / interview notice',8.4)
d.line([(409,61),(585,61)],arrow=True);d.text(498,37,'Applicant details, review inputs,\ninterview and decision records',8.4)
d.line([(585,96),(409,96)],arrow=True);d.text(498,120,'Status, screening results,\ndashboard summaries and CSV exports',8.4)
d.finish()

d=Diagram('dfd',610,650)
d.rect(242,5,126,28,'Applicant',size=11)
d.rect(228,65,154,44,'LYDO Official /\nAdministrator',size=11)
d.line([(305,33),(305,65)],arrow=True);d.text(425,51,'Form and requirements',9)
# Five processes and four stores, retaining the original circular/cylinder notation.
d.ellipse(90,167,94,94,'1.0 Manage\nApplicant and\nApplication',10)
d.store(82,301,110,54,'D1 Applicant and\nApplication Records',9)
d.ellipse(90,405,94,94,'2.0 Screen\nApplicant',10)
d.store(82,548,110,48,'D2 Screening\nResults',10)
d.ellipse(426,167,94,94,'3.0 Manage\nInterview',10)
d.store(418,301,110,54,'D3 Interview\nRecords',10)
d.ellipse(426,405,94,94,'4.0 Manage\nScholarship\nDecision',10)
d.store(418,548,110,48,'D4 Scholarship\nDecisions',10)
d.ellipse(258,527,94,94,'5.0 Dashboard\nand Export',10)
d.line([(252,109),(252,140),(137,140),(137,167)],arrow=True);d.text(130,130,'Applicant and application details',9)
d.line([(358,109),(358,140),(473,140),(473,167)],arrow=True);d.text(478,130,'Schedule and result',9)
d.line([(137,261),(137,301)],arrow=True);d.text(189,285,'Records',9)
d.line([(137,355),(137,405)],arrow=True);d.text(178,384,'Application data',9)
d.line([(137,499),(137,548)],arrow=True);d.text(195,527,'Screening result',9)
d.line([(473,261),(473,301)],arrow=True);d.text(532,286,'Interview data',9)
d.line([(473,355),(473,405)],arrow=True);d.text(532,384,'Outcome',9)
d.line([(473,499),(473,548)],arrow=True);d.text(532,527,'Decision',9)
d.line([(382,91),(565,91),(565,452),(520,452)],arrow=True);d.text(556,396,'Official decision',9,align='right')
d.line([(192,328),(220,328),(220,220),(426,220)],arrow=True);d.text(365,210,'Application information',9)
d.line([(220,328),(220,452),(426,452)],arrow=True);d.text(342,426,'Application\ninformation',9)
d.line([(192,571),(258,571)],arrow=True)
d.line([(418,571),(352,571)],arrow=True)
d.line([(192,339),(234,339),(234,546),(267,546)],arrow=True)
d.line([(418,339),(376,339),(376,546),(343,546)],arrow=True)
d.line([(305,527),(305,109)],arrow=True);d.text(310,280,'Dashboard summaries',9,align='left');d.text(310,292,'and CSV exports',9,align='left')
d.line([(90,452),(25,452),(25,87),(228,87)],arrow=True);d.text(30,375,'Screening results',9,align='left')
d.finish()

d=Diagram('usecase',610,665)
d.rect(155,5,448,653,fill='#FDF4FF',stroke='#D99AE6')
d.text(379,22,'IskoMatic Scholarship Screening and Management System',10,True)
def actor(x,y,name):
    d.ellipse(x-10,y,20,20)
    d.line([(x,y+20),(x,y+55)]);d.line([(x-22,y+30),(x+22,y+30)])
    d.line([(x,y+55),(x-19,y+80)]);d.line([(x,y+55),(x+19,y+80)])
    d.text(x,y+99,name,10,True)
actor(64,190,'LYDO Official');actor(64,525,'Administrator')
cases=['Sign in / Request account','Encode applicant information','Update applicant record','Search and filter applicants','View applicant profile and status','Manage applications','Run ML screening / Review results','Endorse for interview','Schedule interview / Record result','Archive applicant','View dashboard / Export CSV','View Activity Log']
d.line([(64,220),(127,220)])
d.line([(127,55),(127,489)])
for i,s in enumerate(cases):
    y=40+i*38
    d.line([(127,y+15),(210,y+15)])
    d.ellipse(210,y,337,30,s,11)
for y,s in [(539,'Approve staff accounts'),(593,'Record official scholarship decision')]:
    d.line([(64,555),(142,555),(142,y+18),(210,y+18)])
    d.ellipse(210,y,337,36,s,11)
# UML generalization: administrator inherits the shared staff operations.
d.line([(64,525),(64,312)])
d.line([(64,300),(57,312),(71,312),(64,300)])
d.text(70,419,'Inherits staff',8.5,align='left');d.text(70,430,'operations',8.5,align='left')
d.text(379,519,'ADMIN-only operations',10,True)
d.finish()

d=Diagram('classes',650,740)
def cls(x,y,w,title,lines,fill,stroke,size=10):
    h=36+len(lines)*12
    d.rect(x,y,w,h,fill=fill,stroke=stroke)
    d.text(x+w/2,y+17,title,12,True)
    d.line([(x,y+25),(x+w,y+25)],color=stroke)
    for i,t in enumerate(lines):d.text(x+7,y+39+i*12,'+ '+t,size,align='left')
    return h
cls(8,5,258,'Applicant',[
'applicant_id: int','first_name, middle_name, last_name: str','suffix: str; birth_date: date; sex: str','email, phone: str','house_no_street: str','barangay, municipality, province: str','is_archived: bool','created_at, updated_at: datetime'], '#FDF4FF','#D879E5')
cls(347,5,295,'Application',[
'application_id, applicant_id: int','scholarship_program: str','scholarship_year: int','academic_average: decimal','monthly_income: decimal','mswdo_poverty_eligible: bool','household: int','children_count, senior_count, pwd_count: int','solo_parent, dependent: bool','exam_score: decimal; exam_passed: bool','four_ps_beneficiary, spes_beneficiary: bool','scholars_in_family: int','residency: str; previous_scholarship: bool','status: str; submitted_at: datetime','is_archived: bool','created_at, updated_at: datetime'], '#EFFCF9','#37C9B6')
cls(8,221,258,'ModelVersion',[
'model_version_id: int; version_name: str','algorithm, artifact_path: str','feature_config: JSON','accuracy, precision_score: decimal','recall_score, f1_score: decimal','is_active: bool; trained_at: datetime','created_at: datetime'], '#F5F2FF','#AD8EF5')
cls(347,309,295,'AuditLog',[
'audit_id: int; action: str','entity_type: str; entity_id: int','details: JSON; created_at: datetime'], '#FFF2F2','#F17E7E')
d.text(495,391,'Affected entity identified by type and ID;',9)
d.text(495,404,'no declared database foreign key.',9)
cls(8,528,207,'ScreeningResult',[
'screening_id: int','application_id: int','model_version_id: int','predicted_class: str','confidence_score: decimal','explanation: text','screened_at: datetime'], '#FFF6ED','#F3A253')
cls(232,528,197,'Interview',[
'interview_id, application_id: int','scheduled_at: datetime','location: str; status: str','result: str; remarks: text','created_at: datetime','updated_at: datetime'], '#EDFCFF','#48CAE3',9.6)
cls(446,528,196,'ScholarshipDecision',[
'decision_id: int','application_id: int','decision: str','reason: text','decided_at: datetime'], '#F0FFF5','#4DCD7C',10)
# Association paths are kept in the whitespace between class compartments.
d.line([(266,73),(347,73)],arrow=True);d.text(277,63,'1',10);d.text(333,63,'0..*',10);d.text(305,88,'files',9)
d.line([(494,233),(494,270),(305,270),(305,475)])
d.line([(305,475),(111,475),(111,528)],arrow=True)
d.line([(305,475),(330,475),(330,528)],arrow=True)
d.line([(305,475),(544,475),(544,528)],arrow=True)
d.text(505,254,'1',10);d.text(126,519,'0..*',10);d.text(345,519,'0..*',10);d.text(559,519,'0..*',10)
d.text(165,467,'screened as',9);d.text(335,467,'has',9);d.text(487,467,'receives',9)
d.line([(43,341),(43,528)],arrow=True);d.text(55,359,'1',10);d.text(59,518,'0..*',10);d.text(90,424,'uses model',9)
d.text(325,689,'Conceptual entities and persisted attributes; operations are provided by services.',10)
d.text(325,706,'Interview and decision records: 0..* per application (no schema uniqueness constraint).',9.5)
d.finish()
print('Created five diagrams in',OUT)
