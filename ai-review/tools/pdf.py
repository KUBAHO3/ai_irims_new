"""Minimal text-only PDF writer (Helvetica, A4, word wrap, several pages). No dependencies."""
import textwrap

WIDTH_CHARS = 92      # wrap width for 10.5 pt Helvetica on A4 with 50 pt margins
LINES_PER_PAGE = 52
LEADING = 14.5


def _escape(s: str) -> str:
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')


def write_pdf(path, lines):
    wrapped = []
    for line in lines:
        wrapped.extend(textwrap.wrap(line, WIDTH_CHARS) or [''])
    pages = [wrapped[i:i + LINES_PER_PAGE] for i in range(0, len(wrapped), LINES_PER_PAGE)] or [[]]

    objs = ['<< /Type /Catalog /Pages 2 0 R >>', None,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>']
    kids = []
    for page in pages:
        stream = f'BT /F1 10.5 Tf 50 790 Td {LEADING} TL ' + ' '.join(f'({_escape(l)}) Tj T*' for l in page) + ' ET'
        data = stream.encode('cp1252', 'replace')
        objs.append(f'<< /Length {len(data)} >>\nstream\n'.encode('latin1') + data + b'\nendstream')
        content_id = len(objs)
        objs.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>')
        kids.append(len(objs))
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(f'{k} 0 R' for k in kids)}] /Count {len(kids)} >>"

    out = bytearray(b'%PDF-1.4\n')
    offsets = []
    for i, o in enumerate(objs):
        offsets.append(len(out))
        body = o if isinstance(o, bytes) else o.encode('latin1')
        out += f'{i + 1} 0 obj\n'.encode() + body + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode() + b''.join(f'{o:010d} 00000 n \n'.encode() for o in offsets)
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    with open(path, 'wb') as f:
        f.write(out)
