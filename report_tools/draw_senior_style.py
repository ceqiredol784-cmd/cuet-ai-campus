# Redraws all 13 report diagrams in the seniors' monochrome draw.io-like UML style:
# white fills, thin black outlines, serif labels, faint gray grid canvas, no color.
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Ellipse, Polygon
from matplotlib.lines import Line2D

OUT = r'D:\ALL CODE\CUET-react\report'
INK = '#1a1a1a'
EDGE = '#333333'
GRID = '#ECECEC'
plt.rcParams['font.family'] = 'DejaVu Serif'

def new_ax(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')
    ax.set_facecolor('white')
    for gx in range(0, 101, 4):
        ax.add_line(Line2D([gx, gx], [0, 100], color=GRID, lw=0.5, zorder=0))
    for gy in range(0, 101, 4):
        ax.add_line(Line2D([0, 100], [gy, gy], color=GRID, lw=0.5, zorder=0))
    return fig, ax

def box(ax, x, y, w, h, text='', fs=9, bold=False, style='square,pad=0'):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=style, fc='white', ec=EDGE,
                                lw=1.1, zorder=3))
    if text:
        ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs,
                fontweight='bold' if bold else 'normal', color=INK, linespacing=1.35,
                zorder=4)

def rect(ax, x, y, w, h, text='', fs=9, bold=False):
    ax.add_patch(Rectangle((x, y), w, h, fc='white', ec=EDGE, lw=1.1, zorder=3))
    if text:
        ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs,
                fontweight='bold' if bold else 'normal', color=INK, linespacing=1.35,
                zorder=4)

def ellipse(ax, x, y, w, h, text, fs=8.5):
    ax.add_patch(Ellipse((x, y), w, h, fc='white', ec=EDGE, lw=1.1, zorder=3))
    ax.text(x, y, text, ha='center', va='center', fontsize=fs, color=INK,
            linespacing=1.25, zorder=4)

def diamond(ax, x, y, w, h, text, fs=8):
    ax.add_patch(Polygon([(x, y + h / 2), (x + w / 2, y + h), (x + w, y + h / 2),
                          (x + w / 2, y)], closed=True, fc='white', ec=EDGE, lw=1.1,
                         zorder=3))
    ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs,
            color=INK, linespacing=1.2, zorder=4)

def arrow(ax, x1, y1, x2, y2, text='', dashed=False, fs=8, loff=(0, 1.5), head=True,
          shrink=2):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='-|>' if head else '-', lw=1.0, color=EDGE,
                                linestyle='--' if dashed else '-', shrinkA=shrink,
                                shrinkB=shrink),
                zorder=5)
    if text:
        ax.text((x1 + x2) / 2 + loff[0], (y1 + y2) / 2 + loff[1], text, ha='center',
                fontsize=fs, color=INK, style='italic', zorder=4)

def line(ax, x1, y1, x2, y2, lw=1.0):
    ax.add_line(Line2D([x1, x2], [y1, y2], color=EDGE, lw=lw, zorder=2))

def actor(ax, x, y, label, s=1.0):
    ax.add_patch(Ellipse((x, y + 7 * s), 4.2 * s, 4.2 * s, fc='white', ec=INK, lw=1.2,
                         zorder=3))
    ax.add_line(Line2D([x, x], [y + 4.9 * s, y - 1.5 * s], color=INK, lw=1.2, zorder=3))
    ax.add_line(Line2D([x - 3.2 * s, x + 3.2 * s], [y + 2.6 * s, y + 2.6 * s], color=INK,
                       lw=1.2, zorder=3))
    ax.add_line(Line2D([x, x - 2.4 * s], [y - 1.5 * s, y - 6.5 * s], color=INK, lw=1.2,
                       zorder=3))
    ax.add_line(Line2D([x, x + 2.4 * s], [y - 1.5 * s, y - 6.5 * s], color=INK, lw=1.2,
                       zorder=3))
    ax.text(x, y - 10.5 * s, label, ha='center', fontsize=9, fontweight='bold',
           color=INK, zorder=4)

def title(ax, text):
    ax.text(50, 97, text, ha='center', fontsize=13, fontweight='bold', color=INK)

def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=160, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('drawn:', name)

# ---------------------------------------------------------------------------
def system_overview():
    fig, ax = new_ax(11, 7.2)
    title(ax, 'CUET AI Campus - System Overview')
    actor(ax, 10, 58, 'Student')
    actor(ax, 10, 24, 'Coordinator')
    actor(ax, 90, 44, 'Class Rep. (CR)')
    rect(ax, 24, 14, 52, 72, '')
    ax.text(50, 80, 'CUET AI Campus Platform  (React SPA + REST API)', ha='center',
            fontsize=10.5, fontweight='bold', color=INK)
    mods = [
        (28, 62, 'Updates\nFeed'), (44, 62, 'Events'), (60, 62, 'Class\nRoutine'),
        (28, 47, 'Exam\nRoutines'), (44, 47, 'Calendar'), (60, 47, 'Campus\nMap'),
        (28, 32, 'CR Center\nDeclarations'), (44, 32, 'Routine\nStudio'), (60, 32, 'Study\nMaterials'),
    ]
    for x, y, txt in mods:
        rect(ax, x, y, 12, 10, txt, fs=8)
    rect(ax, 36, 18, 28, 9, 'AI Assistant (chat)', fs=9, bold=True)
    rect(ax, 24, 0, 22, 8, 'MongoDB\n(campus data)', fs=8.5)
    rect(ax, 54, 0, 22, 8, 'LLM Provider\n(AI service)', fs=8.5)
    arrow(ax, 15, 60, 24, 60, 'view')
    arrow(ax, 15, 26, 24, 32, 'approve /\nreview')
    arrow(ax, 85, 46, 76, 50, 'declare /\nbuild routine', loff=(0, 2.2))
    arrow(ax, 38, 14, 34, 8, 'persist', loff=(-4.5, 0))
    arrow(ax, 62, 14, 66, 8, 'proxy', loff=(4.5, 0))
    save(fig, 'system_overview.png')

