import { maquetarEtiqueta, tamanoPcValido, TAMANO_BEBIDA_DEFECTO, TAMANO_GENERAL_DEFECTO } from '@caprichos/compartido';
import type {
  TipoEtiqueta,
  PayloadEtiqueta,
  EtiquetaGeneralDatos,
  EtiquetaAreaDatos,
  EtiquetaBebidaDatos,
} from '@caprichos/compartido';
import { aWindows1252 } from './codepage1252';
import {
  medirAnchoTexto,
  calcularCentroX,
  truncar,
  ajustarLineas,
  generarComandoTexto,
  FUENTES_TSPL,
} from './tipografia';
import { generarSeparadorRombos } from './rombos';
import { resolverFormato, comandosInicio, comandoLogo, aBytesTspl } from './formato';
import type { FormatoEtiqueta } from './formato';
import { generarAreaH } from './horizontal';
import { generarAreaG, primitivasATspl } from './girado';

export interface OpcionesGeneradorTspl {
  copias?: number;
  /** Tamaño del rollo y orientación. Sin él: apaisado 101.6 x 63.5 mm. */
  formato?: Partial<FormatoEtiqueta>;
}

/** Comandos de inicio de la 4BARCODE 4B-2054TH para el formato vertical (63.5 x 101.6 mm por defecto). */
function generarInicioTspl(f: FormatoEtiqueta): string {
  return comandosInicio(f);
}

/**
 * Dibuja el marco doble físico con esquinas redondeadas proporcional a 63.5 x 101.6 mm.
 */
function generarMarcoDoble(): string {
  return (
    'BOX 16,16,492,796,4,16\r\n' +
    'BOX 26,26,482,786,2,10\r\n'
  );
}

/**
 * Dibuja la cabecera negra invertida con el logotipo 'C' y textos en blanco.
 */
function generarCabeceraNegra(titulo: string, subtitulo: string): string {
  const lineas: string[] = [];
  // Logo de la marca (bitmap 64x64); el REVERSE de abajo lo deja como disco blanco
  lineas.push(comandoLogo(34, 35));

  // Título y subtítulo
  lineas.push(generarComandoTexto(112, 38, '4', 1, 1, truncar(titulo.toUpperCase(), 14)));
  lineas.push(generarComandoTexto(112, 74, '2', 1, 1, truncar(subtitulo, 26)));

  // Inversión para convertir fondo a negro y trazos a blanco
  lineas.push('REVERSE 28,28,452,78\r\n');
  return lineas.join('');
}

/**
 * Dibuja una 'píldora' (pill badge) negra con texto blanco en reverse.
 */
function generarPill(x: number, y: number, texto: string, font: string = '2'): string {
  const metricas = FUENTES_TSPL[font] || FUENTES_TSPL['2'];
  const tw = medirAnchoTexto(texto, font, 1);
  const pw = tw + 16;
  const ph = metricas.alto + 8;
  const tsplTexto = generarComandoTexto(x + 8, y + 4, font, 1, 1, texto);
  const tsplReverse = `REVERSE ${Math.round(x)},${Math.round(y)},${Math.round(pw)},${Math.round(ph)}\r\n`;
  return tsplTexto + tsplReverse;
}

/**
 * Dibuja el pie de página dentro del marco inferior con divisor.
 */
function generarPieMarco(pieIzq: string, pieDer: string): string {
  const lineas: string[] = [];
  lineas.push('BAR 26,745,456,2\r\n');

  const anchoDer = medirAnchoTexto(pieDer, '2', 1);
  const xDer = Math.max(340, 472 - anchoDer);

  // Si el texto izquierdo es largo (más de 24 caracteres), usamos fuente '1' (8 dots/char)
  // para que quepa 'Sale en: Etiquetera de caja' sin cortarse.
  const fuenteIzq = pieIzq.length > 24 ? '1' : '2';
  const maxCharsIzq = fuenteIzq === '1' ? 36 : 24;
  const yIzq = fuenteIzq === '1' ? 760 : 755;

  const textoIzq = truncar(pieIzq, maxCharsIzq);
  lineas.push(generarComandoTexto(36, yIzq, fuenteIzq, 1, 1, textoIzq));
  lineas.push(generarComandoTexto(xDer, 755, '2', 1, 1, pieDer));

  return lineas.join('');
}

