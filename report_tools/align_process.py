# 1) Process model: reconcile with the proposal (Waterfall planned -> incremental
#    reality), matching how senior reports justify their model choice.
# 2) Executive summary: add the GitHub repo line (senior convention).
from docx import Document

DOC = r'D:\ALL CODE\CUET-react\CUET_AI_Campus_CSE356_Final_Report.docx'
doc = Document(DOC)

for p in doc.paragraphs:
    t = p.text
    if t.startswith('The team followed an Incremental (iterative-enhancement) process model'):
        new = ('The project proposal initially planned the Waterfall Software Development '
               'Model. Once development began, the team shifted to an Incremental '
               '(iterative-enhancement) process model with weekly iterations. Each '
               'iteration delivered a working increment: (1) authentication and profiles, '
               '(2) updates feed and events, (3) routine engine and displays, (4) CR Center '
               'declarations, (5) approval workflows, (6) routine proposal lifecycle, (7) '
               'routine studio and section support, (8) hardening, testing and documentation. '
               'Requirements were re-prioritised at each planning meeting based on supervisor '
               'feedback.')
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run(new)
        print('2.2 process model reconciled with proposal')
    if t.startswith('Requirements for a campus tool evolve quickly'):
        new = ('Requirements for a campus tool evolve quickly once real CRs start using early '
               'builds — the declaration rules, approval semantics and routine format all '
               'changed more than once during development. This is also why the Waterfall '
               'model planned in the proposal was replaced: a strictly sequential lifecycle '
               'would have locked in wrong assumptions, and a pure Scrum setup is heavier '
               'than a three-member academic project needs. The incremental model gave us '
               'early feedback from real users (from iteration 2 onwards), kept every '
               'increment deployable, and matched the small team size. Prototyping was used '
               'locally inside iterations for UI-heavy features such as the routine timetable '
               'grid.')
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run(new)
        print('2.2.1 rationale updated')
    if t.startswith('Testing confirmed the core workflows'):
        new = t + ('\nGitHub repository: [to be filled before submission]')
        for run in list(p.runs):
            run._element.getparent().remove(run._element)
        p.add_run(new)
        print('exec summary repo line added (senior convention)')

doc.save(DOC)
print('saved')
