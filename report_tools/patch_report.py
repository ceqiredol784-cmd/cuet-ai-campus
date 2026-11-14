# Updates the report:
#  1. removes every admin mention (three user types: student, CR, coordinator)
#  2. swaps in the redrawn no-admin system overview + use case diagrams
#  3. rebuilds Appendix C with screenshots of ALL pages
#  4. updates the List of Figures
import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
IMG = r'D:\ALL CODE\CUET-react\report'
doc = Document(DOC)

# --- 1. remove admin text ---------------------------------------------------
for p in doc.paragraphs:
    if 'admin' in p.text.lower():
        full = p.text.replace('(student, CR, coordinator, admin)', '(student, CR, coordinator)')
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run(full)

for t in doc.tables:
    for row in list(t.rows):
        if row.cells[0].text.strip() in ('System administrator', 'Admin'):
            row._element.getparent().remove(row._element)
            print('removed table row:', row.cells[0].text.strip() if False else '(admin row)')

# --- 2. swap the two redrawn diagrams ---------------------------------------
targets = {'system_overview.png': 0, 'usecase_diagram.png': 1}  # occurrence order among diagrams
diagram_count = 0
for par in doc.paragraphs:
    drawings = par._p.findall('.//{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingml}inline')
    if not drawings:
        continue
    name = None
    if diagram_count == 0:
        name = 'system_overview.png'
    elif diagram_count == 2:
        name = 'usecase_diagram.png'   # after gantt (1) and usecase is 3rd image overall
    else:
        diagram_count += 1
        continue
    diagram_count += 1
    for run in list(par.runs):
        run._element.getparent().remove(run._element)
    par.add_run().add_picture(os.path.join(IMG, name), width=Inches(5.6))
    print('swapped diagram:', name)

# --- 3. rebuild Appendix C ---------------------------------------------------
paras = doc.paragraphs
idx_c = next(i for i, p in enumerate(paras) if p.text.strip().startswith('Appendix C'))
idx_d = next(i for i, p in enumerate(paras) if p.text.strip().startswith('Appendix D'))
anchor = paras[idx_d]  # insert new content before this

# delete everything currently between Appendix C and Appendix D
for p in paras[idx_c + 1: idx_d]:
    p._element.getparent().remove(p._element)

FIGURES = [
    ('screen-01-login.png', 'Figure C.1: Login screen'),
    ('screen-02-home.png', 'Figure C.2: Student home dashboard'),
    ('screen-03-updates.png', 'Figure C.3: Updates feed with detail modal'),
    ('screen-04-events.png', 'Figure C.4: Events page'),
    ('screen-05-routine.png', 'Figure C.5: Period-based weekly class routine'),
    ('screen-06-exams.png', 'Figure C.6: Exam routines'),
    ('screen-07-calendar.png', 'Figure C.7: Academic calendar'),
    ('screen-08-campus-map.png', 'Figure C.8: Campus map (OpenStreetMap data)'),
    ('screen-09-study-materials.png', 'Figure C.9: Study materials'),
    ('screen-10-assignments.png', 'Figure C.10: Assignments'),
    ('screen-11-directory.png', 'Figure C.11: Student directory'),
    ('screen-12-ai-chat.png', 'Figure C.12: AI assistant chat'),
    ('screen-13-profile.png', 'Figure C.13: Profile page'),
    ('screen-14-cr-dashboard.png', 'Figure C.14: CR Center dashboard'),
    ('screen-15-cr-compose.png', 'Figure C.15: CR update composer'),
    ('screenshot_wizard.png', 'Figure C.16: Routine studio wizard (subjects step)'),
    ('screen-16-coordinator-home.png', 'Figure C.17: Coordinator home'),
    ('screen-17-coordinator-academics.png', 'Figure C.18: Coordinator academics management'),
    ('screen-18-coordinator-students.png', 'Figure C.19: Coordinator students management'),
    ('screen-19-coordinator-exams.png', 'Figure C.20: Coordinator exam management'),
    ('screen-20-coordinator-notices.png', 'Figure C.21: Coordinator notices'),
    ('screen-21-coordinator-proposals.png', 'Figure C.22: Routine proposal review'),
    ('screen-22-coordinator-audit.png', 'Figure C.23: Coordinator audit log'),
]
for name, caption in FIGURES:
    pic = anchor.insert_paragraph_before()
    pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic.add_run().add_picture(os.path.join(IMG, name), width=Inches(6.0))
    cap = anchor.insert_paragraph_before()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(caption)
    r.italic = True
    r.font.size = Pt(10)
print('appendix C figures:', len(FIGURES))

# --- 4. List of Figures entry ------------------------------------------------
for p in doc.paragraphs:
    if p.text.strip() == 'Figure C.1 — Home screen':
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run('Figures C.1–C.23 — Screenshots of the working system (all pages)')
        print('list of figures updated')
        break

doc.save(DOC)
print('saved')