/**
 * Dibuja el nombre del cliente centrado, ajustando fuente según longitud.
 */
function generarNombreCliente(y: number, nombre: string): string {
  const n = (nombre || 'Cliente').trim().toUpperCase();
  let font = '4';
  let maxChars = 18;

  if (n.length > 22) {
    font = '2';
    maxChars = 34;
  } else if (n.length > 14) {
    font = '3';
    maxChars = 26;
  }

  const texto = truncar(n, maxChars);
  const cx = calcularCentroX(texto, font, 1);
  return generarComandoTexto(cx, y, font, 1, 1, texto);
}

/**
 * Dibuja un recuadro de nota si existe.
 */
function generarRecuadroNota(y: number, nota: string): string {
  if (!nota) return '';
  const lineasTexto = ajustarLineas(`NOTA: ${nota}`, 36, 2);
  const alto = lineasTexto.length * 20 + 12;
  const lineas: string[] = [];
  lineas.push(`BOX 36,${y},472,${y + alto},2,6\r\n`);
  lineasTexto.forEach((l, idx) => {
    lineas.push(generarComandoTexto(44, y + 6 + idx * 20, '2', 1, 1, l));
  });
  return lineas.join('');
}

/**
 * Stickers de BEBIDA y GENERAL: tamano propio en mm (el que manda la API en `tamanoMm`, o el de fabrica),
 * sin girar y sin depender de la orientacion del rollo del agente; la maqueta sale de @caprichos/compartido.
 */
function generarSticker(
  tipo: 'ETIQUETA_GENERAL' | 'ETIQUETA_BEBIDA',
  datos: EtiquetaGeneralDatos | EtiquetaBebidaDatos,
  opciones?: OpcionesGeneradorTspl,
): string {
  const defecto = tipo === 'ETIQUETA_GENERAL' ? TAMANO_GENERAL_DEFECTO : TAMANO_BEBIDA_DEFECTO;
  // El tamaño llega por PC (con décimas, como 101,6 x 63,5, y margen); si no es válido, el de fábrica
  const propio = tamanoPcValido(datos.tamanoMm);
  const tam = propio ?? defecto;
  const m = maquetarEtiqueta(tipo, datos, { anchoMm: tam.anchoMm, altoMm: tam.altoMm, margenMm: propio?.margenMm });
  const f = resolverFormato({ ...opciones?.formato, orientacion: 'horizontal', anchoMm: tam.anchoMm, altoMm: tam.altoMm });
  return comandosInicio(f) + primitivasATspl(m.primitivas, m.W, m.H, 0) + `PRINT 1,${opciones?.copias ?? 1}\r\n`;
}

export function generarEtiquetaGeneral(datos: EtiquetaGeneralDatos, opciones?: OpcionesGeneradorTspl): string {
  return generarSticker('ETIQUETA_GENERAL', datos, opciones);
}

/**
 * 2. Generador de Etiqueta por Área (Cocina, Barra, etc.)
 */
