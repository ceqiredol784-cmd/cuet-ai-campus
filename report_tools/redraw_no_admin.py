# Redraws system_overview and usecase_diagram WITHOUT any admin actor
# (the system has exactly three user types: student, CR, coordinator).
import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, Ellipse
from matplotlib.lines import Line2D

OUT = r'D:\ALL CODE\CUET-react\report'
NAVY = '#1F3A5F'
BLUE = '#EAF2FB'
ORANGE_L = '#FEF3D8'
GREY = '#F2F2F2'
plt.rcParams['font.family'] = 'DejaVu Sans'

def new_ax(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 100)
    ax.axis('off')
    return fig, ax

def box(ax, x, y, w, h, text='', fc=BLUE, ec=NAVY, fs=9, bold=False, style='round,pad=0.6'):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=style, fc=fc, ec=ec, lw=1.4))
    if text:
        ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs,
                fontweight='bold' if bold else 'normal', color='#1a1a1a', linespacing=1.4)

def plain_box(ax, x, y, w, h, text='', fc=BLUE, ec=NAVY, fs=9, bold=False):
    ax.add_patch(Rectangle((x, y), w, h, fc=fc, ec=ec, lw=1.2))
    if text:
        ax.text(x + w / 2, y + h / 2, text, ha='center', va='center', fontsize=fs,
                fontweight='bold' if bold else 'normal', linespacing=1.35)

def ellipse(ax, x, y, w, h, text, fc=ORANGE_L, ec='#B45309', fs=8.5):
    ax.add_patch(Ellipse((x, y), w, h, fc=fc, ec=ec, lw=1.3))
    ax.text(x, y, text, ha='center', va='center', fontsize=fs, linespacing=1.25)

def arrow(ax, x1, y1, x2, y2, text='', dashed=False, color='#374151', fs=8, loff=(0, 1.6)):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle='-|>', lw=1.4, color=color,
                                linestyle='--' if dashed else '-', shrinkA=2, shrinkB=2))
    if text:
        ax.text((x1 + x2) / 2 + loff[0], (y1 + y2) / 2 + loff[1], text, ha='center',
                fontsize=fs, color=color, style='italic')

def line(ax, x1, y1, x2, y2, color='#374151', lw=1.2):
    ax.add_line(Line2D([x1, x2], [y1, y2], color=color, lw=lw))

def actor(ax, x, y, label, scale=1.0):
    s = scale
    ax.add_patch(Ellipse((x, y + 7 * s), 4.2 * s, 4.2 * s, fc='white', ec='#111827', lw=1.5))
    ax.add_line(Line2D([x, x], [y + 4.9 * s, y - 1.5 * s], color='#111827', lw=1.5))
    ax.add_line(Line2D([x - 3.2 * s, x + 3.2 * s], [y + 2.6 * s, y + 2.6 * s], color='#111827', lw=1.5))
    ax.add_line(Line2D([x, x - 2.4 * s], [y - 1.5 * s, y - 6.5 * s], color='#111827', lw=1.5))
    ax.add_line(Line2D([x, x + 2.4 * s], [y - 1.5 * s, y - 6.5 * s], color='#111827', lw=1.5))
    ax.text(x, y - 10.5 * s, label, ha='center', fontsize=9, fontweight='bold')

def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=160, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    print('drawn:', name)

# ---------------------------------------------------------------------------
def system_overview():
    fig, ax = new_ax(11, 7.2)
    ax.text(50, 96, 'CUET AI Campus - System Overview', ha='center', fontsize=13, fontweight='bold')
    actor(ax, 10, 58, 'Student')
    actor(ax, 10, 24, 'Coordinator')
    actor(ax, 90, 44, 'Class Rep. (CR)')
    box(ax, 24, 14, 52, 72, '', fc=BLUE, ec=NAVY, style='round,pad=1.2')
    ax.text(50, 80, 'CUET AI Campus Platform  (React SPA + REST API)', ha='center',
            fontsize=10.5, fontweight='bold')
    mods = [
        (28, 62, 'Updates\nFeed'), (44, 62, 'Events'), (60, 62, 'Class\nRoutine'),
        (28, 47, 'Exam\nRoutines'), (44, 47, 'Calendar'), (60, 47, 'Campus\nMap'),
        (28, 32, 'CR Center\nDeclarations'), (44, 32, 'Routine\nStudio'), (60, 32, 'Study\nMaterials'),
    ]
    for x, y, t in mods:
        box(ax, x, y, 12, 10, t, fc='white', ec=NAVY, fs=8)
    box(ax, 36, 18, 28, 9, 'AI Assistant (chat)', fc=ORANGE_L, ec='#B45309', fs=9, bold=True)
    box(ax, 24, 0, 22, 8, 'MongoDB\n(campus data)', fc=GREY, ec='#374151', fs=8.5)
    box(ax, 54, 0, 22, 8, 'LLM Provider\n(AI service)', fc=GREY, ec='#374151', fs=8.5)
    arrow(ax, 15, 60, 24, 60, 'view')
    arrow(ax, 15, 26, 24, 32, 'approve /\nreview')
    arrow(ax, 85, 46, 76, 50, 'declare /\nbuild routine', loff=(0, 2.2))
    arrow(ax, 38, 14, 34, 8, 'persist', loff=(-4.5, 0))
    arrow(ax, 62, 14, 66, 8, 'proxy', loff=(4.5, 0))
    save(fig, 'system_overview.png')

def use_case():
    fig, ax = new_ax(11.5, 7)
    ax.text(50, 97, 'Use Case Diagram - CUET AI Campus', ha='center', fontsize=13, fontweight='bold')
    ax.add_patch(Rectangle((22, 4), 56, 88, fc='#FBFDFF', ec=NAVY, lw=1.5))
    ax.text(50, 89, 'CUET AI Campus', ha='center', fontsize=10, fontweight='bold', color=NAVY)
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

system_overview()
use_case()
print('done')