def gantt():
    fig, ax = new_ax(11, 6.2)
    title(ax, 'Project Timeline (Gantt chart)')
    phases = [
        ('Inception & requirements', 0, 3),
        ('Architecture & data model', 2, 4),
        ('Iteration 1: auth & profiles', 3, 5),
        ('Iteration 2: updates & events', 5, 4),
        ('Iteration 3: routine engine', 8, 4),
        ('Iteration 4: CR declarations', 11, 4),
        ('Iteration 5: approvals & proposals', 14, 4),
        ('Iteration 6: routine studio', 17, 4),
        ('Hardening & API test suite', 20, 4),
        ('UAT & documentation', 23, 4),
    ]
    for i, (name, start, dur) in enumerate(phases):
        y = 90 - i * 8.4
        ax.add_patch(Rectangle((6 + start * 3.4, y - 2.6), dur * 3.4, 5.2, fc='white',
                               ec=EDGE, lw=1.1, zorder=3))
        ax.text(5.4, y, name, ha='right', va='center', fontsize=8.5, color=INK)
    for wk in range(0, 28, 2):
        x = 6 + wk * 3.4
        ax.add_line(Line2D([x, x], [6, 92], color=GRID, lw=0.6, zorder=1))
        ax.text(x, 3, f'W{wk}', ha='center', fontsize=7.5, color=INK)
    save(fig, 'gantt_chart.png')

def use_case():
    fig, ax = new_ax(11.5, 7)
    title(ax, 'Use Case Diagram - CUET AI Campus')
    ax.add_patch(Rectangle((22, 4), 56, 88, fc='white', ec=EDGE, lw=1.3, zorder=2))
    ax.text(50, 89, 'CUET AI Campus', ha='center', fontsize=10, fontweight='bold',
            color=INK)
    cases = {
        'Sign in / authenticate': (50, 80),
        'View updates feed': (36, 69),
        'View class routine': (64, 69),
        'View exam routine': (36, 58),
        'Chat with AI assistant': (64, 58),
        'Declare class change': (36, 46),
        'Declare day-off / mid-break': (36, 35),
        'Build routine proposal': (64, 40.5),
        'Review / approve proposal': (64, 24),
        'View campus map & materials': (36, 16),
    }
    for label, (x, y) in cases.items():
        ellipse(ax, x, y, 24, 8.6, label)
    actor(ax, 8, 62, 'Student')
    actor(ax, 8, 24, 'Coordinator')
    actor(ax, 92, 44, 'CR')
    for target in ['Sign in / authenticate', 'View updates feed', 'View class routine',
                   'View exam routine', 'Chat with AI assistant', 'View campus map & materials']:
        x, y = cases[target]
        line(ax, 12, 62, x - 12, y)
    for target in ['Review / approve proposal', 'Sign in / authenticate']:
        x, y = cases[target]
        line(ax, 12, 24, x - 12, y)
    for target in ['Declare class change', 'Declare day-off / mid-break',
                   'Build routine proposal', 'Sign in / authenticate']:
        x, y = cases[target]
        line(ax, 88, 44, x + 12, y)
    arrow(ax, 64, 36.2, 64, 28.3, '', dashed=True)
    ax.text(76, 32, '\u00abextend\u00bb revise', fontsize=7.5, style='italic', ha='center')
    save(fig, 'usecase_diagram.png')

def activity():
    fig, ax = new_ax(9.5, 8.5)
    title(ax, 'Activity Diagram - Routine Proposal Workflow')
    ax.add_patch(Ellipse((50, 93), 6, 3.4, fc='white', ec=EDGE, lw=1.1, zorder=3))
    ax.text(50, 93, 'start', ha='center', va='center', fontsize=8, color=INK, zorder=4)
    rect(ax, 38, 84, 24, 6, 'CR builds routine entries', fs=8.5)
    rect(ax, 38, 74, 24, 6, 'Submit proposal', fs=8.5)
    rect(ax, 38, 64, 24, 6, 'Stored as pending', fs=8.5)
    rect(ax, 38, 54, 24, 6, 'Coordinator review', fs=8.5)
    diamond(ax, 40, 42, 20, 9, 'Approved?', fs=8.5)
    rect(ax, 38, 26, 24, 7, 'Publish: replace routine', fs=8.5)
    rect(ax, 6, 26, 26, 7, 'Return with note', fs=8.5)
    rect(ax, 38, 14, 24, 6, 'CR revises entries', fs=8.5)
    ax.add_patch(Ellipse((50, 4), 6, 3.4, fc='white', ec=EDGE, lw=1.1, zorder=3))
    ax.text(50, 4, 'end', ha='center', va='center', fontsize=8, color=INK, zorder=4)
    arrow(ax, 50, 91.3, 50, 90)
    arrow(ax, 50, 84, 50, 80)
    arrow(ax, 50, 74, 50, 70)
    arrow(ax, 50, 64, 50, 60)
    arrow(ax, 50, 54, 50, 51)
    arrow(ax, 50, 42, 50, 33)
    ax.text(52, 38, 'yes', fontsize=8, color=INK)
    arrow(ax, 40, 46.5, 19, 33)
    ax.text(26, 42, 'no', fontsize=8, color=INK)
    arrow(ax, 19, 26, 38, 18)
    line(ax, 38, 17, 36, 17)
    arrow(ax, 36, 17, 36, 77, '', dashed=True)
    arrow(ax, 36, 77, 38, 77, '', dashed=True)
    ax.text(33, 46, 'resubmit', fontsize=7.5, style='italic', ha='right', color=INK)
    line(ax, 62, 29.5, 70, 29.5)
    line(ax, 70, 29.5, 70, 4)
    arrow(ax, 70, 4, 53.2, 4)
    save(fig, 'activity_diagram.png')


