import {
  ACCEPT_DOCUMENTOS,
  contenidoCoincide,
  formatearTamano,
  sanearNombreDocumento,
  textoDocumentoChat,
  validarDocumento,
} from '../../../comun/documentos-whatsapp.util';

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

describe('Documentos de WhatsApp: lista blanca', () => {
  it.each([
    ['carta.pdf', 'application/pdf'],
    ['oficio.doc', 'application/msword'],
    ['oficio.DOCX', DOCX],
    ['cuentas.xls', 'application/vnd.ms-excel'],
    ['cuentas.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['plan.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['notas.txt', 'text/plain'],
    ['lista.csv', 'text/csv'],
    ['lista.csv', 'application/vnd.ms-excel'],
    ['carta.pdf', 'application/pdf; charset=binary'],
  ])('acepta %s con %s', (nombre, mime) => {
    expect(validarDocumento(nombre, mime).ok).toBe(true);
  });

  it.each([
    ['programa.exe', 'application/pdf'], // mime pdf con extensión .exe
    ['carta.pdf', 'application/x-msdownload'], // extensión pdf con mime de ejecutable
    ['carta.pdf', DOCX], // extensión y tipo incoherentes
    ['informe.pdf.exe', 'application/pdf'], // doble extensión
    ['informe.exe.pdf', 'application/pdf'], // extensión peligrosa escondida
    ['pagina.html.txt', 'text/plain'],
    ['archivo.zip', 'application/zip'],
    ['script.sh', 'text/plain'],
    ['macro.docm', DOCX],
    ['sin_extension', 'application/pdf'],
    ['dibujo.svg', 'image/svg+xml'],
    ['carta.pdf', ''],
    ['', 'application/pdf'],
  ])('rechaza %s con %s', (nombre, mime) => {
    expect(validarDocumento(nombre, mime).ok).toBe(false);
  });

  it('el accept del selector cubre exactamente las extensiones permitidas', () => {
    expect(ACCEPT_DOCUMENTOS).toBe('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv');
  });
});

describe('Documentos de WhatsApp: nombre saneado', () => {
  it('quita rutas, ../ y caracteres de control', () => {
    expect(sanearNombreDocumento('../../etc/passwd.pdf')).toBe('passwd.pdf');
    expect(sanearNombreDocumento('C:\\Users\\ana\\carta.pdf')).toBe('carta.pdf');
    expect(sanearNombreDocumento('ca\u0000rta\n.pdf')).toBe('carta.pdf');
    expect(sanearNombreDocumento('..oculto.pdf')).toBe('oculto.pdf');
  });

  it('limita el largo y conserva la extensión', () => {
    const n = sanearNombreDocumento(`${'a'.repeat(300)}.docx`);
    expect(n.length).toBeLessThanOrEqual(120);
    expect(n.endsWith('.docx')).toBe(true);
  });

  it('un nombre vacío queda como «documento» y no pasa la lista blanca', () => {
    expect(sanearNombreDocumento('///')).toBe('documento');
    expect(validarDocumento('///', 'application/pdf').ok).toBe(false);
  });

  it('el nombre devuelto por la validación ya viene saneado', () => {
    const v = validarDocumento('../carta final.pdf', 'application/pdf');
    expect(v).toMatchObject({ ok: true, nombre: 'carta final.pdf', ext: 'pdf' });
  });
});

describe('Documentos de WhatsApp: contenido real', () => {
  it('PDF debe empezar con %PDF-', () => {
    expect(contenidoCoincide(Buffer.from('%PDF-1.7 datos'), 'pdf')).toBe(true);
    expect(contenidoCoincide(Buffer.from('MZ ejecutable'), 'pdf')).toBe(false);
  });
  it('docx/xlsx/pptx deben ser zip; doc/xls/ppt deben ser OLE2', () => {
    expect(contenidoCoincide(Buffer.from([0x50, 0x4b, 3, 4, 0]), 'docx')).toBe(true);
    expect(contenidoCoincide(Buffer.from('MZ....'), 'docx')).toBe(false);
    expect(contenidoCoincide(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]), 'doc')).toBe(true);
    expect(contenidoCoincide(Buffer.from([0x50, 0x4b, 3, 4, 0, 0, 0, 0]), 'doc')).toBe(false);
  });
  it('texto y csv no admiten bytes nulos; un archivo vacío nunca pasa', () => {
    expect(contenidoCoincide(Buffer.from('a,b\n1,2'), 'csv')).toBe(true);
    expect(contenidoCoincide(Buffer.from([65, 0, 66]), 'txt')).toBe(false);
    expect(contenidoCoincide(Buffer.alloc(0), 'txt')).toBe(false);
  });
});

describe('Documentos de WhatsApp: textos', () => {
  it('formatea el tamaño y el texto del hilo', () => {
    expect(formatearTamano(500)).toBe('500 B');
    expect(formatearTamano(120 * 1024)).toBe('120 KB');
    expect(formatearTamano(2.5 * 1024 * 1024)).toBe('2,5 MB');
    expect(textoDocumentoChat('nombre.docx', 120 * 1024)).toBe('📄 nombre.docx (120 KB)');
  });
});
