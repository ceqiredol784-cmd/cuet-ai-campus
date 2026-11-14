# Updates the docx:
#  1. Figure C.5 -> fresh routine screenshot
#  2. Figure 3.1 -> per-actor use case diagrams (Student / CR / Coordinator),
#     inserting two new captioned figures and renumbering 3.2-3.4 to 3.4-3.6
#  3. Activity diagram image swapped to the role-split version
import os
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.text.paragraph import Paragraph

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
OUT = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report_v2.docx'
IMG = r'D:\ALL CODE\CUET-react\report'
doc = Document(DOC)
paras = doc.paragraphs

def set_text(p, text):
    for run in list(p.runs):
        run._element.getparent().remove(run._element)
    p.add_run(text)

def swap_pic_before(caption_prefix, fname, new_caption=None):
    idx = next((i for i, p in enumerate(paras) if p.text.strip().startswith(caption_prefix)), None)
    if idx is None:
        print('NOT FOUND:', caption_prefix)
        return None
    pic_par = paras[idx - 1]
    for run in list(pic_par.runs):
        run._element.getparent().remove(run._element)
    pic_par.add_run().add_picture(os.path.join(IMG, fname), width=Inches(6.0))
    if new_caption:
        set_text(paras[idx], new_caption)
    print('swapped:', caption_prefix, '->', fname)
    return idx

# --- 1. Appendix C routine screenshot ---------------------------------------
swap_pic_before('Figure C.5:', 'screen-05-routine.png')

# --- 2. use case diagrams ----------------------------------------------------
i31 = swap_pic_before('Figure 3.1: Use case diagram', 'usecase_student.png',
                      'Figure 3.1: Use case diagram \u2014 Student')
anchor = paras[i31 + 1]  # the caption paragraph of 3.1
# insert CR and Coordinator figure pairs after Figure 3.1 caption
for fname, cap in [('usecase_cr.png', 'Figure 3.2: Use case diagram \u2014 CR'),
                   ('usecase_coordinator.png',
                    'Figure 3.3: Use case diagram \u2014 Coordinator')]:
    el = anchor._p.makeelement(
        '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p', {})
    anchor._p.addnext(el)
    pic_p = Paragraph(el, anchor._parent)
    pic_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    pic_p.add_run().add_picture(os.path.join(IMG, fname), width=Inches(5.2))
    cap_el = pic_p._p.makeelement(
        '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p', {})
    pic_p._p.addnext(cap_el)
    cap_p = Paragraph(cap_el, pic_p._parent)
    cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = cap_p.add_run(cap)
    r.italic = True
    r.font.size = Pt(10)
    anchor = cap_p
    print('inserted:', cap)

# --- 3. renumber old 3.2/3.3/3.4 -> 3.4/3.5/3.6 and swap activity image ------
paras = doc.paragraphs
ren = {
    'Figure 3.2: Activity diagram of the routine proposal workflow':
        'Figure 3.4: Activity diagram of the system (role-wise flows)',
    'Figure 3.3: Class diagram of core domain entities':
        'Figure 3.5: Class diagram of core domain entities',
    'Figure 3.4: Sequence diagram of routine proposal approval':
        'Figure 3.6: Sequence diagram of routine proposal approval',
}
for old, new in ren.items():
    idx = next((i for i, p in enumerate(paras) if p.text.strip() == old), None)
    if idx is None:
        print('RENUMBER NOT FOUND:', old)
        continue
    set_text(paras[idx], new)
    print('renumbered:', new)

# activity image (caption now 'Figure 3.4: Activity diagram...')
paras = doc.paragraphs
idx = next(i for i, p in enumerate(paras)
           if p.text.strip().startswith('Figure 3.4: Activity diagram'))
pic_par = paras[idx - 1]
for run in list(pic_par.runs):
    run._element.getparent().remove(run._element)
pic_par.add_run().add_picture(os.path.join(IMG, 'activity_diagram.png'), width=Inches(6.0))
print('activity image swapped')

# --- 4. List of Figures ------------------------------------------------------
paras = doc.paragraphs
lof_map = {
    'Figure 3.1 \u2014 Use case diagram':
        ['Figure 3.1 \u2014 Use case diagram (Student)',
         'Figure 3.2 \u2014 Use case diagram (CR)',
         'Figure 3.3 \u2014 Use case diagram (Coordinator)'],
    'Figure 3.2 \u2014 Activity diagram of the routine proposal workflow':
        ['Figure 3.4 \u2014 Activity diagram of the system (role-wise flows)'],
    'Figure 3.3 \u2014 Class diagram of core domain entities':
        ['Figure 3.5 \u2014 Class diagram of core domain entities'],
    'Figure 3.4 \u2014 Sequence diagram of routine proposal approval':
        ['Figure 3.6 \u2014 Sequence diagram of routine proposal approval'],
}
for p in paras:
    t = p.text.strip()
    if t in lof_map:
        lines = lof_map[t]
        set_text(p, lines[0])
        prev_el = p._p
        for extra in lines[1:]:
            el = p._p.makeelement(
                '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p', {})
            prev_el.addnext(el)
            np_ = Paragraph(el, p._parent)
            np_.style = p.style
            np_.add_run(extra)
            prev_el = el
        print('LoF updated:', lines[0])

doc.save(OUT)
print('saved')