def _usecase_actor(name, cases, fname):
    fig, ax = new_ax(8.5, 9.5)
    title(ax, f'Use Case Diagram - {name}')
    actor(ax, 9, 48, name)
    ax.add_patch(Rectangle((22, 4), 56, 88, fc='white', ec=EDGE, lw=1.3, zorder=2))
    ax.text(50, 88.5, 'CUET AI Campus', ha='center', fontsize=10, fontweight='bold',
            color=INK)
    n = len(cases)
    top, bottom = 82, 12
    step = (top - bottom) / (n - 1) if n > 1 else 0
    for k, label in enumerate(cases):
        y = top - k * step
        ellipse(ax, 50, y, 40, 7.2, label, fs=8.5)
        line(ax, 13, 50, 30, y)
    save(fig, fname)

def usecase_student():
    _usecase_actor('Student', [
        'Sign in / authenticate',
        'View updates feed',
        'View class routine',
        'View exam routine',
        'View academic calendar',
        'View campus map',
        'Download study materials',
        'Submit assignments',
        'Chat with AI assistant',
    ], 'usecase_student.png')

def usecase_cr():
    _usecase_actor('CR', [
        'Sign in / authenticate',
        'Compose batch-wide update',
        'Declare class change',
        'Declare day-off / mid-break',
        'Declare CT / quiz / viva',
        'Build routine proposal (studio)',
        'Edit published routine entry',
        'Submit proposal for approval',
        'Schedule exam entries',
    ], 'usecase_cr.png')

def usecase_coordinator():
    _usecase_actor('Coordinator', [
        'Sign in / authenticate',
        'Review routine proposals',
        'Approve / reject proposal',
        'Review exam schedules',
        'Publish notices',
        'Manage students & CRs',
        'Manage courses & sections',
        'View audit log',
        'Declare end of classes',
    ], 'usecase_coordinator.png')

