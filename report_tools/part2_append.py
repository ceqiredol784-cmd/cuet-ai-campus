
def class_diagram():
    fig, ax = new_ax(11.5, 9)
    ax.set_ylim(-8, 100)
    for gy in range(-8, 0, 4):
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
            ax.text(x + 1.2, y - 6.4 - k * SP, a, ha='left', va='center', fontsize=7.2,
                    color=INK, zorder=4)
        return (x, y - h, x + w, y)
    user = cls(4, 95, 24, 'User',
               ['- _id: ObjectId', '- email: String', '- role: String',
                '- name: String', '- sectionId: ObjectId'])
    section = cls(38, 95, 24, 'Section',
                  ['- _id: ObjectId', '- batch: String', '- name: String'])
    course = cls(70, 95, 24, 'Course',
                 ['- _id: ObjectId', '- code: String', '- title: String',
                  '- departmentId: ObjectId'])
    routine = cls(4, 70, 24, 'Routine',
                  ['- _id: ObjectId', '- sectionId: ObjectId', '- weekType: String'])
    entry = cls(32, 70, 26, 'RoutineEntry',
                ['- _id: ObjectId', '- routineId: ObjectId', '- day: String',
                 '- period: Int', '- courseCode: String', '- teachers: [String]',
                 '- room: String', '- classType: String'])
    proposal = cls(62, 70, 26, 'RoutineProposal',
                   ['- _id: ObjectId', '- sectionId: ObjectId', '- status: String',
                    '- entries: [Embedded]', '- submittedBy: ObjectId'])
    decl = cls(4, 38, 24, 'DayDeclaration',
               ['- _id: ObjectId', '- groupId: ObjectId', '- day: Date',
                '- kind: String', '- scope: String(batch)'])
    update = cls(34, 38, 22, 'Update',
                 ['- _id: ObjectId', '- title: String', '- body: String',
                  '- audience: [String]'])
    event = cls(64, 38, 22, 'Event',
                ['- _id: ObjectId', '- title: String', '- startsAt: Date',
                 '- audience: [String]'])
    exam = cls(34, 14, 24, 'ExamEntry',
               ['- _id: ObjectId', '- sectionId: ObjectId', '- courseCode: String',
                '- examDate: Date'])
    line(ax, 28, 88, 38, 88)
    ax.text(26, 89.6, 'N', fontsize=7.5, color=INK)
    ax.text(40, 89.6, '1', fontsize=7.5, color=INK)
    ax.text(33, 91.6, 'belongs to', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 70, 88, 62, 88)
    ax.text(72, 89.6, 'N', fontsize=7.5, color=INK)
    ax.text(60, 89.6, '1', fontsize=7.5, color=INK)
    ax.text(66, 91.6, 'offered to', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 50, 81.3, 50, 70)
    ax.text(51.2, 79.4, '1', fontsize=7.5, color=INK)
    ax.text(51.2, 71.6, 'N', fontsize=7.5, color=INK)
    ax.text(53.5, 75.8, 'has entries', fontsize=7, style='italic', ha='left', color=INK)
    line(ax, 28, 60, 32, 58)
    ax.text(29.6, 61.4, '1', fontsize=7.5, color=INK)
    ax.text(30.4, 56.6, 'N', fontsize=7.5, color=INK)
    ax.text(28, 52.3, 'contains', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 58, 58, 62, 56)
    ax.text(56.5, 59.4, 'N', fontsize=7.5, color=INK)
    ax.text(60.5, 57.8, '1', fontsize=7.5, color=INK)
    ax.text(57, 54, 'mirrored in', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 4, 28, 2, 28)
    line(ax, 2, 28, 2, 72.5)
    line(ax, 2, 72.5, 42, 72.5)
    line(ax, 42, 72.5, 42, 81.3)
    ax.text(43.2, 82.6, '1', fontsize=7.5, color=INK)
    ax.text(20, 74.1, 'declared for', fontsize=7, style='italic', ha='center', color=INK)
    line(ax, 34, 6, 2, 6)
    ax.text(17, 7.6, 'examined in', fontsize=7, style='italic', ha='center', color=INK)
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
