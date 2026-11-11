/**
 * Genera la plantilla de Excel de ALMACÉN que se le envía a quien conoce los proveedores, insumos y recetas.
 *
 * Se corre con apps/api/scripts/generar-plantilla-almacen.ts (esta es la lógica; vive en src para que compile con el resto).
 *
 * No toca la base de datos ni lee datos reales: todo ejemplo es inventado y va marcado «EJEMPLO – borrar».
 * El repo no trae librería de Excel (el importador de personal lee CSV), así que el .xlsx se arma a mano
 * (OOXML dentro de un zip con fflate, que ya es dependencia de la API). Sin macros ni dependencias nuevas.
 */
import { zipSync, strToU8 } from 'fflate';

const FECHA_EJ = Date.UTC(2026, 10, 15) / 86400000 + 25569; // 15/11/2026 como fecha de Excel
export const MARCA_EJEMPLO = 'EJEMPLO – borrar';
const FILAS_MAX = 500; // filas con validación y formato listas para llenar

type Tipo = 'texto' | 'num' | 'entero' | 'fecha';
export interface Col {
  h: string; // encabezado EXACTO (el importador lo usa)
  ancho: number;
  obl: boolean; // celeste = obligatorio, gris = opcional
  ayuda: string;
  tipo?: Tipo;
  lista?: string; // clave de LISTAS (o 'REF:HOJA!col') para el desplegable
  nuevo?: boolean; // campo propuesto: hoy el sistema no lo guarda
}
export interface Hoja {
  nombre: string;
  titulo: string;
  columnas: Col[];
  ejemplos: (string | number)[][]; // sin la columna «Marca» (se agrega sola)
}

// --- Listas de valores (hoja LISTAS) ---
export const LISTAS: Record<string, { titulo: string; valores: string[] }> = {
  UNIDADES: {
    titulo: 'Unidades',
    valores: ['kg', 'g', 'L', 'ml', 'unidad', 'docena', 'caja', 'bolsa', 'paquete', 'saco', 'lata', 'botella', 'frasco', 'bandeja', 'rollo'],
  },
  CATEGORIAS: {
    titulo: 'Categorías de insumo',
    valores: ['Lácteos y huevos', 'Carnes y embutidos', 'Frutas y verduras', 'Panadería y harinas', 'Abarrotes', 'Bebidas', 'Café y té', 'Dulces y postres', 'Empaques y descartables', 'Limpieza', 'Otros'],
  },
  LUGARES: { titulo: 'Lugares de stock', valores: ['Almacén central', 'Cocina'] },
  SINO: { titulo: 'Sí / No', valores: ['Sí', 'No'] },
  TIPO_PRODUCTO: { titulo: 'Tipo de producto', valores: ['Sobre pedido', 'Producción del día'] },
};
const COLS_LISTAS = Object.keys(LISTAS); // columna A.. en este orden, desde la fila 2

const J = (clave: string) => `LISTAS!$${String.fromCharCode(65 + COLS_LISTAS.indexOf(clave))}$2:$${String.fromCharCode(65 + COLS_LISTAS.indexOf(clave))}$${1 + LISTAS[clave].valores.length + 20}`;
// Referencias a otras hojas (col B = primera columna de datos; A es «Marca»)
const REF_PROVEEDORES = `PROVEEDORES!$B$4:$B$${FILAS_MAX}`;
const REF_INSUMOS = `INSUMOS!$C$4:$C$${FILAS_MAX}`;
const REF_PRODUCTOS = `PRODUCTOS_CARTA!$B$4:$B$${FILAS_MAX}`;

const MARCA: Col = { h: '¿Ejemplo?', ancho: 16, obl: false, ayuda: 'Déjalo vacío en tus filas. Las filas amarillas de ejemplo dicen «EJEMPLO – borrar»: bórralas enteras.' };

