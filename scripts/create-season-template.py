"""Generate the public, entirely fictional 2027 workbook. Python stdlib only."""
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
HEADERS = ["Rank", "Artista", "Álbum", "Nota", "Faixa", "Gênero", "País", "Fonte", "Nota Original",
           "Construção Sonora", "Identidade & Personalidade", "Consistência & Narrativa", "Replay & Impacto",
           "Data da avaliação", "Ano de lançamento"]
DECISIONS = ["Decisão", "Temporada", "Mês", "Regra", "Artista", "Álbum", "Nota original", "Ordem no grupo",
             "Status", "Confirmado por", "Confirmado em", "Referência da confirmação"]
CLOSURES = ["Fechamento", "Temporada", "Mês", "Regra", "Versão base", "Hash do contexto", "Status",
            "Confirmado por", "Confirmado em", "Referência da confirmação", "Corrige fechamento", "Justificativa"]
SHEETS = [("Albuns 2027", [HEADERS] + [
    [i, f"Artista fictício {i}", f"Disco de demonstração {i}", score, "Demonstração", "Rock", "Brasil",
     "MODELO FICTÍCIO — não é avaliação pessoal", score, *pillars, date, 2027]
    for i, score, pillars, date in [(1, 92, [23,23,23,23], "2027-01-15"),
                                  (2, 90, [23,23,22,22], "2027-01-20"),
                                  (3, 88, [22,22,22,22], "2027-01-25"),
                                  (4, 91, [23,23,23,22], "2027-02-12")]
]), ("Backlog", [["Ordem", "Artista", "Álbum", "Prioridade", "Fonte"]]),
    ("Resumo", [["Modelo", "Inteiramente fictício. Substitua os exemplos antes de usar uma fonte real."]]),
    ("Desempates mensais", [DECISIONS]), ("Fechamentos mensais", [CLOSURES])]

NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
def column(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result

def worksheet(rows):
    content = []
    for row_number, row in enumerate(rows, 1):
        cells = []
        for col, value in enumerate(row, 1):
            ref = f'{column(col)}{row_number}'
            if isinstance(value, (int, float)):
                cells.append(f'<c r="{ref}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{ref}" t="inlineStr"><is><t>{escape(str(value))}</t></is></c>')
        content.append(f'<row r="{row_number}">{"".join(cells)}</row>')
    return f'<worksheet xmlns="{NS}"><sheetData>{"".join(content)}</sheetData></worksheet>'

def generate():
    files = {
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            + ''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,len(SHEETS)+1)) + '</Types>',
        '_rels/.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        'xl/workbook.xml': f'<workbook xmlns="{NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'
            + ''.join(f'<sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>' for i,(name,_) in enumerate(SHEETS,1)) + '</sheets></workbook>',
        'xl/_rels/workbook.xml.rels': '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            + ''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(SHEETS)+1)) + '</Relationships>',
        **{f'xl/worksheets/sheet{i}.xml': worksheet(rows) for i,(_,rows) in enumerate(SHEETS,1)},
    }
    target = ROOT / 'docs/templates/Oraculo_Musical_2027_v1.xlsx'
    target.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
        for name, body in files.items():
            info = ZipInfo(name, date_time=(2026,10,30,0,0,0))
            info.compress_type = ZIP_DEFLATED
            archive.writestr(info, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body)
    print(target.relative_to(ROOT))

if __name__ == '__main__':
    generate()
