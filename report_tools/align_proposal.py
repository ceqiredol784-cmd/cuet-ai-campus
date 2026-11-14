# Aligns the report with the team's actual proposal (SWE_Scheduler.pdf)
# and the seniors' report conventions.
from docx import Document

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
doc = Document(DOC)

REPLACES = [
    # cover title -> official proposal title
    ('CUET AI Campus — A Unified Smart Digital Campus Platform',
     'Smart University Event & Routine Manager'),
    ('for Students, Class Representatives and Academic Coordinators',
     '(Implemented as the CUET AI Campus platform)'),
    # team members (real, from the proposal)
    ('[Team Member 1 Name]', 'Md. Mahfuj'),
    ('[Team Member 2 Name]', 'Iftear Ahmed Tahsin'),
    ('[Team Member 3 Name]', 'Md. Abdulla Al Nishat'),
    ('Team Member 1 led', 'Md. Mahfuj led'),
    ('Team Member 2 owned', 'Iftear Ahmed Tahsin owned'),
    ('Team Member 3 owned', 'Md. Abdulla Al Nishat owned'),
    ('2204001', '2204037'),
    ('2204002', '2204041'),
    ('2204003', '2204042'),
    # supervisors (real, from the proposal)
    ('[Course Teacher 1 Name], [Designation]', 'Mir Md. Saki Kowsar, Assistant Professor'),
    ('[Course Teacher 2 Name], [Designation]', 'Md. Refaj Hossan, Lecturer'),
    ('[Course Teacher 1 Name]', 'Mir Md. Saki Kowsar'),
    ('[Course Teacher 2 Name]', 'Md. Refaj Hossan'),
]

def replace_in_paragraph(p):
    changed = False
    for old, new in REPLACES:
        if old in p.text:
            full = p.text
            for o, n in REPLACES:
                full = full.replace(o, n)
            for run in list(p.runs):
                run._element.getparent().remove(run._element)
            p.add_run(full)
            changed = True
            break
    return changed

count = 0
for p in doc.paragraphs:
    if replace_in_paragraph(p):
        count += 1
for t in doc.tables:
    for row in t.rows:
        for c in row.cells:
            for p in c.paragraphs:
                if replace_in_paragraph(p):
                    count += 1
print('paragraphs updated:', count)

# honest contact/CGPA placeholders in the team table (seniors show real values;
# ours are personal data the team must fill in)
for t in doc.tables:
    head = ' '.join(c.text for c in t.rows[0].cells)
    if 'Contact No.' in head and 'CGPA' in head:
        for row in t.rows[1:]:
            cells = row.cells
            if '0170000000' in cells[4].text:
                for run in list(cells[4].paragraphs[0].runs):
                    run._element.getparent().remove(run._element)
                cells[4].paragraphs[0].add_run('[contact no.]')
            if '3.5' in cells[6].text:
                for run in list(cells[6].paragraphs[0].runs):
                    run._element.getparent().remove(run._element)
                cells[6].paragraphs[0].add_run('[CGPA]')
        print('team table contacts/CGPA placeholderised')

doc.save(DOC)
print('saved')