export const HOJAS: Hoja[] = [
  {
    nombre: 'PROVEEDORES',
    titulo: 'PROVEEDORES – quién nos vende',
    columnas: [
      { h: 'Razón social', ancho: 30, obl: true, ayuda: 'Nombre legal del proveedor, como sale en su factura.' },
      { h: 'Nombre comercial', ancho: 24, obl: false, ayuda: 'Cómo lo conocen en el negocio (ej. «Don Pepe»).' },
      { h: 'RUC', ancho: 15, obl: true, ayuda: '11 números, sin espacios. Es el que sale en la factura.' },
      { h: 'Teléfono', ancho: 16, obl: false, ayuda: 'Celular o fijo para pedirle mercadería.' },
      { h: 'Persona de contacto', ancho: 22, obl: false, ayuda: 'Con quién se habla.' },
      { h: 'Días de crédito', ancho: 13, obl: false, tipo: 'entero', ayuda: 'Días que nos da para pagar. 0 si cobra al contado.' },
      { h: 'Cuenta de pago', ancho: 26, obl: false, ayuda: 'Banco, número de cuenta o Yape/Plin donde se le paga.' },
      { h: 'Qué nos vende', ancho: 30, obl: false, nuevo: true, ayuda: 'Resumen en pocas palabras (ej. «lácteos y huevos»).' },
      { h: 'Días que demora en entregar', ancho: 15, obl: false, tipo: 'entero', nuevo: true, ayuda: 'Desde que se le pide hasta que llega.' },
    ],
    ejemplos: [['Distribuidora Ejemplo S.A.C.', 'Don Ejemplo', '00000000000', '000000000', 'Persona Ejemplo', 7, 'Cuenta ejemplo 000-0000000-0-00', 'Lácteos y huevos', 2]],
  },
  {
    nombre: 'INSUMOS',
    titulo: 'INSUMOS – ingredientes y materiales que se compran',
    columnas: [
      { h: 'Código sugerido', ancho: 12, obl: false, nuevo: true, ayuda: 'Una sigla corta y única (ej. PAN-01). Si no sabes, déjalo vacío.' },
      { h: 'Nombre del insumo', ancho: 28, obl: true, ayuda: 'Nombre EXACTO y sin repetir. Con este nombre lo buscarán las recetas y el stock.' },
      { h: 'Categoría', ancho: 22, obl: false, nuevo: true, lista: 'CATEGORIAS', ayuda: 'Elige de la lista.' },
      { h: 'Unidad de compra', ancho: 13, obl: true, lista: 'UNIDADES', ayuda: 'Como lo vende el proveedor (caja, saco, bolsa…).' },
      { h: 'Unidad de almacén', ancho: 13, obl: true, lista: 'UNIDADES', ayuda: 'Unidad con la que se CUENTA en el almacén (kg, L, unidad…). Es la unidad base.' },
      { h: 'Unidad de receta', ancho: 13, obl: true, lista: 'UNIDADES', ayuda: 'Unidad con la que se escribe en las recetas (g, ml, unidad…).' },
      { h: 'Unidades de almacén por 1 unidad de compra', ancho: 17, obl: true, tipo: 'num', ayuda: 'Cuántas unidades de almacén trae UNA de compra. Ej.: 1 caja trae 12 L → 12.' },
      { h: 'Unidades de receta por 1 unidad de almacén', ancho: 17, obl: true, tipo: 'num', ayuda: 'Cuántas unidades de receta hay en UNA de almacén. Ej.: 1 L = 1000 ml → 1000.' },
      { h: 'Proveedor habitual', ancho: 26, obl: false, lista: 'REF:' + REF_PROVEEDORES, ayuda: 'Elige de la hoja PROVEEDORES (primero llena esa hoja).' },
      { h: 'Proveedor alterno', ancho: 26, obl: false, lista: 'REF:' + REF_PROVEEDORES, ayuda: 'Segunda opción si el habitual no tiene.' },
      { h: 'Costo por unidad de compra con IGV (S/)', ancho: 16, obl: false, tipo: 'num', ayuda: 'Lo que pagas por UNA unidad de compra, con IGV. Llena este o el de sin IGV (con uno basta).' },
      { h: 'Costo por unidad de compra sin IGV (S/)', ancho: 16, obl: false, tipo: 'num', nuevo: true, ayuda: 'Lo mismo pero sin IGV. Si solo sabes el que tiene IGV, déjalo vacío.' },
      { h: '¿Se controla el stock?', ancho: 12, obl: false, lista: 'SINO', nuevo: true, ayuda: 'Sí = se lleva la cuenta de cuánto hay. No = se usa pero no se cuenta (ej. sal, agua).' },
      { h: 'Stock mínimo en almacén', ancho: 13, obl: true, tipo: 'num', ayuda: 'Por debajo de esto hay que comprar. En unidad de almacén.' },
      { h: 'Stock máximo en almacén', ancho: 13, obl: true, tipo: 'num', ayuda: 'Lo máximo que conviene tener guardado. En unidad de almacén.' },
      { h: 'Stock intermedio en almacén', ancho: 13, obl: false, tipo: 'num', ayuda: 'Aviso amarillo: «queda regular». Si no sabes, déjalo vacío.' },
      { h: 'Stock mínimo en cocina', ancho: 13, obl: false, tipo: 'num', nuevo: true, ayuda: 'Lo mínimo que debe haber en cocina para trabajar el día. En unidad de almacén.' },
      { h: 'Lugar donde se usa', ancho: 18, obl: false, lista: 'LUGARES', ayuda: 'A dónde se suele llevar desde el almacén.' },
      { h: '¿Es perecible?', ancho: 11, obl: false, lista: 'SINO', nuevo: true, ayuda: 'Sí si se malogra pronto (leche, lechuga, huevo…).' },
      { h: 'Vida útil (días)', ancho: 11, obl: false, tipo: 'entero', nuevo: true, ayuda: 'Cuántos días dura una vez abierto o recibido.' },
      { h: 'Merma habitual (%)', ancho: 11, obl: false, tipo: 'num', nuevo: true, ayuda: 'Cuánto se pierde al limpiar o preparar. Ej.: lechuga 15 (de cada 100, se botan 15).' },
      { h: 'Observaciones', ancho: 30, obl: false, ayuda: 'Lo que creas importante.' },
    ],
    ejemplos: [
      ['PAN-01', 'Pan de molde', 'Panadería y harinas', 'bolsa', 'unidad', 'unidad', 20, 1, 'Distribuidora Ejemplo S.A.C.', '', 9.5, 8.05, 'Sí', 10, 40, 20, 5, 'Cocina', 'Sí', 4, 2, ''],
      ['LEC-01', 'Lechuga', 'Frutas y verduras', 'unidad', 'unidad', 'g', 1, 400, 'Distribuidora Ejemplo S.A.C.', '', 2.5, 2.12, 'Sí', 5, 20, 10, 2, 'Cocina', 'Sí', 3, 15, 'Se pierde la hoja exterior'],
      ['HUE-01', 'Huevo', 'Lácteos y huevos', 'caja', 'unidad', 'unidad', 30, 1, 'Distribuidora Ejemplo S.A.C.', '', 18, 15.25, 'Sí', 30, 120, 60, 12, 'Cocina', 'Sí', 14, 0, ''],
    ],
  },
  {
    nombre: 'EQUIVALENCIAS',
    titulo: 'EQUIVALENCIAS – cuánto es cuánto (solo lo que no esté en INSUMOS)',
    columnas: [
      { h: 'Insumo', ancho: 28, obl: false, lista: 'REF:' + REF_INSUMOS, nuevo: true, ayuda: 'Vacío = vale para todos. Si es para un insumo en especial, elígelo.' },
      { h: 'De esta unidad', ancho: 14, obl: true, lista: 'UNIDADES', nuevo: true, ayuda: 'La unidad de la que partes (1 de esta unidad…).' },
      { h: 'Equivale a esta cantidad', ancho: 14, obl: true, tipo: 'num', nuevo: true, ayuda: '…es igual a cuánto.' },
      { h: 'En esta unidad', ancho: 14, obl: true, lista: 'UNIDADES', nuevo: true, ayuda: 'La unidad de llegada.' },
      { h: 'Nota', ancho: 40, obl: false, nuevo: true, ayuda: 'Ej.: «1 caja de huevos trae 30».' },
    ],
    ejemplos: [
      ['', 'kg', 1000, 'g', 'Todos los insumos'],
      ['', 'L', 1000, 'ml', 'Todos los insumos'],
      ['', 'docena', 12, 'unidad', 'Todos los insumos'],
      ['Huevo', 'caja', 30, 'unidad', 'Solo para el huevo'],
    ],
  },
  {
    nombre: 'STOCK_INICIAL',
    titulo: 'STOCK INICIAL – lo que hay contado HOY, en cada lugar',
    columnas: [
      { h: 'Insumo', ancho: 28, obl: true, lista: 'REF:' + REF_INSUMOS, ayuda: 'Elige de la hoja INSUMOS.' },
      { h: 'Lugar', ancho: 18, obl: true, lista: 'LUGARES', ayuda: 'Almacén central o Cocina. Un insumo puede estar en los dos: una fila por lugar.' },
      { h: 'Cantidad contada', ancho: 14, obl: true, tipo: 'num', ayuda: 'Lo que contaste con tus propios ojos, en la UNIDAD DE ALMACÉN del insumo. 0 si no hay.' },
      { h: 'Fecha del conteo', ancho: 14, obl: true, tipo: 'fecha', ayuda: 'Día en que contaste (ej. 15/11/2026).' },
      { h: 'Quién contó', ancho: 22, obl: true, ayuda: 'Nombre de la persona.' },
      { h: 'Observaciones', ancho: 34, obl: false, ayuda: 'Ej.: «bolsa abierta», «por vencer».' },
    ],
    ejemplos: [
      ['Pan de molde', 'Almacén central', 30, FECHA_EJ, 'Persona Ejemplo', ''],
      ['Pan de molde', 'Cocina', 8, FECHA_EJ, 'Persona Ejemplo', ''],
    ],
  },
  {
    nombre: 'RECETAS',
    titulo: 'RECETAS – qué lleva UN plato de la carta (TODOS los que se hacen sobre pedido; aún no hay ninguna receta cargada)',
    columnas: [
      { h: 'Producto de la carta', ancho: 28, obl: true, lista: 'REF:' + REF_PRODUCTOS, ayuda: 'Nombre EXACTO como sale en la carta (elige de la hoja PRODUCTOS_CARTA).' },
      { h: 'Tamaño', ancho: 14, obl: false, ayuda: 'Solo si la receta cambia según el tamaño (ej. Grande). Vacío si es la misma.' },
      { h: 'Insumo', ancho: 28, obl: true, lista: 'REF:' + REF_INSUMOS, ayuda: 'Ingrediente (elige de la hoja INSUMOS). Una fila por ingrediente.' },
      { h: 'Cantidad por UNA unidad vendida', ancho: 16, obl: true, tipo: 'num', ayuda: 'Lo que lleva UN plato, en la unidad de receta del insumo. Se descuenta de la COCINA cuando el pedido pasa a «Listo». Debe ser mayor a 0.' },
      { h: 'Unidad', ancho: 12, obl: true, lista: 'UNIDADES', ayuda: 'Debe ser la unidad de receta del insumo.' },
      { h: 'Merma (%)', ancho: 11, obl: false, tipo: 'num', nuevo: true, ayuda: 'Pérdida al preparar este ingrediente en este plato. Vacío = usa la del insumo.' },
      { h: 'Observaciones', ancho: 34, obl: false, ayuda: 'Ej.: «2 hojas», «tostado».' },
    ],
    ejemplos: [
      ['Club sándwich', '', 'Pan de molde', 3, 'unidad', '', 'Tres rebanadas'],
      ['Club sándwich', '', 'Lechuga', 40, 'g', '', ''],
      ['Club sándwich', '', 'Huevo', 1, 'unidad', '', ''],
    ],
  },
  {
    nombre: 'PRODUCCION_TANDA',
    titulo: 'PRODUCCIÓN POR TANDA – productos que se preparan antes y se venden del stock (donas, galletas…)',
    columnas: [
      { h: 'Producto de la carta', ancho: 26, obl: true, lista: 'REF:' + REF_PRODUCTOS, ayuda: 'Debe estar en PRODUCTOS_CARTA como «Producción del día».' },
      { h: 'Sabor', ancho: 16, obl: false, ayuda: 'Solo si el producto tiene sabores y la receta cambia por sabor.' },
      { h: 'Insumo', ancho: 26, obl: true, lista: 'REF:' + REF_INSUMOS, ayuda: 'Ingrediente de la tanda. Una fila por ingrediente.' },
      { h: 'Cantidad por tanda', ancho: 14, obl: true, tipo: 'num', ayuda: 'Cuánto se usa en UNA tanda completa, en la unidad de receta.' },
      { h: 'Unidad', ancho: 12, obl: true, lista: 'UNIDADES', ayuda: 'Unidad de receta del insumo.' },
      { h: 'Unidades que rinde la tanda', ancho: 14, obl: true, tipo: 'num', ayuda: 'Cuántas piezas salen de UNA tanda. Repite el mismo número en todas las filas del producto.' },
      { h: 'Tamaño de tanda habitual', ancho: 14, obl: false, tipo: 'num', nuevo: true, ayuda: 'Cuántas tandas se hacen en un día normal.' },
      { h: 'Vida del producto terminado (horas)', ancho: 15, obl: false, tipo: 'entero', ayuda: 'Cuántas horas dura bueno para vender.' },
      { h: 'Merma (%)', ancho: 11, obl: false, tipo: 'num', nuevo: true, ayuda: 'Pérdida de este ingrediente en la tanda.' },
      { h: 'Observaciones', ancho: 30, obl: false, ayuda: '' },
    ],
    ejemplos: [
      ['Donas', '', 'Harina', 1.2, 'kg', 12, 2, 24, '', 'Masa base'],
      ['Donas', '', 'Huevo', 6, 'unidad', 12, 2, 24, '', ''],
    ],
  },
  {
    nombre: 'PRODUCTOS_CARTA',
    titulo: 'PRODUCTOS DE LA CARTA – ¿se hace al pedido o se prepara en el día?',
    columnas: [
      { h: 'Producto de la carta', ancho: 30, obl: true, ayuda: 'Nombre EXACTO como sale en la carta. Una fila por producto.' },
      { h: 'Categoría de la carta', ancho: 22, obl: false, ayuda: 'Ej.: Sándwiches, Postres.' },
      { h: 'Tipo', ancho: 20, obl: true, lista: 'TIPO_PRODUCTO', ayuda: 'Sobre pedido = se hace cuando lo piden (receta). Producción del día = se prepara en tandas y se vende del stock.' },
      { h: '¿Controla stock terminado?', ancho: 14, obl: false, lista: 'SINO', ayuda: 'Sí = la carta avisa «Quedan N». Normal para donas y galletas.' },
      { h: 'Stock mínimo terminado', ancho: 13, obl: false, tipo: 'num', nuevo: true, ayuda: 'Cuántas piezas deben quedar como mínimo antes de preparar más.' },
      { h: 'Vida útil (horas)', ancho: 12, obl: false, tipo: 'entero', ayuda: 'Cuántas horas dura bueno el producto terminado.' },
      { h: '¿Tiene sabores?', ancho: 11, obl: false, lista: 'SINO', ayuda: 'Sí si se elige un sabor (donas de chocolate, de fresa…).' },
      { h: 'Observaciones', ancho: 34, obl: false, ayuda: '' },
    ],
    ejemplos: [
      ['Club sándwich', 'Sándwiches', 'Sobre pedido', 'No', '', '', 'No', ''],
      ['Donas', 'Postres', 'Producción del día', 'Sí', 6, 24, 'Sí', ''],
    ],
  },
];

