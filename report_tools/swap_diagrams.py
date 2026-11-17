# Swaps the 13 monochrome senior-style diagrams into the report docx.
import os
from docx import Document
from docx.shared import Inches

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
IMG = r'D:\ALL CODE\CUET-react\report'

MAP = [
    ('Figure 1.1: System overview', 'system_overview.png'),
    ('Figure 2.1: Project timeline (Gantt chart)', 'gantt_chart.png'),
    ('Figure 3.1: Use case diagram', 'usecase_diagram.png'),
    ('Figure 3.2: Activity diagram of the routine proposal workflow', 'activity_diagram.png'),
    ('Figure 3.3: Class diagram of core domain entities', 'class_diagram.png'),
    ('Figure 3.4: Sequence diagram of routine proposal approval', 'sequence_diagram.png'),
    ('Figure 4.1: High-level system architecture', 'architecture_diagram.png'),
    ('Figure 4.2: AI-integration architecture', 'ai_architecture.png'),
    ('Figure 5.1: Component diagram', 'component_diagram.png'),
    ('Figure 5.2: Entity\u2013Relationship diagram', 'er_diagram.png'),
    ('Figure 5.3: Wireframe of the student home screen', 'gui_wireframe.png'),
    ('Figure E.1: Deployment diagram', 'deployment_diagram.png'),
    ('Figure E.2: State diagram of a routine proposal', 'state_diagram.png'),
]

doc = Document(DOC)
paras = doc.paragraphs
done = 0
for cap_text, fname in MAP:
    idx = next((i for i, p in enumerate(paras) if p.text.strip() == cap_text), None)
    if idx is None or idx == 0:
        print('CAPTION NOT FOUND:', cap_text)
        continue
    pic_par = paras[idx - 1]
    # remove existing runs (the old image)
    for run in list(pic_par.runs):
        run._element.getparent().remove(run._element)
    pic_par.add_run().add_picture(os.path.join(IMG, fname), width=Inches(6.0))
    done += 1
    print('swapped:', fname)
doc.save(DOC)
print('done:', done, 'of', len(MAP))