export function generarEtiquetaArea(
  datos: EtiquetaAreaDatos,
  opciones?: OpcionesGeneradorTspl
): string {
  const copias = opciones?.copias ?? 1;
  const f = resolverFormato(opciones?.formato);
  if (f.orientacion === 'horizontal') return generarAreaH(datos, copias, f);
  if (f.orientacion === 'vertical-girado') return generarAreaG(datos, copias, f);
  const partes: string[] = [];

  partes.push(generarInicioTspl(f));
  partes.push(generarMarcoDoble());
  partes.push(
    generarCabeceraNegra(
      datos.areaNombre || 'COCINA',
      `Area ${datos.areaIndex || 1} de ${datos.totalAreas || 1}`
    )
  );

  // Código del pedido a la izquierda
  partes.push(generarComandoTexto(36, 120, '4', 1, 1, datos.codigo || 'PED-000'));

  // Pill modalidad a la derecha
  const modalidadPill = (datos.modalidadPill || 'SALON').toUpperCase();
  const pillW = medirAnchoTexto(modalidadPill, '2', 1) + 16;
  const pillX = Math.max(260, 472 - pillW);
  partes.push(generarPill(pillX, 118, modalidadPill, '2'));

  // Separador rombos
  partes.push(generarSeparadorRombos(160));

  // Nombre del cliente
  partes.push(generarNombreCliente(175, datos.who));

  // Canal - Hora
  const canalHora = `${datos.canal} - ${datos.hora}`;
  partes.push(
    generarComandoTexto(calcularCentroX(canalHora, '2', 1), 210, '2', 1, 1, canalHora)
  );

  // Separador rombos
  partes.push(generarSeparadorRombos(240));

  // Líneas de productos del área
  let yLinea = 255;
  const lineas = datos.lineas || [];

  for (const l of lineas) {
    const textoNombre = `${l.cantidad} x ${l.nombre}`;
    const lineasNom = ajustarLineas(textoNombre, 26, 2);
    lineasNom.forEach((ln) => {
      partes.push(generarComandoTexto(38, yLinea, '3', 1, 1, ln));
      yLinea += 24;
    });

    if (datos.esCompacta) {
      const opcionesStr = [l.tamano, ...(l.opciones || [])].filter(Boolean).join(', ');
      if (opcionesStr) {
        const lineasOpt = ajustarLineas(opcionesStr, 36, 2);
        lineasOpt.forEach((lo) => {
          partes.push(generarComandoTexto(42, yLinea, '2', 1, 1, lo));
          yLinea += 20;
        });
      }
    } else {
      if (l.tamano) {
        partes.push(generarComandoTexto(42, yLinea, '2', 1, 1, l.tamano));
        yLinea += 20;
      }
      for (const opt of l.opciones || []) {
        partes.push(generarComandoTexto(42, yLinea, '2', 1, 1, `• ${opt}`));
        yLinea += 20;
      }
    }

    yLinea += 6;
  }

  // Recuadro de nota si existe
  if (datos.nota) {
    partes.push(generarRecuadroNota(Math.min(yLinea + 4, 680), datos.nota));
  }

  // Pie y comando PRINT
  partes.push(generarPieMarco(`Sale en: ${datos.printer}`, datos.fecha));
  partes.push(`PRINT 1,${copias}\r\n`);

  return partes.join('');
}

export function generarEtiquetaBebida(datos: EtiquetaBebidaDatos, opciones?: OpcionesGeneradorTspl): string {
  return generarSticker('ETIQUETA_BEBIDA', datos, opciones);
}

/**
 * Despachador unificado según el tipo de trabajo de impresión.
 */
export function generarTsplTrabajo(
  tipo: TipoEtiqueta,
  payload: PayloadEtiqueta,
  copia: boolean = false,
  formato?: Partial<FormatoEtiqueta>
): string {
  // Una reimpresión es UN papel nuevo: antes `copia` mandaba `PRINT 1,2` y la etiquetera sacaba dos stickers por reimpresión
  // (los vasos salían dobles). `copia` solo marca el trabajo como reimpresión en el servidor.
  void copia;
  const opciones: OpcionesGeneradorTspl = { copias: 1, formato };

  switch (tipo) {
    case 'ETIQUETA_GENERAL':
      return generarEtiquetaGeneral(payload as EtiquetaGeneralDatos, opciones);
    case 'ETIQUETA_AREA':
      return generarEtiquetaArea(payload as EtiquetaAreaDatos, opciones);
    case 'ETIQUETA_BEBIDA':
      return generarEtiquetaBebida(payload as EtiquetaBebidaDatos, opciones);
    default:
      throw new Error(`Tipo de etiqueta no soportado: ${tipo}`);
  }
}

/**
 * Genera el flujo completo de bytes binarios en Windows-1252 listos para escribir a /dev/usb/lp0.
 */
export function generarBytesTrabajo(
  tipo: TipoEtiqueta,
  payload: PayloadEtiqueta,
  copia: boolean = false,
  formato?: Partial<FormatoEtiqueta>
): Buffer {
  return generarBytesDeScript(generarTsplTrabajo(tipo, payload, copia, formato));
}

/** Texto TSPL (con el BITMAP del logo en latin1) a los bytes que recibe la impresora. */
export function generarBytesDeScript(script: string): Buffer {
  return aBytesTspl(script, aWindows1252);
}