const colLetra = (i: number): string => {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Estilos (índice = cellXfs)
const S = { normal: 0, titulo: 1, hObl: 2, hOpc: 3, ayuda: 4, ejemplo: 5, texto: 6, negrita: 7, seccion: 8, entrada: 9, entradaNum: 10, entradaFecha: 11, ejemploNum: 12, ejemploFecha: 13, ejemploTexto: 14, hNuevo: 15 };

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="5">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="14"/><color rgb="FF1F3864"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
<font><i/><sz val="9"/><color rgb="FF595959"/><name val="Calibri"/></font>
<font><b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="7">
<fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFBDD7EE"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2F5597"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE2EFDA"/></patternFill></fill>
</fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFA6A6A6"/></left><right style="thin"><color rgb="FFA6A6A6"/></right><top style="thin"><color rgb="FFA6A6A6"/></top><bottom style="thin"><color rgb="FFA6A6A6"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="16">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="4" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyProtection="1"><protection locked="0"/></xf>
<xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1" applyProtection="1"><alignment vertical="center" wrapText="1"/><protection locked="0"/></xf>
<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Estilo de entrada (celda vacía de la columna) y de ejemplo según el tipo
const estiloEntrada = (t?: Tipo) => (t === 'num' || t === 'entero' ? S.entradaNum : t === 'fecha' ? S.entradaFecha : S.entrada);
const estiloEjemplo = (t?: Tipo) => (t === 'num' || t === 'entero' ? S.ejemploNum : t === 'fecha' ? S.ejemploFecha : S.ejemploTexto);

const celda = (ref: string, v: string | number | null, s: number): string => {
  if (v === null || v === '') return `<c r="${ref}" s="${s}"/>`;
  if (typeof v === 'number') return `<c r="${ref}" s="${s}"><v>${v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
};
const alto = (textos: [string, number][]) => Math.max(15, ...textos.map(([t, w]) => Math.ceil(t.length / Math.max(6, w * 1.05)) * 12.5 + 4));

const PROT = '<sheetProtection sheet="1" objects="1" scenarios="1" formatCells="0" formatColumns="0" formatRows="0" insertRows="0" deleteRows="0" sort="0" autoFilter="0"/>';

function xmlHoja(h: Hoja): string {
  const cols = [MARCA, ...h.columnas];
  const ult = colLetra(cols.length - 1);
  const filas: string[] = [];
  // 1: título; 2: encabezados + ayuda en la 3
  filas.push(`<row r="1" ht="24" customHeight="1">${celda('A1', h.titulo, S.titulo)}</row>`);
  filas.push(`<row r="2" ht="48" customHeight="1">${cols.map((c, i) => celda(`${colLetra(i)}2`, c.h, c.obl ? S.hObl : S.hOpc)).join('')}</row>`);
  filas.push(`<row r="3" ht="${alto(cols.map((c) => [c.ayuda + (c.nuevo ? ' (NUEVO)' : ''), c.ancho] as [string, number]))}" customHeight="1">${cols.map((c, i) => celda(`${colLetra(i)}3`, c.ayuda ? (c.nuevo ? '(Nuevo) ' : '') + c.ayuda : '', S.ayuda)).join('')}</row>`);
  h.ejemplos.forEach((ej, k) => {
    const r = 4 + k;
    const vals: (string | number)[] = [MARCA_EJEMPLO, ...ej];
    filas.push(`<row r="${r}">${cols.map((c, i) => celda(`${colLetra(i)}${r}`, vals[i] ?? '', estiloEjemplo(c.tipo))).join('')}</row>`);
  });
  const colsXml = cols.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho}" style="${i === 0 ? S.entrada : estiloEntrada(c.tipo)}" customWidth="1"/>`).join('');
  const ref = (c: Col) => (c.lista!.startsWith('REF:') ? c.lista!.slice(4) : J(c.lista!));
  const dvs: string[] = [];
  cols.forEach((c, i) => {
    const L = colLetra(i);
    const rango = `${L}4:${L}${FILAS_MAX}`;
    if (c.lista) {
      const esRef = c.lista.startsWith('REF:');
      dvs.push(`<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="${esRef ? 'warning' : 'stop'}" errorTitle="Valor no válido" error="${esRef ? 'Ese nombre no está en la hoja de origen. ¿Seguro?' : 'Elige un valor de la lista desplegable.'}" promptTitle="${esc(c.h)}" prompt="${esc(c.ayuda.slice(0, 250))}" sqref="${rango}"><formula1>${ref(c)}</formula1></dataValidation>`);
    } else if (c.tipo === 'num' || c.tipo === 'entero') {
      dvs.push(`<dataValidation type="${c.tipo === 'num' ? 'decimal' : 'whole'}" operator="greaterThanOrEqual" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorTitle="Número no válido" error="Escribe un número mayor o igual a 0 (sin letras)." promptTitle="${esc(c.h)}" prompt="${esc(c.ayuda.slice(0, 250))}" sqref="${rango}"><formula1>0</formula1></dataValidation>`);
    } else if (c.tipo === 'fecha') {
      dvs.push(`<dataValidation type="date" operator="greaterThan" allowBlank="1" showErrorMessage="1" errorTitle="Fecha no válida" error="Escribe una fecha como 15/11/2026." sqref="${rango}"><formula1>36526</formula1></dataValidation>`);
    }
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${ult}${FILAS_MAX}"/>
<sheetViews><sheetView workbookViewId="0" zoomScale="100"><pane xSplit="${h.nombre === 'INSUMOS' ? 3 : 2}" ySplit="3" topLeftCell="${h.nombre === 'INSUMOS' ? 'D4' : 'C4'}" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/><cols>${colsXml}</cols><sheetData>${filas.join('')}</sheetData>${PROT}
<dataValidations count="${dvs.length}">${dvs.join('')}</dataValidations>
<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

// Congelar solo Marca + primera columna de datos: xSplit=2 si la hoja tiene pocas columnas. Se deja en 3 columnas (Marca, A, B) -> ver nota.
export const LEEME: { t: 'tit' | 'sec' | 'txt' | 'neg'; v: string }[] = [
  { t: 'tit', v: 'PLANTILLA DE ALMACÉN – CAPRICHOS' },
  { t: 'txt', v: 'Este libro sirve para que nos cuentes TODO lo que el sistema necesita saber de proveedores, ingredientes y recetas. Con esto el almacén podrá llevar la cuenta de lo que entra, lo que se usa y lo que se pierde. Tómate el tiempo que necesites: no hay respuestas malas, y si no sabes algo, déjalo vacío.' },
  { t: 'sec', v: 'CÓMO LLENARLO EN 5 PASOS' },
  { t: 'txt', v: '1. PROVEEDORES: anota a quién le compras. 2. INSUMOS: anota cada ingrediente o material (pan, lechuga, huevo, servilletas…), con su unidad, su costo y sus niveles de stock.' },
  { t: 'txt', v: '3. PRODUCTOS_CARTA: escribe los productos de la carta y marca si se hacen «Sobre pedido» o son «Producción del día» (se preparan antes y se venden del stock, como las donas).' },
  { t: 'txt', v: '4. RECETAS (productos sobre pedido) y PRODUCCION_TANDA (producción del día): qué ingredientes lleva cada uno y en qué cantidad. Una fila por ingrediente.' },
  { t: 'txt', v: '5. STOCK_INICIAL: cuenta lo que hay HOY en el almacén y en la cocina. EQUIVALENCIAS: solo si hay medidas especiales (1 caja = 30 huevos). Al terminar, guarda y devuelve el archivo.' },
  { t: 'sec', v: 'CÓMO USARÁ EL SISTEMA ESTOS DATOS' },
  { t: 'txt', v: 'Hoy ningún producto tiene receta: las recetas se cargan desde cero con este Excel, así que anota TODOS los platos de la carta que se preparan al pedido (en PRODUCTOS_CARTA y RECETAS), uno por uno.' },
  { t: 'txt', v: 'Los ingredientes se descuentan SIEMPRE del stock de la COCINA, en el momento en que Cocina marca el pedido como «Listo». Nunca se descuentan directo del almacén: el almacén le entrega a la cocina con un traslado.' },
  { t: 'txt', v: 'Si la cocina no tiene suficiente de un ingrediente, el pedido igual se vende y queda un «pendiente de emitir de Almacén». Esos pendientes los emite el administrador o la persona de Almacén, y se cuadran en la noche con un recuento.' },
  { t: 'txt', v: 'Si se anula un pedido que ya se preparó, el sistema pregunta: «merma» (se perdió) o «nunca se preparó: devolver» (los ingredientes vuelven a la cocina).' },
  { t: 'sec', v: 'COLORES' },
  { t: 'txt', v: 'Encabezado CELESTE = dato OBLIGATORIO. Encabezado GRIS = opcional (si no sabes, déjalo vacío). Fila AMARILLA = EJEMPLO inventado: sirve para guiarte y debes BORRARLA entera. Las columnas marcadas «(Nuevo)» en la fila de ayuda son datos que hoy el sistema todavía no guarda pero conviene tenerlos.' },
  { t: 'sec', v: 'QUÉ NO TOCAR' },
  { t: 'txt', v: 'No cambies los títulos de las columnas (fila celeste/gris), no cambies el nombre de las hojas, no agregues ni quites columnas, no combines celdas. Las hojas tienen una protección suave SIN contraseña: si necesitas algo especial, ve a Revisar > Desproteger hoja. La hoja LISTAS tiene los valores de los desplegables.' },
  { t: 'txt', v: 'Escribe los nombres siempre igual (misma ortografía): «Pan de molde» no es lo mismo que «Pan molde». Usa las listas desplegables siempre que aparezca la flechita.' },
  { t: 'sec', v: 'A QUIÉN DEVOLVERLO' },
  { t: 'txt', v: 'Devuelve el archivo por WhatsApp o correo a la persona que te lo envió (el dueño). No hace falta imprimirlo.' },
  { t: 'sec', v: 'GLOSARIO (palabras que usamos)' },
  { t: 'neg', v: 'Insumo' }, { t: 'txt', v: 'Cualquier ingrediente o material que se compra y se gasta: pan, lechuga, leche, vasos, servilletas.' },
  { t: 'neg', v: 'Receta' }, { t: 'txt', v: 'La lista de ingredientes y cantidades de UNA unidad vendida (un club sándwich).' },
  { t: 'neg', v: 'Tanda' }, { t: 'txt', v: 'Una preparación grande que rinde varias piezas (una tanda de masa rinde 12 donas). Se anota «preparamos 2 tandas» y se descuentan los ingredientes.' },
  { t: 'neg', v: 'Merma' }, { t: 'txt', v: 'Lo que se pierde: cáscaras, hojas que se botan, producto malogrado. Se mide en porcentaje (15 = de cada 100 se pierden 15).' },
  { t: 'neg', v: 'Rendimiento' }, { t: 'txt', v: 'Cuántas piezas salen de una tanda (la tanda rinde 12 donas).' },
  { t: 'neg', v: 'Almacén y Cocina' }, { t: 'txt', v: 'Hay dos lugares donde se guarda stock: el ALMACÉN (bodega) y la COCINA (lo que ya se sacó del almacén). Los platos gastan SIEMPRE de lo que hay en la cocina.' },
  { t: 'neg', v: 'Unidad de compra / de almacén / de receta' }, { t: 'txt', v: 'Con qué unidad se compra (caja), con cuál se cuenta en el almacén (L) y con cuál se escribe en la receta (ml). Ejemplo: 1 caja trae 12 L, y 1 L son 1000 ml.' },
  { t: 'neg', v: 'Sobre pedido / Producción del día' }, { t: 'txt', v: 'Sobre pedido: se prepara cuando el cliente lo pide (usa receta). Producción del día: se prepara antes en tandas y se vende del stock (donas, galletas).' },
];

function xmlLeeme(): string {
  const filas = LEEME.map((l, i) => {
    const r = i + 1;
    const s = l.t === 'tit' ? S.titulo : l.t === 'sec' ? S.seccion : l.t === 'neg' ? S.negrita : S.texto;
    const ht = l.t === 'txt' ? ` ht="${Math.ceil(l.v.length / 115) * 15 + 3}" customHeight="1"` : l.t === 'tit' ? ' ht="26" customHeight="1"' : '';
    return `<row r="${r}"${ht}>${celda(`A${r}`, l.v, s)}</row>`;
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView showGridLines="0" tabSelected="1" workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="120" customWidth="1"/></cols><sheetData>${filas.join('')}</sheetData>${PROT}<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

function xmlListas(): string {
  const n = Math.max(...COLS_LISTAS.map((k) => LISTAS[k].valores.length));
  const filas: string[] = [];
  filas.push(`<row r="1" ht="30" customHeight="1">${COLS_LISTAS.map((k, i) => celda(`${colLetra(i)}1`, LISTAS[k].titulo, S.hOpc)).join('')}</row>`);
  for (let r = 0; r < n + 20; r++) {
    // +20 filas libres para que agreguen valores propios (las listas desplegables las incluyen)
    filas.push(`<row r="${r + 2}">${COLS_LISTAS.map((k, i) => celda(`${colLetra(i)}${r + 2}`, LISTAS[k].valores[r] ?? '', S.entrada)).join('')}</row>`);
  }
  const cols = COLS_LISTAS.map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="26" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${filas.join('')}</sheetData>${PROT}<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}

export const ORDEN_HOJAS = ['LEEME', ...HOJAS.map((h) => h.nombre), 'LISTAS'];

export function generarPlantilla(): Uint8Array {
  const n = ORDEN_HOJAS.length;
  const hojasXml = [xmlLeeme(), ...HOJAS.map(xmlHoja), xmlListas()];
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${ORDEN_HOJAS.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`),
    '_rels/.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${ORDEN_HOJAS.map((nom, i) => `<sheet name="${nom}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${ORDEN_HOJAS.map((nom, i) => (nom === 'LEEME' || nom === 'LISTAS' ? '' : `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${nom}!$2:$2</definedName>`)).join('')}</definedNames></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${ORDEN_HOJAS.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(STYLES),
  };
  hojasXml.forEach((x, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x)));
  return zipSync(files, { level: 6, mtime: new Date('2026-01-01T00:00:00Z') });
}
