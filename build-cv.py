#!/usr/bin/env python3
"""Build the CV from one source of truth: data/cv.json

  * assets/Gerard_Alexander_Gibson_CV.pdf   the downloadable CV (A4)
  * index.html  between <!-- CV:START --> and <!-- CV:END -->            the CV section
  * index.html  between <!-- SYSTEMS:START --> and <!-- SYSTEMS:END -->  the skill cards

Edit data/cv.json, run `python3 build-cv.py`, and the PDF and the website can never
drift apart. The deploy workflow runs this on every push, so the published
CV always matches the published site.

Requires: pip install -r requirements.txt   (reportlab)
"""
import hashlib, html, json, os, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent
cv_path = root / 'data' / 'cv.json'
pdf_path = root / 'assets' / 'Gerard_Alexander_Gibson_CV.pdf'
index_path = root / 'index.html'

cv = json.loads(cv_path.read_text(encoding='utf-8'))
# Short revision id: changes whenever the CV content changes (shown on the site and in the PDF footer)
rev = hashlib.sha256(json.dumps({k: v for k, v in cv.items() if k != '_note'}, sort_keys=True).encode()).hexdigest()[:7]
esc = html.escape


# ---------------------------------------------------------------- PDF
def build_pdf():
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_JUSTIFY, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (Flowable, HRFlowable, KeepTogether, ListFlowable, ListItem, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

    NAVY = colors.HexColor('#1F3864')
    GREY = colors.HexColor('#5F6368')
    INK = colors.HexColor('#222222')
    x = lambda s: html.escape(s, quote=False)

    st = {
        'name': ParagraphStyle('name', fontName='Helvetica-Bold', fontSize=23, leading=27, textColor=NAVY),
        'title': ParagraphStyle('title', fontName='Helvetica', fontSize=11, leading=15, textColor=INK),
        'contact': ParagraphStyle('contact', fontName='Helvetica', fontSize=8.8, leading=12.5, textColor=GREY),
        'h': ParagraphStyle('h', fontName='Helvetica-Bold', fontSize=9.4, leading=12, textColor=NAVY, spaceBefore=11, spaceAfter=2, charSpace=1.1),
        'body': ParagraphStyle('body', fontName='Helvetica', fontSize=9, leading=12.3, textColor=INK, alignment=TA_JUSTIFY),
        'skill': ParagraphStyle('skill', fontName='Helvetica', fontSize=9, leading=12.3, textColor=INK, spaceAfter=1.5),
        'role': ParagraphStyle('role', fontName='Helvetica-Bold', fontSize=9.4, leading=12.5, textColor=INK),
        'date': ParagraphStyle('date', fontName='Helvetica', fontSize=9, leading=12.5, textColor=GREY, alignment=TA_RIGHT),
        'org': ParagraphStyle('org', fontName='Helvetica-Oblique', fontSize=8.8, leading=12, textColor=GREY, spaceAfter=2),
        'bullet': ParagraphStyle('bullet', fontName='Helvetica', fontSize=8.9, leading=11.6, textColor=INK),
        'strengths': ParagraphStyle('strengths', fontName='Helvetica', fontSize=9, leading=12.3, textColor=INK),
    }

    def heading(text):
        return [Paragraph(x(text.upper()), st['h']), HRFlowable(width='100%', thickness=1, color=NAVY, spaceBefore=1, spaceAfter=5)]

    def bullets(items):
        rows: list = [ListItem(Paragraph(x(b), st['bullet']), leftIndent=11) for b in items]
        return ListFlowable(rows, bulletType='bullet', start='•', leftIndent=11, bulletFontSize=8, bulletColor=NAVY)

    def role_row(left, right, left_style='role', right_w=68):
        t = Table([[Paragraph(x(left), st[left_style]), Paragraph(x(right), st['date'])]], colWidths=['*', right_w * mm])
        t.setStyle(TableStyle([('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
                               ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0), ('VALIGN', (0, 0), (-1, -1), 'TOP')]))
        return t

    def link(url, label):
        return f'<a href="{html.escape(url, quote=True)}" color="#1F3864"><u>{x(label)}</u></a>'

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont('Helvetica', 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(20 * mm, 9 * mm, f"{cv['name']} · CV rev {rev} · generated from {cv['portfolio']['label']}")
        canvas.drawRightString(A4[0] - 20 * mm, 9 * mm, f'Page {doc.page}')
        canvas.restoreState()

    story: list[Flowable] = [
        Paragraph(x(cv['name']), st['name']),
        Paragraph(x(cv['title']), st['title']),
        Paragraph(f"{x(cv['location'])} &nbsp;|&nbsp; {link('mailto:' + cv['email'], cv['email'])}", st['contact']),
        Paragraph(f"LinkedIn: {link(cv['linkedin']['url'], cv['linkedin']['label'])} &nbsp;|&nbsp; Portfolio: {link(cv['portfolio']['url'], cv['portfolio']['label'])}", st['contact']),
    ]
    story += heading('Professional Summary') + [Paragraph(x(cv['summary']), st['body'])]

    story += heading('Technical Skills')
    for g in cv['skills']:
        story.append(Paragraph(f"<font name='Helvetica-Bold' color='#1F3864'>{x(g['label'])}:</font> {x(g.get('pdf') or ', '.join(g['items']))}", st['skill']))

    story += heading('Relevant Experience')
    for e in cv['experience']:
        story.append(KeepTogether([role_row(e['role'], e['dates']), Paragraph(x(e['org']), st['org']), bullets(e['bullets'])]))

    story += heading('Selected Software Engineering Projects')
    for p in cv['projects']:
        story.append(KeepTogether([Paragraph(f"<b>{x(p['name'])}</b>", st['role']), Paragraph(x(p['stack']), st['org']), bullets(p['bullets']), Spacer(1, 4)]))

    story += heading('Education')
    for ed in cv['education']:
        story.append(KeepTogether([Paragraph(f"<b>{x(ed['title'])}</b>", st['role']),
                                   role_row(f"{ed['org']}  |  {ed['status']}", ed['dates'], 'org'), Spacer(1, 4)]))

    story += heading('Additional Strengths') + [Paragraph(' &nbsp;•&nbsp; '.join(x(s) for s in cv['strengths']), st['strengths'])]

    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(str(pdf_path), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=16 * mm, bottomMargin=17 * mm,
                            title=f"{cv['name']} — CV", author=cv['name'], subject=cv['title'], keywords='CV, software developer', invariant=1)
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return doc.page


# ---------------------------------------------------------------- HTML
def systems_html():
    cards = []
    for i, g in enumerate(cv['skills'], 1):
        tags = ''.join(f'<span>{esc(t)}</span>' for t in g['items'])
        cards.append(f'''          <li class="card" data-reveal><div class="panel" data-tilt><p class="panel-label">MOD.{i:02d}</p><h3>{esc(g['site'])}</h3>
            <p class="tags">{tags}</p></div></li>''')
    return '<!-- SYSTEMS:START (generated by build-cv.py from data/cv.json) -->\n        <ul class="grid grid-4">\n' + '\n'.join(cards) + '\n        </ul>\n        <!-- SYSTEMS:END -->'


def cv_html(pages, kb):
    exp = []
    for e in cv['experience']:
        items = ''.join(f'<li>{esc(b)}</li>' for b in e['bullets'])
        exp.append(f'''          <li class="card" data-reveal><article class="panel cv-role" data-tilt>
            <p class="panel-label">{esc(e['dates'])}</p>
            <h3>{esc(e['role'])}</h3>
            <p class="cv-org">{esc(e['org'])}</p>
            <ul class="cv-list">{items}</ul>
          </article></li>''')
    edu = ''.join(f'<li><strong>{esc(d["title"])}</strong><span>{esc(d["org"])} · {esc(d["status"])}</span><em>{esc(d["dates"])}</em></li>' for d in cv['education'])
    strengths = ''.join(f'<span>{esc(s)}</span>' for s in cv['strengths'])
    return f'''<!-- CV:START (generated by build-cv.py from data/cv.json) -->
        <div class="two-col cv-top">
          <div data-reveal>
            <p class="cv-label">PROFESSIONAL SUMMARY</p>
            <p data-type>{esc(cv['summary'])}</p>
          </div>
          <div data-reveal>
            <div class="panel cv-dl" data-tilt>
              <p class="panel-label">CV.PDF &nbsp;//&nbsp; REV {rev}</p>
              <h3>Download my CV</h3>
              <p class="cv-meta">PDF · A4 · {pages} pages · {kb} KB<br>Built from the same data as this page, so it is always in sync.</p>
              <p class="actions"><a class="btn btn-primary" data-magnetic href="assets/Gerard_Alexander_Gibson_CV.pdf" download="Gerard_Alexander_Gibson_CV.pdf"><span>Download CV (PDF)</span></a></p>
            </div>
          </div>
        </div>
        <ul class="grid cv-grid">
{chr(10).join(exp)}
          <li class="card" data-reveal><article class="panel" data-tilt>
            <p class="panel-label">EDUCATION</p>
            <ul class="cv-edu">{edu}</ul>
            <p class="panel-label cv-sub">ADDITIONAL STRENGTHS</p>
            <p class="tags">{strengths}</p>
          </article></li>
        </ul>
        <!-- CV:END -->'''


def replace_block(src, name, block):
    pattern = re.compile(rf'<!-- {name}:START.*?<!-- {name}:END -->', re.S)
    if not pattern.search(src):
        sys.exit(f'Marker {name}:START/END not found in index.html')
    return pattern.sub(lambda _m: block, src)


if __name__ == '__main__':
    pages = build_pdf()
    kb = round(os.path.getsize(pdf_path) / 1024)
    src = index_path.read_text(encoding='utf-8')
    src = replace_block(src, 'SYSTEMS', systems_html())
    src = replace_block(src, 'CV', cv_html(pages, kb))
    index_path.write_text(src, encoding='utf-8')
    print(f'CV rev {rev}: wrote {pdf_path.relative_to(root)} ({pages} pages, {kb} KB) and refreshed the CV + Systems sections in index.html')
