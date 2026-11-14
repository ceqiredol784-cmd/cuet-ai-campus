# Extracts every embedded figure from the report docx into ../report/
# using its figure name, so the folder holds all diagrams + screenshots.
import os
from docx import Document

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
OUT = r'D:\ALL CODE\CUET-react\report'
os.makedirs(OUT, exist_ok=True)

# inline shapes appear in document order (insertion order)
NAMES = [
    'system_overview.png', 'gantt_chart.png', 'usecase_diagram.png', 'activity_diagram.png',
    'class_diagram.png', 'sequence_diagram.png', 'architecture_diagram.png',
    'ai_architecture.png', 'component_diagram.png', 'er_diagram.png', 'gui_wireframe.png',
    'state_diagram.png', 'deployment_diagram.png',
    'screenshot_home.png', 'screenshot_updates.png', 'screenshot_routine.png',
    'screenshot_cr_center.png', 'screenshot_wizard.png', 'screenshot_review.png',
]

doc = Document(DOC)
shapes = doc.inline_shapes
assert len(shapes) == len(NAMES), f'{len(shapes)} shapes vs {len(NAMES)} names'
for shape, name in zip(shapes, NAMES):
    rId = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
    part = doc.part.related_parts[rId]
    with open(os.path.join(OUT, name), 'wb') as f:
        f.write(part.blob)
    print('extracted:', name, len(part.blob) // 1024, 'KB')
