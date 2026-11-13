/**
 * Excel (.xlsx) de una sola hoja armado a mano (OOXML dentro de un zip con fflate, que ya es dependencia).
 * Texto como inlineStr, números como número, encabezado en negrita y fila fija. Sin macros ni librerías nuevas.
 */
import { zipSync, strToU8 } from 'fflate';

export type CeldaXlsx = string | number | null | undefined;

const esc = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** A, B, ... Z, AA... */
function columna(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function celda(v: CeldaXlsx, c: number, f: number, estilo = 0): string {
  if (v === null || v === undefined || v === '') return '';
  const ref = `${columna(c)}${f}`;
  const s = estilo ? ` s="${estilo}"` : '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
  // inlineStr es siempre texto: Excel no lo toma como fórmula
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
}

export function generarXlsx(nombreHoja: string, encabezados: string[], filas: CeldaXlsx[][], anchos: number[] = []): Uint8Array {
  const hoja = nombreHoja.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Hoja1';
  const cols = encabezados.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${anchos[i] ?? 16}" customWidth="1"/>`).join('');
  const filaXml = (cs: CeldaXlsx[], n: number, estilo = 0) => `<row r="${n}">${cs.map((v, c) => celda(v, c, n, estilo)).join('')}</row>`;
  const datos = [filaXml(encabezados, 1, 1), ...filas.map((f, i) => filaXml(f, i + 2))].join('');
  const ult = `${columna(Math.max(0, encabezados.length - 1))}${filas.length + 1}`;
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${ult}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${datos}</sheetData><autoFilter ref="A1:${ult}"/></worksheet>`;
  const estilos = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
      '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
      'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(hoja)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
      'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
      'xl/styles.xml': strToU8(estilos),
      'xl/worksheets/sheet1.xml': strToU8(sheet),
    },
    { level: 6 },
  );
}
