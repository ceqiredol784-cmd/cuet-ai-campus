# Draws the full SWE_Proposal.pdf diagram set for the CUET AI Campus project
# into report\opencode-diagram, in the seniors' monochrome draw.io-like UML
# style (white fills, thin black outlines, faint grid canvas).
#
# Diagrams (one per diagram figure in the proposal):
#   01-03  Use Case Diagrams (Student / CR / Coordinator)
#   04     Activity Diagram (role-split main workflow)
#   05     Class Diagram (core domain entities)
#   06     Sequence Diagram - Login and Routine Fetch
#   07     Sequence Diagram - CT Declaration and Instant Publish
#   08     Data-Centered Architectural Model
#   09     Structure Chart
#   10     Component Level Design (Declaration + Feed services)
#   11     First Level DFD (Context Diagram)
#   12     Student DFD (Level 1)
#   13     Coordinator DFD (Level 1)
#   14     Entity Relationship Mapping (Cardinality View)
#   15     ER Diagram
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle, FancyBboxPatch, Ellipse, Polygon, Circle
from matplotlib.lines import Line2D

OUT = r'D:\ALL CODE\CUET-react\report\opencode-diagram'
INK = '#1a1a1a'
EDGE = '#333333'
GRID = '#ECECEC'
plt.rcParams['font.family'] = 'DejaVu Serif'
os.makedirs(OUT, exist_ok=True)


def new_ax(w, h, ylim=(0, 100)):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 100)
    ax.set_ylim(*ylim)
    ax.axis('off')
    ax.set_facecolor('white')
    for gx in range(0, 101, 4):
        ax.add_line(Line2D([gx, gx], [ylim[0], ylim[1]], color=GRID, lw=0.5, zorder=0))
    for gy in range(ylim[0], ylim[1] + 1, 4):
        ax.add_line(Line2D([0, 100], [gy, gy], color=GRID, lw=0.5, zorder=0))
    return fig, ax


def rect(ax, x, y, w, h, text='', fs=9, bold=False, lw=1.1):
    ax.add_patch(Rectangle((x, y), w, h, fc='white', ec=EDGE, lw=lw, zorder=3))
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
          shrink=2, lw=1.0):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='-|>' if head else '-', lw=lw, color=EDGE,
                                linestyle='--' if dashed else '-', shrinkA=shrink,
                                shrinkB=shrink),
                zorder=5)
    if text:
        ax.text((x1 + x2) / 2 + loff[0], (y1 + y2) / 2 + loff[1], text, ha='center',
                fontsize=fs, color=INK, style='italic', zorder=6)


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


def title(ax, text, y=97):
    ax.text(50, y, text, ha='center', fontsize=13, fontweight='bold', color=INK)


def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=160, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('drawn:', name)