def activity_rolesplit():
    fig, ax = new_ax(12, 10)
    ax.text(50, 99.5, 'Activity Diagram - CUET AI Campus', ha='center', va='top',
            fontsize=13, fontweight='bold', color=INK)
    ax.add_patch(Ellipse((50, 94), 5, 3, fc=INK, ec=EDGE, lw=1.0, zorder=3))
    rect(ax, 43, 86, 14, 5, 'Login', fs=9, bold=True)
    diamond(ax, 45, 76, 10, 7, '', fs=8)
    arrow(ax, 50, 92.5, 50, 91, shrink=0)
    arrow(ax, 50, 86, 50, 83, shrink=0)
    ax.text(24, 72.5, 'As Student', fontsize=8.5, style='italic', ha='center', color=INK)
    ax.text(50, 72.5, 'As CR', fontsize=8.5, style='italic', ha='center', color=INK)
    ax.text(80, 72.5, 'As Coordinator', fontsize=8.5, style='italic', ha='center', color=INK)

    def chain(x, w, items, y0=68, step=8):
        ys = []
        for k, txt in enumerate(items):
            y = y0 - k * step
            rect(ax, x - w / 2, y - 5, w, 6.4, txt, fs=8)
            ys.append(y)
        return ys

    def vlink(x, y1, y2):
        arrow(ax, x, y1, x, y2, shrink=0)

    # Student branch (left)
    ys = chain(17, 24, ['View updates & events', 'Check routine & exams',
                        'Download materials', 'Submit assignments',
                        'Chat with AI assistant'])
    arrow(ax, 45, 79.5, 17, 69.6, shrink=0)
    for a, b in zip(ys, ys[1:]):
        vlink(17, a - 5, b + 0.2)
    ax.add_patch(Ellipse((17, 25), 5, 3, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.add_patch(Ellipse((17, 25), 1.8, 1.1, fc=INK, ec=EDGE, lw=1.0, zorder=4))
    arrow(ax, 17, ys[-1] - 5, 17, 26.6, shrink=0)
    # CR branch (middle)
    ys = chain(50, 26, ['Open CR Center', 'Declare class / day-off / CT',
                        'Build routine in studio', 'Submit proposal'])
    arrow(ax, 50, 83, 50, 69.6, shrink=0)
    for a, b in zip(ys, ys[1:]):
        vlink(50, a - 5, b + 0.2)
    diamond(ax, 42, 26, 16, 8, 'Approved?', fs=8)
    arrow(ax, 50, ys[-1] - 5, 50, 34, shrink=0)
    ax.add_patch(Ellipse((50, 17), 5, 3, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.add_patch(Ellipse((50, 17), 1.8, 1.1, fc=INK, ec=EDGE, lw=1.0, zorder=4))
    arrow(ax, 50, 26, 50, 18.6, shrink=0)
    ax.text(52, 22.5, 'yes', fontsize=8, color=INK)
    line(ax, 42, 30, 32, 30)
    line(ax, 32, 30, 32, 48)
    arrow(ax, 32, 48, 38.6, 48, shrink=0)
    ax.text(30, 39, 'no: revise', fontsize=7.5, style='italic', ha='right', color=INK)
    # Coordinator branch (right)
    ys = chain(83, 26, ['Open review queue', 'Review proposals & exams',
                        'Approve / reject', 'Notify batch'])
    arrow(ax, 55, 79.5, 83, 69.6, shrink=0)
    for a, b in zip(ys, ys[1:]):
        vlink(83, a - 5, b + 0.2)
    ax.add_patch(Ellipse((83, 33), 5, 3, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.add_patch(Ellipse((83, 33), 1.8, 1.1, fc=INK, ec=EDGE, lw=1.0, zorder=4))
    arrow(ax, 83, ys[-1] - 5, 83, 34.6, shrink=0)
    save(fig, 'activity_diagram.png')


def class_diagram():
    fig, ax = new_ax(13, 9.5)
    ax.set_xlim(-1, 131)
    ax.set_ylim(6, 100)
    for gx in range(0, 131, 5):
        ax.add_line(Line2D([gx, gx], [6, 100], color=GRID, lw=0.5, zorder=0))
    for gy in range(6, 101, 5):
        ax.add_line(Line2D([0, 130], [gy, gy], color=GRID, lw=0.5, zorder=0))
    ax.text(65, 98.5, 'Class Diagram - Core Domain Entities', ha='center', va='top',
            fontsize=13, fontweight='bold', color=INK)
    SP = 2.9
    def cls(x, y, w, name, attrs, methods=None):
        h = 5 + len(attrs) * SP
        if methods:
            h += 3.2 + len(methods) * SP
        rect(ax, x, y - h, w, h, '')
        ax.text(x + w / 2, y - 2.5, name, ha='center', fontsize=8.5, fontweight='bold',
                color=INK, zorder=4)
        line(ax, x, y - 5, x + w, y - 5)
        for k, a in enumerate(attrs):
            ax.text(x + 1.2, y - 6.4 - k * SP, a, ha='left', va='center', fontsize=7.2,
                    color=INK, zorder=4)
        if methods:
            my = y - 5 - len(attrs) * SP
            line(ax, x, my, x + w, my)
            for k, m in enumerate(methods):
                ax.text(x + 1.2, my - 1.9 - k * SP, m, ha='left', va='center',
                        fontsize=7.2, color=INK, zorder=4)
    def card(x, y, s):
        ax.text(x, y, s, fontsize=7.5, color=INK, ha='center')
    # ---- row 1 (bottoms in comments) --------------------------------------
    cls(2, 94, 20, 'Department', ['- _id (PK)', '- name', '- code'])                    # 80.3
    cls(28, 94, 20, 'Batch',
        ['- _id (PK)', '- batchNumber', '- label', '- departmentId (FK)'])              # 77.4
    cls(54, 94, 24, 'Section',
        ['- _id (PK)', '- name', '- label', '- batchId (FK)', '- termId (FK)'])         # 74.5
    cls(84, 94, 24, 'Exam',
        ['- _id (PK)', '- sectionId (FK)', '- courseId (FK)', '- examType',
         '- examDate', '- status'])                                                     # 71.6
    # ---- row 2 ------------------------------------------------------------
    cls(2, 69, 22, 'Course',
        ['- _id (PK)', '- code', '- title', '- departmentId (FK)'])                     # 52.4
    cls(28, 69, 20, 'Teacher',
        ['- _id (PK)', '- name', '- designation', '- departmentId (FK)'])               # 52.4
    cls(52, 69, 26, 'RoutineEntry',
        ['- _id (PK)', '- sectionId (FK)', '- day', '- periodStart',
         '- periodEnd', '- courseCode (FK)', '- teachers', '- room',
         '- classType'])                                                                # 37.9
    cls(82, 69, 22, 'RoutineProposal',
        ['- _id (PK)', '- sectionId (FK)', '- status', '- entries',
         '- submittedBy (FK)', '- reviewNote'],
        ['+ approve(by)', '+ reject(by, note)'])                                        # 37.6
    cls(108, 69, 22, 'User',
        ['- _id (PK)', '- email', '- studentId', '- role', '- sectionId (FK)'],
        ['+ authenticate()', '+ permissions()'])                                        # 40.5
    # ---- row 3 ------------------------------------------------------------
    cls(2, 32, 18, 'StudyMaterial',
        ['- _id (PK)', '- title', '- url', '- courseId (FK)'])                          # 15.4
    cls(24, 32, 22, 'Assignment',
        ['- _id (PK)', '- sectionId (FK)', '- courseId (FK)', '- title',
         '- deadline', '- status'])                                                     # 9.6
    cls(50, 32, 24, 'ScheduleOverride',
        ['- _id (PK)', '- sectionId (FK)', '- type', '- status',
         '- specificDate', '- groupId'])                                                # 9.6
    cls(78, 32, 24, 'Update',
        ['- _id (PK)', '- authorId (FK)', '- sectionId (FK)', '- type',
         '- title', '- eventDateTime'])                                                 # 9.6
    cls(106, 32, 24, 'Notification',
        ['- _id (PK)', '- userId (FK)', '- title', '- type', '- readAt'])               # 12.5
    # ---- connectors -------------------------------------------------------
    line(ax, 22, 88, 28, 88); card(23.2, 89.4, '1'); card(26.8, 89.4, 'N')
    ax.text(25, 90.8, 'groups', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 48, 88, 54, 88); card(49.2, 89.4, '1'); card(52.8, 89.4, 'N')
    ax.text(51, 90.8, 'splits', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 78, 82, 84, 82); card(79, 83.4, '1'); card(83, 83.4, 'N')
    line(ax, 12, 80.3, 12, 69); card(13.6, 77.8, '1'); card(13.6, 70.4, 'N')
    ax.text(14, 74.5, 'offers', fontsize=7, style='italic', ha='left', color=INK)
    line(ax, 20, 81.5, 30, 68.5); card(17.8, 78.8, '1'); card(31.5, 70, 'N')
    ax.text(21, 70.2, 'employs', fontsize=7, style='italic', ha='left', color=INK)
    line(ax, 62, 74.5, 62, 69); card(63.4, 73, '1'); card(63.4, 70.4, 'N')
    ax.text(64, 71.5, 'has entries', fontsize=7, style='italic', ha='left', color=INK)
    # Section - RoutineProposal (down the 78-82 corridor into the left edge)
    line(ax, 76, 74.5, 82, 66); card(73.5, 73.6, '1'); card(80.5, 64.8, 'N')
    ax.text(76.5, 70.5, 'targets', fontsize=7, style='italic', ha='center', color=INK)
    # Section - User (elbow: corridor, then under Exam, then up into User top)
    line(ax, 78, 74.5, 80, 73)
    line(ax, 80, 73, 80, 70.5)
    line(ax, 80, 70.5, 116, 70.5)
    arrow(ax, 116, 70.5, 116, 69.2, shrink=0)
    card(81.3, 71.8, '1'); card(114, 71.6, 'N')
    # Course - RoutineEntry
    line(ax, 24, 52.4, 52, 41); card(25.5, 51, '1'); card(49.5, 43, 'N')
    ax.text(38, 44, 'scheduled as', fontsize=7, style='italic', ha='center', color=INK)
    # Course - Assignment
    line(ax, 20, 52.4, 30, 32.2); card(18.6, 51, '1'); card(31.5, 34, 'N')
    ax.text(19, 40.5, 'assigned in', fontsize=7, style='italic', ha='center', color=INK)
    # Course - StudyMaterial
    line(ax, 12, 52.4, 12, 32); card(13.4, 50.5, '1'); card(13.4, 34, 'N')
    ax.text(13.4, 43, 'shared', fontsize=7, style='italic', ha='left', color=INK)
    # ScheduleOverride - RoutineEntry
    line(ax, 62, 32, 62, 37.9); card(63.4, 34, 'N'); card(63.4, 36.5, '1')
    ax.text(64, 35, 'modifies', fontsize=7, style='italic', ha='left', color=INK)
    # User - Update / Notification (spine down the right margin)
    line(ax, 119, 40.5, 119, 32.2)
    line(ax, 119, 36, 90, 36)
    arrow(ax, 90, 36, 90, 32.2, shrink=0)
    arrow(ax, 119, 36, 119, 32.2, shrink=0)
    card(117.5, 44, '1'); card(91.5, 37.4, 'N'); card(120.5, 34.5, 'N')
    ax.text(97, 34.2, 'authors', fontsize=6.8, style='italic', ha='center', color=INK)
    # Update - Notification
    line(ax, 102, 22, 106, 22); card(103, 23.4, '1'); card(105, 23.4, 'N')
    save(fig, 'class_diagram.png')

def sequence():
    fig, ax = new_ax(11, 7.5)
    title(ax, 'Sequence Diagram - Routine Proposal Approval')
    lanes = [('CR', 10), ('Web app', 30), ('API', 52), ('MongoDB', 72), ('Coordinator', 90)]
    for name, x in lanes:
        rect(ax, x - 8, 88, 16, 5, name, fs=9, bold=True)
        ax.add_line(Line2D([x, x], [88, 8], color=EDGE, lw=0.9, ls=(0, (4, 3)), zorder=2))
    def msg(x1, x2, y, text, dashed=False, lx=None):
        arrow(ax, x1, y, x2, y, '', dashed=dashed)
        if lx is None:
            lx = (x1 + x2) / 2
        ax.text(lx, y + 1.4, text, ha='center', fontsize=7.8, color=INK, zorder=4)
    msg(10, 30, 82, 'compose entries')
    msg(30, 52, 76, 'POST /routine-proposals')
    msg(52, 72, 70, 'insert pending proposal')
    msg(72, 52, 64, 'saved', dashed=True)
    msg(52, 30, 58, '201 pending', dashed=True)
    msg(90, 52, 50, 'list pending', lx=60)
    msg(52, 72, 44, 'fetch proposal')
    msg(72, 52, 38, 'proposal doc', dashed=True)
    msg(52, 90, 32, 'review table', lx=60)
    msg(90, 52, 24, 'approve / reject', lx=60)
    msg(52, 72, 18, 'apply outcome')
    msg(52, 10, 12, 'notify', lx=20)
    save(fig, 'sequence_diagram.png')

def architecture():
    fig, ax = new_ax(11, 7.5)
    title(ax, 'High-Level System Architecture')
    rect(ax, 6, 74, 88, 16, '')
    ax.text(50, 87, 'Client layer', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 10, 76, 24, 8, 'React SPA\n(student / CR / coordinator)', fs=8)
    rect(ax, 38, 76, 24, 8, 'Role-scoped routing\n& auth context', fs=8)
    rect(ax, 66, 76, 24, 8, 'REST client\n(fetch wrapper)', fs=8)
    rect(ax, 6, 52, 88, 16, '')
    ax.text(50, 65, 'Application layer (Express REST API)', ha='center', fontsize=9,
            fontweight='bold', color=INK)
    rect(ax, 10, 54, 24, 8, 'Route handlers\n/role guards', fs=8)
    rect(ax, 38, 54, 24, 8, 'Domain services\n(routine, exams)', fs=8)
    rect(ax, 66, 54, 24, 8, 'Access control\n(CR / coordinator)', fs=8)
    rect(ax, 6, 30, 88, 16, '')
    ax.text(50, 43, 'Data layer', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 22, 32, 24, 8, 'Mongoose models', fs=8)
    rect(ax, 54, 32, 24, 8, 'MongoDB\n(campus data)', fs=8)
    rect(ax, 6, 6, 88, 16, '')
    ax.text(50, 19, 'External services', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 22, 8, 24, 8, 'LLM provider\n(proxied chat API)', fs=8)
    rect(ax, 54, 8, 24, 8, 'Object storage\n(PDF / image uploads)', fs=8)
    arrow(ax, 50, 74, 50, 68, 'HTTPS / JSON')
    arrow(ax, 50, 52, 50, 46, 'queries')
    arrow(ax, 50, 30, 50, 22, 'outbound calls')
    save(fig, 'architecture_diagram.png')

def ai_architecture():
    fig, ax = new_ax(11, 7)
    title(ax, 'AI-Integration Architecture')
    rect(ax, 4, 60, 18, 14, 'Chat UI\n(AiChatPage)', fs=8.5)
    rect(ax, 28, 60, 20, 14, 'API chat route\n(auth, rate limit)', fs=8.5)
    rect(ax, 54, 66, 20, 8, 'Context builder\n(routine, calendar)', fs=8)
    rect(ax, 54, 52, 20, 8, 'Prompt assembly\n(system + history)', fs=8)
    rect(ax, 80, 56, 16, 12, 'LLM provider\n(proxied)', fs=8.5)
    rect(ax, 28, 34, 20, 12, 'Guardrails\n(scope, length)', fs=8.5)
    rect(ax, 4, 34, 18, 12, 'MongoDB\n(campus data)', fs=8.5)
    rect(ax, 54, 34, 20, 12, 'Response render\n(markdown)', fs=8.5)
    rect(ax, 80, 34, 16, 12, 'Conversation\nlog', fs=8.5)
    arrow(ax, 22, 67, 28, 67, 'message')
    arrow(ax, 48, 68, 54, 70, '')
    arrow(ax, 48, 64, 54, 57, '')
    arrow(ax, 74, 68, 80, 65, 'prompt')
    arrow(ax, 80, 57, 74, 54, 'completion', loff=(0, -2.6))
    arrow(ax, 64, 52, 48, 42, '')
    arrow(ax, 28, 40, 22, 40, 'context query')
    arrow(ax, 48, 40, 54, 40, 'answer')
    arrow(ax, 74, 40, 80, 40, 'store turn')
    save(fig, 'ai_architecture.png')

def component():
    fig, ax = new_ax(11, 7.5)
    title(ax, 'Component Diagram')
    rect(ax, 4, 78, 92, 14, '')
    ax.text(50, 89, 'Web client (React SPA)', ha='center', fontsize=9, fontweight='bold',
            color=INK)
    for x, name in [(7, 'ShellLayout\n(nav, theme)'), (30, 'Feature pages\n(home, routine)'),
                    (53, 'CR Center\ndialogs'), (76, 'API client\n(endpoints)')]:
        rect(ax, x, 80, 20, 8, name, fs=7.5)
    rect(ax, 4, 44, 92, 14, '')
    ax.text(50, 55, 'API server (Express)', ha='center', fontsize=9, fontweight='bold',
            color=INK)
    for x, name in [(7, 'Auth\nmiddleware'), (30, 'Routine\nroutes'), (53, 'Updates /\nevents routes'),
                    (76, 'AI chat\nroute')]:
        rect(ax, x, 46, 20, 8, name, fs=7.5)
    rect(ax, 4, 10, 92, 14, '')
    ax.text(50, 21, 'Data & services', ha='center', fontsize=9, fontweight='bold', color=INK)
    for x, name in [(7, 'Access\nservice'), (30, 'Routine\nserializer'), (53, 'Mongoose\nmodels'),
                    (76, 'LLM\nproxy')]:
        rect(ax, x, 12, 20, 8, name, fs=7.5)
    arrow(ax, 86, 78, 86, 58, 'REST / JSON')
    arrow(ax, 40, 44, 40, 24, 'queries')
    arrow(ax, 17, 44, 17, 24, 'guards')
    arrow(ax, 86, 44, 86, 24, 'calls')
    save(fig, 'component_diagram.png')

def er():
    fig, ax = new_ax(11.5, 8.5)
    ax.set_ylim(-6, 100)
    for gy in range(-6, 0, 3):
        ax.add_line(Line2D([0, 100], [gy, gy], color=GRID, lw=0.5, zorder=0))
    title(ax, 'Entity-Relationship Diagram')
    def ent(x, y, name, attrs):
        h = 4 + len(attrs) * 3
        rect(ax, x, y - h, 22, h, '')
        ax.text(x + 11, y - 2, name, ha='center', fontsize=8.5, fontweight='bold',
                color=INK, zorder=4)
        line(ax, x, y - 4, x + 22, y - 4)
        for k, a in enumerate(attrs):
            ax.text(x + 1.2, y - 5.5 - k * 3, a, ha='left', va='center', fontsize=7,
                    color=INK, zorder=4)
    ent(6, 94, 'USER', ['_id (PK)', 'email', 'role', 'sectionId (FK)'])
    ent(40, 94, 'SECTION', ['_id (PK)', 'batch', 'name'])
    ent(72, 94, 'COURSE', ['_id (PK)', 'code', 'title', 'departmentId (FK)'])
    ent(6, 64, 'ROUTINE', ['_id (PK)', 'sectionId (FK)', 'weekType'])
    ent(38, 64, 'ROUTINE_ENTRY', ['_id (PK)', 'routineId (FK)', 'day', 'period',
                                  'courseCode (FK)', 'room', 'classType'])
    ent(72, 64, 'ROUTINE_PROPOSAL', ['_id (PK)', 'sectionId (FK)', 'status', 'entries',
                                     'submittedBy (FK)'])
    ent(6, 32, 'DAY_DECLARATION', ['_id (PK)', 'groupId', 'day', 'kind', 'scope'])
    ent(38, 32, 'UPDATE', ['_id (PK)', 'title', 'body', 'audience'])
    ent(72, 32, 'EVENT', ['_id (PK)', 'title', 'startsAt', 'audience'])
    ent(38, 14, 'EXAM_ENTRY', ['_id (PK)', 'sectionId (FK)', 'courseCode (FK)',
                               'examDate'])
    def rel(x1, y1, x2, y2, c1, c2, label, lx, ly):
        line(ax, x1, y1, x2, y2)
        if label:
            ax.text(lx, ly, label, fontsize=7, style='italic', ha='center', color=INK)
        ax.text(x1 + (x2 - x1) * 0.2, y1 + (y2 - y1) * 0.2 + 1.2, c1, fontsize=7.5, color=INK)
        ax.text(x1 + (x2 - x1) * 0.8, y1 + (y2 - y1) * 0.8 + 1.2, c2, fontsize=7.5, color=INK)
    rel(28, 88, 40, 88, 'N', '1', 'belongs to', 34, 89.8)
    rel(62, 88, 72, 88, '1', 'N', 'offered to', 67, 89.8)
    line(ax, 51, 79, 51, 64)
    ax.text(52.2, 77, '1', fontsize=7.5, color=INK)
    ax.text(52.2, 65.6, 'N', fontsize=7.5, color=INK)
    ax.text(54.5, 71.5, 'has entries', fontsize=7, style='italic', ha='left', color=INK)
    rel(28, 58, 38, 56, '1', 'N', 'contains', 32, 59.6)
    rel(60, 56, 72, 54, 'N', '1', 'mirrored in', 66, 57.8)
    line(ax, 6, 24, 2, 24)
    line(ax, 2, 24, 2, 72)
    line(ax, 2, 72, 42, 72)
    line(ax, 42, 72, 42, 79)
    ax.text(43.2, 80.2, '1', fontsize=7.5, color=INK)
    ax.text(20, 73.6, 'declared for', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 38, 8, 2, 8)
    ax.text(17, 9.6, 'examined in', fontsize=7, style='italic', ha='center', color=INK)
    save(fig, 'er_diagram.png')

def wireframe():
    fig, ax = new_ax(11, 7.5)
    title(ax, 'Wireframe of the Student Home Screen')
    rect(ax, 4, 86, 92, 8, 'Top bar:  CUET AI Campus        search        notifications        profile', fs=8.5)
    rect(ax, 4, 74, 14, 10, 'Side\nnav', fs=8.5)
    for i, name in enumerate(['Home', 'Updates', 'Routine', 'Exams', 'Calendar', 'Map',
                              'Materials', 'AI chat']):
        rect(ax, 4, 68 - i * 7, 14, 6, name, fs=7.5)
    rect(ax, 22, 62, 44, 22, '')
    ax.text(44, 81, 'Today at a glance', ha='center', fontsize=8.5, fontweight='bold', color=INK)
    for k in range(3):
        line(ax, 24, 76 - k * 5, 64, 76 - k * 5)
    rect(ax, 70, 62, 26, 22, '')
    ax.text(83, 81, 'Next class', ha='center', fontsize=8.5, fontweight='bold', color=INK)
    line(ax, 72, 76, 94, 76); line(ax, 72, 71, 94, 71)
    rect(ax, 22, 44, 34, 14, '')
    ax.text(39, 55, 'Updates feed', ha='center', fontsize=8.5, fontweight='bold', color=INK)
    for k in range(2):
        line(ax, 24, 50 - k * 4, 54, 50 - k * 4)
    rect(ax, 62, 44, 34, 14, '')
    ax.text(79, 55, 'Upcoming events', ha='center', fontsize=8.5, fontweight='bold', color=INK)
    for k in range(2):
        line(ax, 64, 50 - k * 4, 94, 50 - k * 4)
    rect(ax, 22, 26, 74, 14, '')
    ax.text(59, 37, 'This week - period grid (P1-P9 with Break / Lunch)', ha='center',
            fontsize=8.5, fontweight='bold', color=INK)
    for k in range(3):
        line(ax, 24, 32 - k * 4, 94, 32 - k * 4)
    rect(ax, 22, 8, 74, 12, '')
    ax.text(59, 16, 'Notices & quick actions', ha='center', fontsize=8.5,
            fontweight='bold', color=INK)
    line(ax, 24, 12, 94, 12)
    save(fig, 'gui_wireframe.png')

def state_diagram():
    fig, ax = new_ax(10.5, 5.5)
    title(ax, 'State Diagram - Routine Proposal')
    ax.add_patch(Ellipse((8, 50), 4, 3, fc=INK, ec=EDGE, lw=1.0, zorder=3))
    rbox = 'round,pad=0.4'
    box(ax, 14, 46, 16, 8, 'Draft', fs=9, bold=True, style=rbox)
    box(ax, 40, 46, 18, 8, 'Pending', fs=9, bold=True, style=rbox)
    box(ax, 68, 60, 18, 8, 'Approved', fs=9, bold=True, style=rbox)
    box(ax, 68, 32, 18, 8, 'Rejected', fs=9, bold=True, style=rbox)
    box(ax, 40, 14, 18, 8, 'Withdrawn', fs=9, bold=True, style=rbox)
    ax.add_patch(Ellipse((94, 50), 4, 3, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.add_patch(Ellipse((94, 50), 1.4, 1.05, fc=INK, ec=EDGE, lw=1.0, zorder=4))
    arrow(ax, 9.5, 50, 14, 50, 'submit')
    arrow(ax, 30, 50, 40, 50, 'submit /\nreplace prior', loff=(-4, 2.6))
    arrow(ax, 58, 52, 68, 62)
    ax.text(56, 65.5, 'coordinator approves', fontsize=7.5, style='italic', ha='center', color=INK)
    arrow(ax, 58, 48, 68, 36)
    ax.text(55.5, 42.6, 'coordinator\nrejects', fontsize=7.5, style='italic', ha='center', color=INK, linespacing=1.1)
    arrow(ax, 77, 68, 77, 76, '', dashed=True)
    arrow(ax, 77, 76, 49, 76, '', dashed=True)
    arrow(ax, 49, 76, 49, 54, '', dashed=True)
    ax.text(63, 77.6, 'revise & resubmit', fontsize=7.5, style='italic', ha='center', color=INK)
    arrow(ax, 49, 46, 49, 22, 'CR withdraws', loff=(-6.5, 0))
    arrow(ax, 86, 60, 94, 52, 'published', loff=(0, 5))
    arrow(ax, 86, 32, 94, 48, 'closed')
    save(fig, 'state_diagram.png')

def deployment():
    fig, ax = new_ax(11, 7)
    title(ax, 'Deployment Diagram')
    rect(ax, 4, 66, 24, 22, '')
    ax.text(16, 84, 'Student device', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 7, 70, 18, 9, 'Browser\n(React SPA)', fs=8)
    rect(ax, 38, 66, 26, 22, '')
    ax.text(51, 84, 'Application host', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 41, 76, 20, 6, 'Static build\n(Vite bundle)', fs=7.5)
    rect(ax, 41, 68, 20, 6, 'Express API\n(Node.js)', fs=7.5)
    rect(ax, 72, 66, 24, 22, '')
    ax.text(84, 84, 'Data & services', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 75, 76, 18, 6, 'MongoDB', fs=8)
    rect(ax, 75, 68, 18, 6, 'LLM provider', fs=8)
    rect(ax, 4, 30, 24, 22, '')
    ax.text(16, 48, 'Coordinator device', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 7, 34, 18, 9, 'Browser\n(review UI)', fs=8)
    rect(ax, 4, 4, 24, 16, '')
    ax.text(16, 16, 'Test runner', ha='center', fontsize=9, fontweight='bold', color=INK)
    rect(ax, 7, 7, 18, 6, 'node --test', fs=8)
    arrow(ax, 28, 77, 38, 77, 'HTTPS', loff=(0, 1.5))
    arrow(ax, 28, 41, 38, 72, 'HTTPS', loff=(-2, 2))
    arrow(ax, 64, 77, 72, 79, 'TCP')
    arrow(ax, 64, 70, 72, 71, 'TLS')
    arrow(ax, 28, 12, 41, 68, 'CI / local runs', loff=(0, -2))
    save(fig, 'deployment_diagram.png')

system_overview()
gantt()
usecase_student()
usecase_cr()
usecase_coordinator()
activity_rolesplit()
class_diagram()
sequence()
architecture()
ai_architecture()
component()
er()
wireframe()
state_diagram()
deployment()
print('all done')
