# Corrective pass:
#  1. remove the 23 figure pairs accidentally inserted into the Contents list
#  2. rebuild the REAL Appendix C (Heading 1) with the 23 all-page screenshots
#  3. add the C-figures line to the List of Figures
import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
IMG = r'D:\ALL CODE\CUET-react\report'
doc = Document(DOC)
paras = doc.paragraphs

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

def is_heading(p, prefix):
    return p.style.name == 'Heading 1' and p.text.strip().startswith(prefix)

# --- 1. clean the Contents pollution ----------------------------------------
contents_c = next(p for p in paras if p.text.strip().startswith('Appendix C') and p.style.name == 'Normal')
contents_d = next(p for p in paras if p.text.strip().startswith('Appendix D') and p.style.name == 'Normal')
removed = 0
# walk document order between the two elements
body_children = list(doc.element.body)
i_c = body_children.index(contents_c._p)
i_d = body_children.index(contents_d._p)
for el in body_children[i_c + 1: i_d]:
    el.getparent().remove(el)
    removed += 1
print('removed from Contents:', removed)

# --- 2. rebuild the real Appendix C ------------------------------------------
paras = doc.paragraphs
appc = next(p for p in paras if is_heading(p, 'Appendix C'))
appd = next(p for p in paras if is_heading(p, 'Appendix D'))
body_children = list(doc.element.body)
i_c = body_children.index(appc._p)
i_d = body_children.index(appd._p)
old = 0
for el in body_children[i_c + 1: i_d]:
    el.getparent().remove(el)
    old += 1
print('removed old appendix C blocks:', old)

paras = doc.paragraphs
appd = next(p for p in paras if is_heading(p, 'Appendix D'))
for name, caption in FIGURES:
    pic = appd.insert_paragraph_before()
    pic.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic.add_run().add_picture(os.path.join(IMG, name), width=Inches(6.0))
    cap = appd.insert_paragraph_before()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap.add_run(caption)
    r.italic = True
    r.font.size = Pt(10)
print('inserted figures:', len(FIGURES))

# --- 3. List of Figures line --------------------------------------------------
done = False
for p in doc.paragraphs:
    if p.text.strip() == 'Figure 5.3 — Wireframe of the main screen':
        new_p = p._p.addnext(p._p.makeelement('{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p', {}))
        from docx.text.paragraph import Paragraph
        np = Paragraph(new_p, p._parent)
        np.add_run('Figures C.1–C.23 — Screenshots of the working system (all pages)')
        done = True
        break
print('LoF line added:', done)

doc.save(DOC)
print('saved')
