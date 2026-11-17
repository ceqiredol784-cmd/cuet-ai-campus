# Corrected: swap system_overview + usecase images by rId, update List of Figures.
import os
from docx import Document
from docx.shared import Inches

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
IMG = r'D:\ALL CODE\CUET-react\report'
doc = Document(DOC)

shapes = doc.inline_shapes
print('total inline shapes:', len(shapes))
# order: 0 system_overview, 1 gantt, 2 usecase, ...
targets = {0: 'system_overview.png', 2: 'usecase_diagram.png'}
for idx, name in targets.items():
    shape = shapes[idx]
    rId = shape._inline.graphic.graphicData.pic.blipFill.blip.embed
    # find the paragraph containing this rId
    for par in doc.paragraphs:
        if rId in par._p.xml:
            for run in list(par.runs):
                run._element.getparent().remove(run._element)
            par.add_run().add_picture(os.path.join(IMG, name), width=Inches(5.6))
            print('swapped:', name)
            break

done = False
for p in doc.paragraphs:
    if 'Figure C.1' in p.text and 'Home screen' in p.text:
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run('Figures C.1–C.23 — Screenshots of the working system (all pages)')
        print('list of figures updated')
        done = True
        break
if not done:
    print('WARN: list of figures line not found')

doc.save(DOC)
print('saved')