def end_node(ax, x, y):
    ax.add_patch(Ellipse((x, y), 5, 3, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.add_patch(Ellipse((x, y), 1.8, 1.1, fc=INK, ec=EDGE, lw=1.0, zorder=4))


# ===========================================================================
# 01-03  Use case diagrams (one actor per figure, like the proposal)
# ===========================================================================
def _usecase_actor(name, cases, fname, extra=None):
    fig, ax = new_ax(8.8, 9.8)
    title(ax, f'Use Case Diagram - {name}')
    actor(ax, 9, 48, name)
    ax.add_patch(Rectangle((21, 3), 58, 89, fc='white', ec=EDGE, lw=1.3, zorder=2))
    ax.text(50, 89, 'CUET AI Campus', ha='center', fontsize=10, fontweight='bold',
            color=INK)
    n = len(cases)
    top, bottom = 83, 9
    step = (top - bottom) / (n - 1) if n > 1 else 0
    ys = []
    for k, label in enumerate(cases):
        y = top - k * step
        ellipse(ax, 50, y, 42, 6.8, label, fs=8.5)
        line(ax, 13, 50, 29.5, y)
        ys.append(y)
    if extra:
        extra(ax, ys, step)
    save(fig, fname)


def usecase_student():
    _usecase_actor('Student', [
        'Sign in / authenticate',
        'View updates feed (upvote, mark read)',
        'View events & notice attachments',
        'View class routine & day statuses',
        'View exam routine',
        'View academic calendar',
        'View campus map',
        'Download study materials',
        'View / submit assignments',
        'View attendance',
        'Chat with AI assistant',
        'Manage profile & notifications',
    ], '01_usecase_student.png')


def usecase_cr():
    def extra(ax, ys, step):
        # «include» CT is part of extra-class declaration
        i_ct = next(i for i, _ in enumerate(ys) if True)
    _usecase_actor('CR', [
        'Sign in / authenticate',
        'Compose batch-wide update (+ PDF)',
        'Declare extra class / class test',
        'Declare class cancellation',
        'Change class room / time',
        'Declare day-off / mid-break',
        'Withdraw own declaration',
        'Schedule exam entry',
        'Build routine proposal (studio)',
        'Publish extracted routine PDF',
        'View own declarations',
    ], '02_usecase_cr.png')


def usecase_coordinator():
    _usecase_actor('Coordinator', [
        'Sign in / authenticate',
        'Review routine proposals',
        'Approve / reject proposal',
        'Review exam schedules',
        'Publish notices & events',
        'Manage students',
        'Assign / remove CRs',
        'Manage courses, sections & terms',
        'Upload & publish routine PDF',
        'View audit log',
        'Send notifications',
    ], '03_usecase_coordinator.png')


# ===========================================================================
# 04  Activity diagram (role-split main workflow)
# ===========================================================================
def activity():
    fig, ax = new_ax(12, 10)
    ax.text(50, 99.5, 'Activity Diagram - CUET AI Campus', ha='center', va='top',
            fontsize=13, fontweight='bold', color=INK)
    ax.add_patch(Ellipse((50, 94), 5, 3, fc=INK, ec=EDGE, lw=1.0, zorder=3))
    rect(ax, 43, 86, 14, 5, 'Login', fs=9, bold=True)
    diamond(ax, 45, 76, 10, 7, '', fs=8)
    arrow(ax, 50, 92.5, 50, 91, shrink=0)
    arrow(ax, 50, 86, 50, 83, shrink=0)
    ax.text(22, 72.5, 'As Student', fontsize=8.5, style='italic', ha='center', color=INK)
    ax.text(50, 72.5, 'As CR', fontsize=8.5, style='italic', ha='center', color=INK)
    ax.text(79, 72.5, 'As Coordinator', fontsize=8.5, style='italic', ha='center', color=INK)

    def chain(x, w, items, y0=68, step=8.2):
        ys = []
        for k, txt in enumerate(items):
            y = y0 - k * step
            rect(ax, x - w / 2, y - 5, w, 6.4, txt, fs=8)
            ys.append(y)
        return ys

    # Student branch (left)
    ys = chain(17, 25, ['Browse updates & events', 'Check routine / calendar',
                        'Download materials', 'Submit assignments',
                        'Chat with AI assistant'])
    arrow(ax, 45, 79.5, 17, 69.8, shrink=0)
    for a, b in zip(ys, ys[1:]):
        arrow(ax, 17, a - 5, 17, b + 0.2, shrink=0)
    end_node(ax, 17, 23)
    arrow(ax, 17, ys[-1] - 5, 17, 24.6, shrink=0)
    # CR branch (middle)
    ys = chain(50, 27, ['Open CR Center', 'Declare class change / CT',
                        'Sync to feed + calendar', 'Withdraw if wrong'])
    arrow(ax, 50, 83, 50, 69.8, shrink=0)
    for a, b in zip(ys, ys[1:]):
        arrow(ax, 50, a - 5, 50, b + 0.2, shrink=0)
    end_node(ax, 50, 21)
    arrow(ax, 50, ys[-1] - 5, 50, 22.6, shrink=0)
    # Coordinator branch (right)
    ys = chain(83, 26, ['Open review queue', 'Approve / reject proposal',
                        'Publish notices & events', 'Check audit log'])
    arrow(ax, 55, 79.5, 83, 69.8, shrink=0)
    for a, b in zip(ys, ys[1:]):
        arrow(ax, 83, a - 5, 83, b + 0.2, shrink=0)
    end_node(ax, 83, 34)
    arrow(ax, 83, ys[-1] - 5, 83, 35.6, shrink=0)
    save(fig, '04_activity_diagram.png')


# ===========================================================================
# 05  Class diagram
# ===========================================================================
def class_diagram():
    fig, ax = new_ax(11.5, 10)
    ax.set_ylim(-14, 100)
    for gy in range(-14, 0, 4):
        ax.add_line(Line2D([0, 100], [gy, gy], color=GRID, lw=0.5, zorder=0))
    title(ax, 'Class Diagram - Core Domain Entities')
    SP = 2.9

    def cls(x, y, w, name, attrs):
        h = 5 + len(attrs) * SP
        rect(ax, x, y - h, w, h, '')
        ax.text(x + w / 2, y - 2.5, name, ha='center', fontsize=8.5, fontweight='bold',
                color=INK, zorder=4)
        line(ax, x, y - 5, x + w, y - 5)
        for k, a in enumerate(attrs):
            ax.text(x + 1.2, y - 6.4 - k * SP, a, ha='left', va='center', fontsize=7.1,
                    color=INK, zorder=4)

    # Top row
    cls(4, 95, 26, 'Course', ['- _id: ObjectId', '- code: String', '- title: String',
                              '- departmentId: ObjectId'])
    cls(37, 95, 22, 'User', ['- _id: ObjectId', '- email: String', '- roles: [String]',
                             '- name: String', '- sectionId: ObjectId'])
    cls(71, 95, 27, 'ChatMessage', ['- _id: ObjectId', '- conversationId: String',
                                    '- senderId: ObjectId', '- role: user | assistant',
                                    '- content: String'])
    # Middle row
    cls(4, 58, 26, 'RoutineEntry', ['- _id: ObjectId', '- sectionId: ObjectId',
                                    '- courseId: ObjectId', '- day: String',
                                    '- period: Int', '- room: String',
                                    '- classType: String'])
    cls(37, 62, 26, 'Section', ['- _id: ObjectId', '- name: String',
                                '- batchId: ObjectId'])
    cls(71, 58, 27, 'Update', ['- _id: ObjectId', '- authorId: ObjectId',
                               '- sectionId: ObjectId', '- type: String',
                               '- title, description', '- eventDateTime',
                               '- sourceOverrideId: ObjectId'])
    # Bottom row
    cls(4, 26, 24, 'Exam', ['- _id: ObjectId', '- sectionId: ObjectId',
                            '- courseId: ObjectId', '- examType: String',
                            '- examDate: Date'])
    cls(37, 26, 26, 'RoutineProposal', ['- _id: ObjectId', '- sectionId: ObjectId',
                                        '- submittedBy: ObjectId', '- status: String',
                                        '- entries: [Embedded]'])
    cls(71, 26, 27, 'ScheduleOverride', ['- _id: ObjectId', '- sectionId: ObjectId',
                                         '- type: String', '- classType: ct | lecture',
                                         '- status: String', '- specificDate',
                                         '- startTime, room', '- declaredBy: ObjectId'])
    cls(4, 4, 24, 'Assignment', ['- _id: ObjectId', '- courseId: ObjectId',
                                 '- title: String', '- dueAt: Date'])

    def card(x, y, t):
        ax.text(x, y, t, fontsize=7.5, color=INK, zorder=6)

    # User N - 1 Section (vertical)
    line(ax, 48, 75.5, 48, 62)
    card(49.2, 73.5, 'N'); card(49.2, 64, '1')
    ax.text(50.5, 69, 'belongs to', fontsize=7, style='italic', ha='left', color=INK)
    # User 1 - N ChatMessage (horizontal)
    line(ax, 59, 88, 71, 88)
    card(60.5, 89.6, '1'); card(69, 89.6, 'N')
    ax.text(65, 91.6, 'sends', fontsize=7, style='italic', ha='center', color=INK)
    # Course 1 - N RoutineEntry (diagonal)
    line(ax, 28, 77.9, 16, 58)
    card(24.5, 75.5, '1'); card(17.5, 60.5, 'N')
    ax.text(13.5, 68.5, 'taught in', fontsize=7, style='italic', ha='center', color=INK)
    # Section 1 - N RoutineEntry (horizontal)
    line(ax, 37, 55, 30, 55)
    card(35.5, 56.6, '1'); card(31.5, 56.6, 'N')
    ax.text(33.5, 51.5, 'has entries', fontsize=7, style='italic', ha='center', color=INK)
    # Section 1 - N Update (horizontal)
    line(ax, 63, 55, 71, 55)
    card(64.5, 56.6, '1'); card(69.5, 56.6, 'N')
    ax.text(67, 51.5, 'posts for', fontsize=7, style='italic', ha='center', color=INK)
    # Section 1 - N Exam (diagonal)
    line(ax, 37, 48.3, 28, 26)
    card(35.5, 45.5, '1'); card(29.5, 28.5, 'N')
    ax.text(35.5, 39, 'held for', fontsize=7, style='italic', ha='left', color=INK)
    # Section 1 - N RoutineProposal (vertical)
    line(ax, 52, 48.3, 52, 26)
    card(53.2, 46, '1'); card(53.2, 28, 'N')
    ax.text(50.6, 37, 'proposed for', fontsize=7, style='italic', ha='right', color=INK)
    # Section 1 - N ScheduleOverride (diagonal)
    line(ax, 52, 48.3, 75, 26)
    card(54, 45.5, '1'); card(73.5, 28.5, 'N')
    ax.text(58, 44.5, 'declared for', fontsize=7, style='italic', ha='left', color=INK)
    # ScheduleOverride 1 - 1 Update (vertical)
    line(ax, 84, 26, 84, 32.7)
    card(85.2, 27.5, '1'); card(85.2, 31.9, '1')
    ax.text(86.5, 29.7, 'mirrored as', fontsize=7, style='italic', ha='left', color=INK)
    # Course 1 - N Assignment (left-margin route)
    line(ax, 4, 0, 1.5, 0)
    line(ax, 1.5, 0, 1.5, 90)
    line(ax, 1.5, 90, 4, 90)
    card(2.4, 1.6, 'N'); card(2.4, 88.6, '1')
    ax.text(0.9, 45, 'assigned in', fontsize=6.8, style='italic', color=INK,
            rotation=90, ha='center', va='center', zorder=6)
    save(fig, '05_class_diagram.png')


# ===========================================================================
# 06/07  Sequence diagrams
# ===========================================================================
def _seq_frame(title_text, lanes, h=7.6):
    global SEQ_AX
    fig, ax = new_ax(11, h)
    title(ax, title_text)
    SEQ_AX = ax
    xs = {}
    span_start, span_end = 88, 10
    for name, x in lanes:
        rect(ax, x - 9, span_start, 18, 5, name, fs=9, bold=True)
        ax.add_line(Line2D([x, x], [span_start, span_end], color=EDGE, lw=0.9,
                           ls=(0, (4, 3)), zorder=2))
        xs[name] = x
    return fig, ax, xs


def msg(x1, x2, y, text, dashed=False, lx=None, fs=7.8):
    ax = SEQ_AX
    arrow(ax, x1, y, x2, y, '', dashed=dashed)
    if lx is None:
        lx = (x1 + x2) / 2
    ax.text(lx, y + 1.4, text, ha='center', fontsize=fs, color=INK, zorder=4)


def sequence_login():
    fig, ax, xs = _seq_frame('Sequence Diagram - Login and Routine Fetch',
                             [('Student', 10), ('React SPA', 32), ('Express API', 56),
                              ('MongoDB', 80)])
    S, W, A, D = xs['Student'], xs['React SPA'], xs['Express API'], xs['MongoDB']
    msg(S, W, 82, 'enter email + password')
    msg(W, A, 76, 'POST /api/v1/auth/login')
    msg(A, D, 70, 'find user, bcrypt compare')
    msg(D, A, 64, 'user document', dashed=True)
    msg(A, W, 58, '200 { token, user } (JWT)', dashed=True)
    msg(W, S, 52, 'store token, route by role', dashed=True)
    msg(W, A, 44, 'GET /routine/daily?date=...')
    msg(A, D, 38, 'query section routine entries')
    msg(D, A, 32, 'routine rows', dashed=True)
    msg(W, A, 25, 'GET /calendar/day (overrides)')
    msg(A, W, 19, 'day status + marks (ct / extra)', dashed=True)
    msg(W, S, 13, 'render routine + calendar marks', dashed=True)
    save(fig, '06_sequence_login_routine.png')


def sequence_declaration():
    fig, ax, xs = _seq_frame('Sequence Diagram - CT Declaration and Instant Publish',
                             [('CR', 9), ('CR Center', 30), ('Express API', 54),
                              ('MongoDB', 74), ('Student', 92)])
    C, P, A, D, S = xs['CR'], xs['CR Center'], xs['Express API'], xs['MongoDB'], xs['Student']
    msg(C, P, 82, 'pick class, mark CT, date + time')
    msg(P, A, 76, 'POST /api/v1/overrides')
    msg(A, A + 9, 70, 'validate date / time / room', lx=A + 4.5)
    msg(A, D, 64, 'insert ScheduleOverride (approved)')
    msg(A, D, 58, 'create linked Update (sourceOverrideId)')
    msg(D, A, 52, 'saved', dashed=True)
    msg(A, P, 46, '201 { overrideId, updateId }', dashed=True)
    msg(P, C, 40, 'synced to section feed', dashed=True)
    msg(S, A, 32, 'GET /updates + /calendar/day')
    msg(A, S, 26, 'feed shows CT + calendar mark', dashed=True)
    msg(C, P, 18, 'withdraw (optional)')
    msg(P, A, 12, 'DELETE /overrides/:id -> remove post')
    save(fig, '07_sequence_ct_declaration.png')


# ===========================================================================
# 08  Data-centered architectural model
# ===========================================================================
def architecture():
    fig, ax = new_ax(11, 7.6)
    title(ax, 'Data-Centered Architectural Model - CUET AI Campus')
    # central data store
    ellipse(ax, 50, 50, 30, 22, '', fs=9)
    ax.text(50, 54, 'Central Data Store', ha='center', fontsize=9.5, fontweight='bold',
            color=INK, zorder=4)
    ax.text(50, 48.5, 'MongoDB - campus data', ha='center', fontsize=8, color=INK, zorder=4)
    ax.text(50, 44.5, '(users, routine, updates,\noverrides, exams, chat)', ha='center',
            fontsize=7.2, color=INK, zorder=4, linespacing=1.25)
    # client processes around
    rect(ax, 6, 74, 26, 12, 'Student / CR SPA\n(React client)', fs=8.5)
    rect(ax, 68, 74, 26, 12, 'Coordinator SPA\n(React client)', fs=8.5)
    rect(ax, 4, 46, 24, 14, 'Express REST API\n(routes, guards,\nservices)', fs=8)
    rect(ax, 72, 46, 24, 14, 'AI chat service\n(context builder,\nLLM proxy)', fs=8)
    rect(ax, 16, 14, 26, 12, 'File storage\n(uploads: PDF,\nroutine sheets)', fs=8)
    rect(ax, 58, 14, 26, 12, 'Notification /\nemail service', fs=8)
    arrow(ax, 19, 74, 36, 59, 'reads / writes')
    arrow(ax, 81, 74, 64, 59, 'reads / writes')
    arrow(ax, 28, 53, 35, 51, 'queries')
    arrow(ax, 72, 53, 65, 51, 'queries')
    arrow(ax, 29, 26, 38, 41, 'PDF files', loff=(-3, 0))
    arrow(ax, 61, 26, 56, 39, 'mail merge', loff=(4, 0))
    save(fig, '08_architecture_data_centered.png')


# ===========================================================================
# 09  Structure chart
# ===========================================================================
def structure_chart():
    fig, ax = new_ax(12.5, 8)
    title(ax, 'Structure Chart - CUET AI Campus')
    rect(ax, 38, 88, 24, 7, 'CUET AI Campus', fs=9.5, bold=True)

    def module(cx, label, children):
        rect(ax, cx - 12, 74, 24, 6.5, label, fs=8.5, bold=True)
        line(ax, 50, 88, cx, 80.5)
        # spine down through the two child rows and the shared-services box
        line(ax, cx, 74, cx, 26)
        rowa, rowb = children[:2], children[2:]
        for y_top, row, branch_y in ((58, rowa, 60), (44, rowb, 46)):
            for dx in (-8, 8):
                label_txt = row[(dx + 8) // 16]
                rect(ax, cx + dx - 6.5, y_top, 13, 6, label_txt, fs=6.8)
                line(ax, cx, branch_y, cx + dx, branch_y)
                line(ax, cx + dx, branch_y, cx + dx, y_top)

    module(18, 'Student module',
           ['Updates &\nevents feed', 'Routine &\ncalendar',
            'Materials\n& map', 'AI chat\nassistant'])
    module(50, 'CR module',
           ['CR Center\ndeclarations', 'Compose update\n(+ PDF)',
            'Exam & routine\nstudio', 'Withdraw /\nmanage'])
    module(82, 'Coordinator module',
           ['Proposal\nreview', 'Notices &\nevents',
            'Students &\nCRs', 'Audit log'])
    rect(ax, 15, 18, 70, 8, 'Shared services - Auth & roles (JWT) · MongoDB collections ·'
        ' File uploads · Notification / email service', fs=8)
    save(fig, '09_structure_chart.png')


# ===========================================================================
# 10  Component level design
# ===========================================================================
def component_design():
    fig, ax = new_ax(11.5, 8)
    title(ax, 'Component Level Design - Declaration & Feed Services')

    def comp(x, y, w, h, name, provides, requires):
        rect(ax, x, y, w, h, '')
        ax.text(x + w / 2, y + h - 3.4, name, ha='center', fontsize=9, fontweight='bold',
                color=INK, zorder=4)
        # provided interfaces (lollipops on the right)
        for k, p in enumerate(provides):
            cy = y + h - 7 - k * 6
            ax.add_patch(Circle((x + w + 3, cy), 1.6, fc='white', ec=EDGE, lw=1.1, zorder=3))
            line(ax, x + w, cy, x + w + 1.4, cy)
            ax.text(x + w + 5.6, cy, p, ha='left', va='center', fontsize=7.4, color=INK,
                    zorder=4)
        # required interfaces (sockets on the left)
        for k, r in enumerate(requires):
            cy = y + h - 7 - k * 6
            ax.add_patch(Circle((x - 3, cy), 1.6, fc='white', ec=EDGE, lw=1.1, zorder=3))
            ax.add_patch(Circle((x - 3, cy), 0.7, fc=EDGE, ec=EDGE, lw=0.8, zorder=4))
            line(ax, x - 1.4, cy, x, cy)
            ax.text(x - 5.6, cy, r, ha='right', va='center', fontsize=7.4, color=INK,
                    zorder=4)

    comp(16, 62, 36, 26, 'DeclarationService (CR Center)',
         ['createOverride()', 'cancelOverride()'], ['SectionRepo', 'OverrideRepo'])
    comp(14, 18, 36, 26, 'FeedService (Updates)',
         ['listUpdates()', 'createUpdate()'], ['UpdateRepo', 'AccessService'])
    comp(64, 32, 22, 28, 'CalendarService',
         ['dayStatus()', 'rangeMarks()'], ['OverrideRepo', 'RoutineRepo'])

    # internal operations listed inside boxes
    ax.text(18, 68, 'ops: validate date/time, resolve target\nsection, link feed post,\ncleanup on cancel',
            ha='left', va='center', fontsize=7.2, color=INK, linespacing=1.4, zorder=5)
    ax.text(16, 24, 'ops: scope by section/batch,\nmirror declarations, attach\nfiles, mark read / upvote',
            ha='left', va='center', fontsize=7.2, color=INK, linespacing=1.4, zorder=5)
    ax.text(66, 48, 'ops: merge routine\n+ overrides per date,\ncompute marks',
            ha='left', va='center', fontsize=7.2, color=INK, linespacing=1.4, zorder=5)

    # connections between components
    line(ax, 52, 68, 70, 68)
    line(ax, 70, 68, 70, 60)
    ax.text(62, 70.5, 'createLinkedUpdate()', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 50, 42, 64, 42)
    ax.text(60.5, 38.4, 'day marks\nfrom overrides', fontsize=7, style='italic', ha='center',
            color=INK, linespacing=1.3)
    line(ax, 34, 62, 34, 44)
    ax.text(35.5, 53, 'overrideId /\nupdateId', fontsize=7, style='italic', ha='left',
            color=INK, linespacing=1.3)
    # data stores at the bottom
    rect(ax, 4, 2, 18, 9, 'MongoDB\ncollections', fs=8)
    rect(ax, 30, 2, 20, 9, 'uploads/\n(PDF attachments)', fs=8)
    rect(ax, 72, 2, 20, 9, 'LLM provider\n(chat replies)', fs=8)
    arrow(ax, 34, 18, 40, 11, 'store files', loff=(-5, 0))
    arrow(ax, 24, 18, 14, 11, '')
    arrow(ax, 82, 32, 82, 11, 'chat context', loff=(1.8, 0))
    save(fig, '10_component_design.png')


# ===========================================================================
# 11  DFD context (level 0)
# ===========================================================================
def dfd_context():
    fig, ax = new_ax(11.5, 7.4)
    title(ax, 'First Level DFD (Context Diagram) - CUET AI Campus')
    ax.add_patch(Ellipse((50, 50), 34, 34, fc='white', ec=EDGE, lw=1.2, zorder=3))
    ax.text(50, 55.5, '0', ha='center', fontsize=10, fontweight='bold', color=INK, zorder=4)
    ax.text(50, 46, 'CUET AI Campus\nSystem', ha='center', fontsize=9, fontweight='bold',
            color=INK, zorder=4, linespacing=1.3)
    rect(ax, 4, 76, 20, 9, 'Student', fs=9, bold=True)
    rect(ax, 76, 76, 20, 9, 'Coordinator', fs=9, bold=True)
    rect(ax, 4, 15, 20, 9, 'CR', fs=9, bold=True)
    rect(ax, 76, 15, 20, 9, 'LLM provider /\nEmail service', fs=8)

    def elb(pts, label=None, lx=None, ly=None):
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            arrow(ax, x1, y1, x2, y2, '', shrink=0)
        if label:
            ax.text(lx, ly, label, fontsize=7.5, style='italic', ha='center', color=INK,
                    linespacing=1.3, zorder=6)

    # Student quadrant (top-left)
    elb([(14, 76), (14, 66), (42, 66)], 'credentials, views,\nchat messages', 27, 68.5)
    elb([(34, 54), (10, 54), (10, 76)], 'feeds, routine, marks,\nAI replies', 24, 51.5)    # CR quadrant (bottom-left)
    elb([(10, 24), (10, 40), (35, 40)], 'declarations, updates,\nexam entries', 24, 37.5)
    elb([(33, 46), (16, 46), (16, 24)], 'review outcomes,\nnotifications', 25, 43)
    # Coordinator quadrant (top-right)
    elb([(86, 76), (86, 66), (57, 66)], 'approvals, notices,\npublish actions', 72, 68.5)
    elb([(67, 54), (90, 54), (90, 76)], 'proposals, audit trail', 72, 51.5)
    # LLM / Email quadrant (bottom-right)
    elb([(67, 46), (90, 46), (90, 24)], 'prompts /\nreset mail', 80, 47.8)
    elb([(82, 24), (82, 38), (63, 38)], 'replies', 72, 35.5)
    save(fig, '11_dfd_context.png')


# ===========================================================================
# 12/13  Level-1 DFDs
# ===========================================================================
def _dfd_base(title_text):
    fig, ax = new_ax(12, 8.2)
    title(ax, title_text)
    return fig, ax


def dfd_student():
    fig, ax = _dfd_base('Student DFD (Level 1) - CUET AI Campus')
    rect(ax, 2, 42, 13, 12, 'Student', fs=8.5, bold=True)

    def proc(cx, cy, num, label, w=26, h=13):
        ax.add_patch(Ellipse((cx, cy), w, h, fc='white', ec=EDGE, lw=1.1, zorder=3))
        ax.text(cx, cy, f'{num}\n{label}', ha='center', va='center',
                fontsize=7.4, color=INK, fontweight='bold', linespacing=1.25, zorder=4)

    def store(x, y, label, w=20):
        rect(ax, x, y, w, 8, '')
        line(ax, x, y + 8, x + w, y + 8)
        line(ax, x, y, x + w, y)
        ax.text(x + w / 2, y + 4, label, ha='center', va='center', fontsize=7.4,
                color=INK, zorder=4)

    proc(30, 84, '1.0', 'Authenticate')
    proc(30, 58, '2.0', 'Serve updates\n& events')
    proc(30, 28, '3.0', 'Serve routine,\nexams & calendar')
    proc(30, 8, '4.0', 'AI chat reply')
    store(52, 80, 'D1  Users')
    store(52, 52, 'D2  Updates / Events', w=24)
    store(52, 24, 'D3  RoutineEntry / Exam', w=26)
    store(52, 0.5, 'D4  ChatMessage', w=22)
    rect(ax, 84, 3, 13, 11, 'LLM', fs=8.5, bold=True)

    def lab(x, y, t, ha='center'):
        ax.text(x, y, t, fontsize=7.2, style='italic', ha=ha, color=INK,
                linespacing=1.3, zorder=6)

    # Student fan-out
    arrow(ax, 10, 54, 20, 80, '', shrink=0)
    lab(8, 68, 'credentials')
    arrow(ax, 15, 51, 17.5, 57, '', shrink=0)
    lab(7, 62, 'view feed')
    arrow(ax, 15, 47, 17.8, 26.5, '', shrink=0)
    lab(9.6, 38.5, 'open routine /\ncalendar', ha='left')
    arrow(ax, 8, 42, 8, 10, '', shrink=0)
    arrow(ax, 8, 10, 17.2, 10, '', shrink=0)
    ax.text(5.6, 26, 'chat message', fontsize=7.2, style='italic', color=INK,
            rotation=90, ha='center', va='center', zorder=6)
    # 1.0 <-> D1
    arrow(ax, 43.5, 84, 52, 84, '', shrink=0)
    lab(47.5, 86.5, 'verify user')
    arrow(ax, 52, 81, 42.5, 81, '', shrink=0)
    lab(47.5, 78.5, 'profile + JWT')
    # 2.0 <-> D2
    arrow(ax, 43.5, 58, 52, 58, '', shrink=0)
    lab(47.5, 60.5, 'read posts')
    arrow(ax, 52, 54, 41, 54, '', shrink=0)
    lab(47.5, 51.5, 'updates & events')
    # 3.0 <-> D3
    arrow(ax, 43.5, 30, 52, 30, '', shrink=0)
    lab(47.5, 32.5, 'query entries')
    arrow(ax, 52, 26, 43, 26, '', shrink=0)
    lab(47.5, 23.5, 'rows + day marks')
    # 4.0 <-> D4
    arrow(ax, 43, 5.5, 52, 5.5, '', shrink=0)
    lab(47.5, 7.5, 'store turn')
    arrow(ax, 52, 2.5, 43, 2.5, '', shrink=0)
    lab(47.5, 0.8, 'history')
    # 4.0 <-> LLM
    arrow(ax, 43, 11, 84, 11, '', shrink=0)
    lab(64, 13.2, 'prompt')
    arrow(ax, 84, 8.5, 43, 8.5, '', shrink=0)
    lab(76, 9.9, 'AI reply', ha='left')
    save(fig, '12_dfd_student.png')


def dfd_coordinator():
    fig, ax = _dfd_base('Coordinator DFD (Level 1) - CUET AI Campus')
    rect(ax, 2, 42, 14, 12, 'Coordinator', fs=8.5, bold=True)

    def proc(cx, cy, num, label, w=26, h=13):
        ax.add_patch(Ellipse((cx, cy), w, h, fc='white', ec=EDGE, lw=1.1, zorder=3))
        ax.text(cx, cy, f'{num}\n{label}', ha='center', va='center',
                fontsize=7.4, color=INK, fontweight='bold', linespacing=1.25, zorder=4)

    def store(x, y, label, w=20):
        rect(ax, x, y, w, 8, '')
        line(ax, x, y + 8, x + w, y + 8)
        line(ax, x, y, x + w, y)
        ax.text(x + w / 2, y + 4, label, ha='center', va='center', fontsize=7.4,
                color=INK, zorder=4)

    proc(30, 84, '1.0', 'Authenticate')
    proc(30, 58, '2.0', 'Publish notices\n& events')
    proc(66, 74, '3.0', 'Review routine\nproposals')
    proc(66, 40, '4.0', 'Manage students,\nCRs & academics', w=28)
    proc(30, 8, '5.0', 'Record audit log')
    store(56, 82, 'D1  Users')
    store(14, 28, 'D2  Updates', w=22)
    store(78, 58, 'D5  RoutineProposal', w=19)
    store(56, 4, 'D6  AuditLog')

    def lab(x, y, t, ha='center'):
        ax.text(x, y, t, fontsize=7.2, style='italic', ha=ha, color=INK,
                linespacing=1.3, zorder=6)

    # Coordinator fan-out
    arrow(ax, 4, 54, 4, 84, '', shrink=0)
    arrow(ax, 4, 84, 17, 84, '', shrink=0)
    lab(10, 86.5, 'credentials')
    arrow(ax, 10, 54, 10, 74, '', shrink=0)
    arrow(ax, 10, 74, 53, 74, '', shrink=0)
    lab(47, 76.5, 'approve /\nreject proposal')
    arrow(ax, 15, 50, 17.5, 57, '', shrink=0)
    lab(30, 67, 'compose notice /\nevent (+ PDF)')
    arrow(ax, 30, 51.5, 30, 36, '', shrink=0)
    lab(28.5, 43, 'write posts', ha='right')
    arrow(ax, 36, 36, 36, 52.2, '', shrink=0)
    lab(37, 48.5, 'notices & events', ha='left')
    arrow(ax, 16, 46, 52.5, 42, '', shrink=0)
    lab(37.5, 39.5, 'assign CRs, manage\nsections & exams', ha='left')
    arrow(ax, 8, 42, 8, 8, '', shrink=0)
    arrow(ax, 8, 8, 16.5, 8, '', shrink=0)
    ax.text(5.6, 25, 'actions', fontsize=7.2, style='italic', color=INK,
            rotation=90, ha='center', va='center', zorder=6)
    # 1.0 <-> D1
    arrow(ax, 43, 84, 56, 84, '', shrink=0)
    lab(49, 82.5, 'verify user')
    arrow(ax, 56, 87, 42.5, 87, '', shrink=0)
    lab(49, 89, 'profile + JWT')
    # 2.0 <-> D2
    # (arrows drawn above, next to the fan-out)
    # 3.0 <-> D5
    arrow(ax, 79, 75, 88, 75, '', shrink=0)
    arrow(ax, 88, 75, 88, 66, '', shrink=0)
    arrow(ax, 92, 66, 92, 72, '', shrink=0)
    arrow(ax, 92, 72, 79, 72, '', shrink=0)
    lab(84, 68.5, 'update status')
    # 4.0 <-> D1
    arrow(ax, 80, 42, 98, 42, '', shrink=0)
    arrow(ax, 98, 42, 98, 86, '', shrink=0)
    arrow(ax, 98, 86, 76, 86, '', shrink=0)
    ax.text(96.2, 64, 'assign / remove CRs', fontsize=7.2, style='italic', color=INK,
            rotation=90, ha='center', va='center', zorder=6)
    # 5.0 -> D6, 4.0 -> D6
    arrow(ax, 43, 8, 56, 8, '', shrink=0)
    lab(49.5, 10.5, 'append entry')
    arrow(ax, 70, 33.5, 70, 12, '', shrink=0)
    lab(72, 22, 'log action', ha='left')
    save(fig, '13_dfd_coordinator.png')


# ===========================================================================
# 14  Entity relationship mapping (cardinality view)
# ===========================================================================
def er_cardinality():
    fig, ax = new_ax(11.5, 7.6)
    ax.set_ylim(-2, 100)
    title(ax, 'Entity Relationship Mapping (Cardinality View)')
    entities = {
        'USER': (2, 87, 19, 8),
        'BATCH': (27, 87, 19, 8),
        'SECTION': (54, 87, 22, 8),
        'COURSE': (80, 87, 19, 8),
        'EXAM': (2, 56, 20, 8),
        'UPDATE': (28, 56, 22, 8),
        'ROUTINE_ENTRY': (58, 56, 24, 8),
        'CHAT_MESSAGE': (86, 56, 13, 8),
        'ROUTINE_PROPOSAL': (30, 30, 24, 8),
        'SCHEDULE_OVERRIDE': (60, 30, 30, 8),
        'ASSIGNMENT': (30, 8, 22, 8),
    }
    for name, (x, y, w, h) in entities.items():
        rect(ax, x, y, w, h, name.replace('_', '_'), fs=6.8 if name == 'CHAT_MESSAGE' else 7.6,
             bold=True)

    def card(x, y, t, ha='center'):
        ax.text(x, y, t, fontsize=7.2, color=INK, ha=ha, zorder=6)

    def name(x, y, t, rot=0, ha='center'):
        ax.text(x, y, t, fontsize=6.5, style='italic', color=INK, ha=ha,
                va='center', rotation=rot, zorder=6)

    def seg(x1, y1, x2, y2):
        line(ax, x1, y1, x2, y2)

    # USER N - 1 BATCH
    seg(21, 91, 27, 91)
    card(22.2, 89.8, 'N'); card(25.8, 89.8, '1')
    name(24, 92.9, 'enrolls')
    # BATCH 1 - N SECTION
    seg(46, 91, 54, 91)
    card(47.2, 89.8, '1'); card(52.8, 89.8, 'N')
    name(50, 92.9, 'has')
    # USER N - 1 SECTION (elbow under row 1)
    seg(11.5, 87, 11.5, 84); seg(11.5, 84, 52, 84); seg(52, 84, 52, 89); seg(52, 89, 54, 89)
    card(9.9, 86, 'N', ha='right'); card(50.8, 88, '1', ha='right')
    name(30, 86.2, 'member of')
    # SECTION 1 - N EXAM
    seg(55, 87, 55, 82); seg(55, 82, 14, 82); seg(14, 82, 14, 64)
    card(53.8, 84.5, '1', ha='right'); card(13.3, 66, 'N', ha='left')
    name(12.7, 73, 'has exams', rot=90)
    # SECTION 1 - N UPDATE
    seg(56, 87, 56, 80); seg(56, 80, 48, 80); seg(48, 80, 48, 64)
    card(57.3, 84.5, '1', ha='left'); card(49.3, 66, 'N', ha='left')
    name(54.5, 73, 'writes updates', rot=90)
    # SECTION 1 - N ROUTINE_ENTRY
    seg(62, 87, 62, 64)
    card(60.7, 85.5, '1', ha='right'); card(63.3, 66, 'N', ha='left')
    name(63.3, 75, 'has entries', rot=90)
    # COURSE 1 - N ROUTINE_ENTRY
    seg(82, 87, 78, 64)
    card(83.3, 84, '1', ha='left'); card(79.3, 66, 'N', ha='left')
    name(76.7, 75, 'taught in', rot=90)
    # USER 1 - N CHAT_MESSAGE (left margin lane)
    seg(2, 89, 0.8, 89); seg(0.8, 89, 0.8, 26); seg(0.8, 26, 92, 26); seg(92, 26, 92, 56)
    card(1.9, 84, '1', ha='left'); card(93.3, 52, 'N', ha='left')
    name(2.9, 48, 'sends', rot=90)
    # SECTION 1 - N ROUTINE_PROPOSAL
    seg(70, 87, 70, 70); seg(70, 70, 51, 70); seg(51, 70, 51, 42)
    seg(51, 42, 42, 42); seg(42, 42, 42, 38)
    card(68.7, 85.5, '1', ha='right'); card(43.3, 40, 'N', ha='left')
    name(68.7, 78, 'proposed for', rot=90)
    # SECTION 1 - N SCHEDULE_OVERRIDE (right lane)
    seg(72, 87, 72, 84); seg(72, 84, 83, 84); seg(83, 84, 83, 46)
    seg(83, 46, 64, 46); seg(64, 46, 64, 38)
    card(73.3, 85.5, '1', ha='left'); card(62.7, 42, 'N', ha='right')
    name(84.7, 65, 'declared for', rot=90)
    # COURSE 1 - N ASSIGNMENT (right margin lane)
    seg(94, 87, 94, 84); seg(94, 84, 99, 84); seg(99, 84, 99, 20)
    seg(99, 20, 46, 20); seg(46, 20, 46, 16)
    card(92.7, 85.5, '1', ha='right'); card(47.3, 17.8, 'N', ha='left')
    name(66, 21.8, 'assigned in')
    save(fig, '14_er_cardinality.png')


# ===========================================================================
# 15  ER diagram (full, with attributes)
# ===========================================================================
def er_diagram():
    fig, ax = new_ax(11.5, 10.5, ylim=(-17, 100))
    title(ax, 'Entity-Relationship Diagram - CUET AI Campus')

    def ent(x, ytop, name, attrs, w=20):
        h = 4 + len(attrs) * 3
        rect(ax, x, ytop - h, w, h, '')
        ax.text(x + w / 2, ytop - 2, name, ha='center', fontsize=8, fontweight='bold',
                color=INK, zorder=4)
        line(ax, x, ytop - 4, x + w, ytop - 4)
        for k, a in enumerate(attrs):
            ax.text(x + 1.2, ytop - 5.5 - k * 3, a, ha='left', va='center', fontsize=6.6,
                    color=INK, zorder=4)
        return (x, ytop - h, x + w, ytop)

    ent(2, 96, 'USER', ['_id (PK)', 'email', 'name', 'roles', 'sectionId (FK)',
                        'batchId (FK)'], w=20)
    ent(27, 96, 'BATCH', ['_id (PK)', 'name', 'session'], w=17)
    ent(49, 96, 'SECTION', ['_id (PK)', 'name', 'batchId (FK)'], w=19)
    ent(79, 96, 'COURSE', ['_id (PK)', 'code', 'title', 'departmentId (FK)'], w=18)
    ent(2, 64, 'EXAM', ['_id (PK)', 'sectionId (FK)', 'courseId (FK)', 'examType',
                        'examDate'], w=18)
    ent(27, 64, 'UPDATE', ['_id (PK)', 'authorId (FK)', 'sectionId (FK)', 'type',
                           'title', 'eventDateTime', 'sourceOverrideId (FK)'], w=21)
    ent(55, 64, 'ROUTINE_ENTRY', ['_id (PK)', 'sectionId (FK)', 'courseId (FK)', 'day',
                                  'period', 'room', 'classType'], w=19)
    ent(81, 64, 'CHAT_MESSAGE', ['_id (PK)', 'senderId (FK)', 'conversationId', 'role',
                                 'content'], w=17)
    ent(27, 30, 'ROUTINE_PROPOSAL', ['_id (PK)', 'sectionId (FK)', 'submittedBy (FK)',
                                     'status', 'entries'], w=20)
    ent(54, 30, 'SCHEDULE_OVERRIDE', ['_id (PK)', 'sectionId (FK)', 'courseId (FK)',
                                      'type', 'classType', 'status', 'specificDate',
                                      'declaredBy (FK)'], w=24)
    ent(27, 2, 'ASSIGNMENT', ['_id (PK)', 'courseId (FK)', 'title', 'dueAt'], w=20)

    def card(x, y, t, ha='center'):
        ax.text(x, y, t, fontsize=7, color=INK, ha=ha, zorder=6)

    def name(x, y, t, rot=0, ha='center'):
        ax.text(x, y, t, fontsize=6.4, style='italic', color=INK, ha=ha, va='center',
                rotation=rot, zorder=6)

    # USER N - 1 BATCH
    line(ax, 22, 88, 27, 88)
    card(23.2, 86.6, 'N'); card(25.8, 86.6, '1')
    name(24.5, 89.6, 'enrolls')
    # BATCH 1 - N SECTION
    line(ax, 44, 90, 49, 90)
    card(45.2, 88.6, '1'); card(47.8, 88.6, 'N')
    name(46.5, 91.6, 'has')
    # USER N - 1 SECTION
    line(ax, 12, 74, 12, 72); line(ax, 12, 72, 58, 72); line(ax, 58, 72, 58, 83)
    card(10.8, 72.6, 'N', ha='right'); card(59.2, 81.4, '1', ha='left')
    name(35, 73.3, 'member of')
    # SECTION 1 - N EXAM
    line(ax, 52, 83, 52, 69); line(ax, 52, 69, 11, 69); line(ax, 11, 69, 11, 64)
    card(50.8, 81.4, '1', ha='right'); card(12.3, 66.3, 'N', ha='left')
    name(31, 70.2, 'has exams')
    # SECTION 1 - N UPDATE
    line(ax, 56, 83, 56, 67); line(ax, 56, 67, 40, 67); line(ax, 40, 67, 40, 64)
    card(54.8, 81.4, '1', ha='right'); card(38.8, 66.3, 'N', ha='right')
    name(54.6, 75, 'writes updates', rot=90)
    # SECTION 1 - N ROUTINE_ENTRY
    line(ax, 62, 83, 62, 64)
    card(60.8, 81.4, '1', ha='right'); card(63.3, 66, 'N', ha='left')
    name(63.3, 73, 'has entries', rot=90)
    # COURSE 1 - N ROUTINE_ENTRY
    line(ax, 86, 80, 71, 64)
    card(87.3, 78, '1', ha='left'); card(72.3, 66, 'N', ha='left')
    name(80.3, 71.5, 'taught in', rot=90)
    # USER 1 - N CHAT_MESSAGE (left margin lane, corridor y=34)
    line(ax, 2, 76, 0.8, 76); line(ax, 0.8, 76, 0.8, 34); line(ax, 0.8, 34, 95, 34)
    line(ax, 95, 34, 95, 45)
    card(3.4, 73.2, '1', ha='left'); card(95, 42.8, 'N', ha='left')
    name(1.9, 39, 'sends', rot=90)
    # SECTION 1 - N ROUTINE_PROPOSAL
    line(ax, 66, 83, 66, 32); line(ax, 66, 32, 37, 32); line(ax, 37, 32, 37, 30)
    card(67.2, 81.4, '1', ha='left'); card(38.3, 31.3, 'N', ha='left')
    name(45, 33.6, 'proposed for')
    # SECTION 1 - N SCHEDULE_OVERRIDE (right lane between ENTRY and CHAT)
    line(ax, 68, 88, 77.5, 88); line(ax, 77.5, 88, 77.5, 30)
    card(78.7, 86.5, '1', ha='left'); card(78.7, 31.3, 'N', ha='left')
    name(78.7, 58, 'declared for', rot=90)
    # SCHEDULE_OVERRIDE 1 - 1 UPDATE (sourceOverrideId)
    line(ax, 60, 30, 44, 39)
    card(61.3, 31.2, '1', ha='left'); card(42.8, 37.4, '1', ha='right')
    name(52, 37.8, 'mirrored as')
    # COURSE 1 - N ASSIGNMENT (right margin lane)
    line(ax, 97, 84, 99, 84); line(ax, 99, 84, 99, -10); line(ax, 99, -10, 47, -10)
    line(ax, 47, -10, 47, 2)
    card(98, 85.6, '1'); card(48.5, -8.2, 'N', ha='left')
    name(72, -8.2, 'assigned in')
    save(fig, '15_er_diagram.png')


# ===========================================================================
# 16  System overview (layered block diagram)
# ===========================================================================
def system_overview():
    fig, ax = new_ax(11.5, 8.2)
    title(ax, 'System Overview - CUET AI Campus')

    rect(ax, 10, 86, 16, 8, 'Student', fs=8.5, bold=True)
    rect(ax, 42, 86, 16, 8, 'CR', fs=8.5, bold=True)
    rect(ax, 74, 86, 16, 8, 'Coordinator', fs=8.5, bold=True)
    arrow(ax, 18, 86, 18, 80, '', shrink=0)
    arrow(ax, 50, 86, 50, 80, '', shrink=0)
    arrow(ax, 82, 86, 82, 80, '', shrink=0)

    rect(ax, 4, 64, 92, 16, '')
    ax.text(50, 77.4, 'Presentation Layer - React SPA (Vite build, Tailwind UI)',
            ha='center', fontsize=8, fontweight='bold', color=INK, zorder=4)
    p_chips = [('Dashboards\n(role-aware)', 'Updates &\nevents feed', 'Routine &\ncalendar'),
               ('AI chat\nassistant', 'Materials &\ncampus map', 'Routine PDF\nviewer')]
    for row in range(2):
        for col in range(3):
            x = 8 + (row * 3 + col) * 14.2
            rect(ax, x, 65.5, 13, 7, '', fs=6.2)
            ax.text(x + 6.5, 69, p_chips[row][col], ha='center', va='center', fontsize=6.2,
                    color=INK, linespacing=1.25, zorder=4)

    arrow(ax, 40, 64, 40, 58, '', shrink=0)
    arrow(ax, 56, 58, 56, 64, '', shrink=0)
    ax.text(48, 61, 'HTTPS REST / JSON\n(JWT bearer)', ha='center', va='center',
            fontsize=6.6, style='italic', color=INK, linespacing=1.25, zorder=6)

    rect(ax, 4, 42, 92, 16, '')
    ax.text(50, 55.4, 'Application Layer - Express REST API (Node.js, JWT auth)',
            ha='center', fontsize=8, fontweight='bold', color=INK, zorder=4)
    a_chips = ['Auth & roles', 'Academics &\nroutine', 'Updates &\noverrides',
               'Proposals &\nreview', 'AI chat &\naudit', 'Notifications\n(Resend)']
    for col in range(6):
        x = 8 + col * 14.2
        rect(ax, x, 43.5, 13, 7, '')
        ax.text(x + 6.5, 47, a_chips[col], ha='center', va='center', fontsize=6.2,
                color=INK, linespacing=1.25, zorder=4)

    arrow(ax, 26, 42, 26, 34, '', shrink=0)
    ax.text(27.5, 38, 'Mongoose ODM', ha='left', va='center', fontsize=6.8,
            style='italic', color=INK, zorder=6)
    arrow(ax, 76, 42, 76, 34, '', shrink=0)
    ax.text(77.5, 38, 'HTTPS', ha='left', va='center', fontsize=6.8,
            style='italic', color=INK, zorder=6)

    rect(ax, 4, 18, 44, 16, '')
    ax.text(26, 31.4, 'Data Layer - MongoDB', ha='center', fontsize=8,
            fontweight='bold', color=INK, zorder=4)
    rect(ax, 8, 19.5, 18, 8, '')
    ax.text(17, 23.5, 'cuet_ai_campus\n(25 collections)', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.25, zorder=4)
    rect(ax, 28, 19.5, 18, 8, '')
    ax.text(37, 23.5, 'uploads/\nfile store (multer)', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.25, zorder=4)

    rect(ax, 56, 18, 40, 16, '')
    ax.text(76, 31.4, 'External Services', ha='center', fontsize=8,
            fontweight='bold', color=INK, zorder=4)
    rect(ax, 60, 19.5, 15, 8, '')
    ax.text(67.5, 23.5, 'LLM API\n(OpenAI-compatible)', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.25, zorder=4)
    rect(ax, 77, 19.5, 15, 8, '')
    ax.text(84.5, 23.5, 'Resend\nemail API', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.25, zorder=4)
    save(fig, '16_system_overview.png')


# ===========================================================================
# 17  Project timeline (Gantt chart)
# ===========================================================================
def gantt_timeline():
    fig, ax = new_ax(11.5, 7.2)
    title(ax, 'Project Timeline (Gantt Chart) - 16 Weeks')
    X0, CW = 30, 4.2

    for k in range(17):
        gx = X0 + k * CW
        line(ax, gx, 10, gx, 87, )
    ax.text(24, 89, 'Week', ha='right', fontsize=7.5, fontweight='bold', color=INK, zorder=4)
    for w in range(1, 17):
        ax.text(X0 + (w - 1) * CW + CW / 2, 89, str(w), ha='center', fontsize=7, color=INK,
                zorder=4)

    tasks = [('Requirement analysis & SRS', 1, 3), ('UI/UX & wireframe design', 2, 4),
             ('Database schema design', 3, 5), ('Backend REST API development', 4, 9),
             ('Frontend (React) development', 6, 11), ('AI assistant integration', 8, 11),
             ('Routine PDF & file uploads', 9, 11), ('Testing & bug fixing', 10, 13),
             ('Deployment & documentation', 13, 16)]
    for k, (label, s, e) in enumerate(tasks):
        y = 80 - k * 8.4
        ax.text(28.5, y + 2.5, label, ha='right', va='center', fontsize=7.2, color=INK,
                zorder=4)
        rect(ax, X0 + (s - 1) * CW, y, (e - s + 1) * CW, 5, '')
        ax.text(X0 + (s - 1) * CW + (e - s + 1) * CW / 2, y + 2.5, f'w{s}-{e}',
                ha='center', va='center', fontsize=6.4, color=INK, zorder=5)
    save(fig, '17_gantt_timeline.png')


# ===========================================================================
# 18  AI-integration architecture
# ===========================================================================
def ai_integration():
    fig, ax = new_ax(11.5, 7.4)
    title(ax, 'AI Integration Architecture - Campus Assistant')

    rect(ax, 5, 56, 20, 14, '')
    ax.text(15, 63, 'Chat UI (React)\nmessage + history', ha='center', va='center',
            fontsize=7.2, fontweight='bold', color=INK, linespacing=1.3, zorder=4)
    rect(ax, 33, 50, 26, 20, '')
    ax.text(46, 60, 'AI Routes (Express)\nPOST /api/ai/chat\nGET /api/ai/context\nJWT protect',
            ha='center', va='center', fontsize=7, fontweight='bold', color=INK,
            linespacing=1.35, zorder=4)
    rect(ax, 33, 26, 26, 14, '')
    ax.text(46, 33, 'Context builder\nbatch routine + exams\n+ updates, conflicts',
            ha='center', va='center', fontsize=6.8, color=INK, linespacing=1.3, zorder=4)
    rect(ax, 5, 26, 20, 14, '')
    ax.text(15, 33, 'MongoDB\nRoutineEntry,\nExam, Updates', ha='center', va='center',
            fontsize=7, color=INK, linespacing=1.3, zorder=4)
    rect(ax, 72, 56, 24, 16, '')
    ax.text(84, 64, 'LLM provider\nOpenAI-compatible\n/chat/completions\ngpt-4o-mini (t=0.3)',
            ha='center', va='center', fontsize=6.8, color=INK, linespacing=1.3, zorder=4)
    rect(ax, 72, 26, 24, 12, '')
    ax.text(84, 32, 'deterministicReply\n(rule-based fallback)', ha='center', va='center',
            fontsize=7, color=INK, linespacing=1.3, zorder=4)
    rect(ax, 72, 82, 24, 10, '')
    ax.text(84, 87, 'env: GEMINI_API_KEY\nOPENAI_BASE_URL / MODEL', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.3, zorder=4)

    arrow(ax, 25, 66, 33, 66, '', shrink=0)
    ax.text(29, 72, 'message + history\n(+ optional key header)', ha='center', fontsize=6.4,
            style='italic', color=INK, linespacing=1.25, zorder=6)
    arrow(ax, 33, 54, 25, 54, '', shrink=0)
    arrow(ax, 25, 54, 25, 56, '', shrink=0)
    ax.text(29, 51.8, 'markdown reply', ha='center', fontsize=6.4, style='italic',
            color=INK, zorder=6)
    arrow(ax, 46, 50, 46, 40, '', shrink=0)
    ax.text(47.5, 45, 'assembles', ha='left', va='center', fontsize=6.6, style='italic',
            color=INK, zorder=6)
    arrow(ax, 33, 33, 25, 33, '', shrink=0)
    arrow(ax, 25, 29, 33, 29, '', shrink=0)
    ax.text(29, 34.5, 'reads', ha='center', fontsize=6.6, style='italic', color=INK, zorder=6)
    ax.text(29, 27.2, 'rows', ha='center', fontsize=6.6, style='italic', color=INK, zorder=6)
    arrow(ax, 59, 64, 72, 64, '', shrink=0)
    ax.text(65.5, 66.5, 'prompt + context text', ha='center', fontsize=6.4, style='italic',
            color=INK, zorder=6)
    arrow(ax, 72, 58, 59, 58, '', shrink=0)
    ax.text(65.5, 55.5, 'markdown reply', ha='center', fontsize=6.4, style='italic',
            color=INK, zorder=6)
    arrow(ax, 59, 52, 66, 52, '', shrink=0)
    arrow(ax, 66, 52, 66, 32, '', shrink=0)
    arrow(ax, 66, 32, 72, 32, '', shrink=0)
    ax.text(67.5, 42, 'no key /\nno reply', ha='left', va='center', fontsize=6.4,
            style='italic', color=INK, linespacing=1.25, zorder=6)
    arrow(ax, 84, 82, 84, 72, '', shrink=0)
    ax.text(85.5, 77, 'API key /\nbase URL', ha='left', va='center', fontsize=6.4,
            style='italic', color=INK, linespacing=1.25, zorder=6)
    save(fig, '18_ai_integration.png')


# ===========================================================================
# 19  Wireframe - home screen
# ===========================================================================
def home_wireframe():
    fig, ax = new_ax(11.5, 8.6)
    title(ax, 'Wireframe - Home Screen (Student View)')

    rect(ax, 3, 3, 94, 90, '')
    rect(ax, 3, 85, 94, 8, '')
    for cx in (8.5, 12, 15.5):
        ax.add_patch(Circle((cx, 89), 0.9, fc='white', ec=EDGE, lw=1.0, zorder=3))
    ax.text(52, 89, 'Browser - CUET AI Campus (client app)', ha='center', va='center',
            fontsize=7.5, color=INK, zorder=4)
    rect(ax, 5, 77, 90, 7, '')
    ax.text(50, 80.5, 'CUET AI Campus      |      Batch 22 - Section A      |      '
            'Notifications      |      Profile', ha='center', va='center', fontsize=7.5,
            fontweight='bold', color=INK, zorder=4)

    rect(ax, 5, 8, 16, 67, '')
    nav = ['Home', 'Routine', 'Calendar', 'Materials', 'Campus map', 'AI assistant',
           'Profile']
    ax.add_patch(Rectangle((6.5, 65, ), 13, 5, fc='#DDDDDD', ec=EDGE, lw=0.8, zorder=3))
    for k, item in enumerate(nav):
        y = 67.5 - k * 6
        ax.text(7.2, y, item, ha='left', va='center', fontsize=6.8,
                fontweight='bold' if k == 0 else 'normal', color=INK, zorder=4)

    rect(ax, 23, 8, 42, 67, '')
    ax.text(44, 71, 'Updates & Events', ha='center', fontsize=8, fontweight='bold',
            color=INK, zorder=4)
    cards = [('CT-2 notice: Software Engineering', 'CR - Today 10:24 - pinned', 'Notice'),
             ('Mid-term routine published', 'Coordinator - Yesterday', 'Update'),
             ('ICT fest - registration open', 'Event - Fri 4:00 PM', 'Event')]
    for k, (t, m, tag) in enumerate(cards):
        y = 52 - k * 18
        rect(ax, 25, y, 38, 14, '')
        ax.text(27, y + 10.5, t, ha='left', va='center', fontsize=7, fontweight='bold',
                color=INK, zorder=4)
        ax.text(27, y + 4, m, ha='left', va='center', fontsize=6.4, style='italic',
                color=INK, zorder=4)
        rect(ax, 52, y + 8.5, 9.5, 4, tag, fs=6)

    rect(ax, 67, 8, 28, 67, '')
    ax.text(81, 71, "Today's classes", ha='center', fontsize=8, fontweight='bold',
            color=INK, zorder=4)
    rows = ['1   CSE-301 - R-402', '2   CSE-305 - Lab-3', '3   Free period',
            '4   MATH-201 - R-105']
    for k, r in enumerate(rows):
        ax.text(69, 65 - k * 5.5, r, ha='left', va='center', fontsize=6.8, color=INK,
                zorder=4)
    line(ax, 69, 44.5, 93, 44.5)
    ax.text(81, 41, 'Upcoming exams', ha='center', fontsize=7.5, fontweight='bold',
            color=INK, zorder=4)
    ax.text(69, 35.5, 'SE - Mon 10:00', ha='left', va='center', fontsize=6.8, color=INK,
            zorder=4)
    ax.text(69, 30, 'ICT - Thu 10:00', ha='left', va='center', fontsize=6.8, color=INK,
            zorder=4)
    rect(ax, 69, 12, 24, 12, '')
    ax.text(81, 18, 'Next up\nCT-2 tomorrow 9:00 AM\nSoftware Engineering', ha='center',
            va='center', fontsize=6.4, color=INK, linespacing=1.35, zorder=4)
    save(fig, '19_home_wireframe.png')


# ===========================================================================
# 20  Deployment diagram
# ===========================================================================
def deployment():
    fig, ax = new_ax(11.5, 7.6)
    title(ax, 'Deployment Diagram - CUET AI Campus')

    def node(x, y, w, h, name):
        ax.add_patch(Polygon([(x, y + h), (x + 2.5, y + h + 2.5), (x + w + 2.5, y + h + 2.5),
                              (x + w, y + h)], closed=True, fc='white', ec=EDGE, lw=1.1,
                             zorder=3))
        ax.add_patch(Polygon([(x + w, y), (x + w + 2.5, y + 2.5), (x + w + 2.5, y + h + 2.5),
                              (x + w, y + h)], closed=True, fc='white', ec=EDGE, lw=1.1,
                             zorder=3))
        rect(ax, x, y, w, h, '')
        ax.text(x + w / 2, y + h - 3.4, name, ha='center', fontsize=8, fontweight='bold',
                color=INK, zorder=4)

    node(4, 70, 30, 18, 'Client Device')
    rect(ax, 7, 72, 24, 11, '')
    ax.text(19, 77.5, 'React SPA (Vite build)\nrendered in browser', ha='center',
            va='center', fontsize=6.8, color=INK, linespacing=1.3, zorder=4)

    node(24, 36, 34, 28, 'Application Server')
    rect(ax, 27, 38, 28, 22, '')
    ax.text(41, 57, 'Express REST API - :3000', ha='center', fontsize=7, fontweight='bold',
            color=INK, zorder=4)
    for k, l in enumerate(['JWT auth - helmet - rate limit', 'multer - uploads/ file store',
                           'pdf-parse (routine PDF text)', 'Mongoose ODM']):
        ax.text(28.5, 53.5 - k * 4, l, ha='left', va='center', fontsize=6.4, color=INK,
                zorder=4)

    node(4, 10, 30, 18, 'Database Server')
    rect(ax, 7, 12, 24, 11, '')
    ax.text(19, 17.5, 'MongoDB\ncuet_ai_campus :27017', ha='center', va='center',
            fontsize=6.8, color=INK, linespacing=1.3, zorder=4)

    node(74, 40, 22, 20, 'Cloud APIs')
    rect(ax, 76, 42, 18, 14, '')
    ax.text(85, 52, 'LLM provider\n(OpenAI-compatible)', ha='center', va='center',
            fontsize=6.4, color=INK, linespacing=1.3, zorder=4)
    ax.text(85, 45, 'Resend email API', ha='center', va='center', fontsize=6.4,
            color=INK, zorder=4)

    line(ax, 19, 70, 19, 67); line(ax, 19, 67, 41, 67); line(ax, 41, 67, 41, 64)
    ax.text(30, 68.4, 'HTTPS REST / JSON (JWT)', ha='center', fontsize=6.6, style='italic',
            color=INK, zorder=6)
    line(ax, 28, 36, 28, 32); line(ax, 28, 32, 19, 32); line(ax, 19, 32, 19, 28)
    ax.text(14, 33.5, 'Mongoose - TCP :27017', ha='center', fontsize=6.6, style='italic',
            color=INK, zorder=6)
    line(ax, 58, 50, 74, 50)
    ax.text(66, 52, 'HTTPS (LLM / email)', ha='center', fontsize=6.6, style='italic',
            color=INK, zorder=6)
    save(fig, '20_deployment.png')


# ---------------------------------------------------------------------------
usecase_student()
usecase_cr()
usecase_coordinator()
activity()
class_diagram()
sequence_login()
sequence_declaration()
architecture()
structure_chart()
component_design()
dfd_context()
dfd_student()
dfd_coordinator()
er_cardinality()
er_diagram()
system_overview()
gantt_timeline()
ai_integration()
home_wireframe()
deployment()
print('all done')
