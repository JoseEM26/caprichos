import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada, esSaludo } from '../normalizador-entrada.util';

const ESTADOS = [
  'INICIO','MENU','CARTA_CATEGORIAS','CARTA_PRODUCTOS','CARTA_PRODUCTO_DETALLE','CARTA_PROMOS','MI_PEDIDO',
  'MI_PEDIDO_DETALLE','PREGUNTAS','HORARIO','UBICACION','ATENCION_PERSONA','PEDIDO','PAGO','RESERVA','DUDA_IA',
  'CAMBIO_DIR_CONFIRMAR','CAMBIO_DIR_REFERENCIA','CAMBIO_DIR_UBICACION','CAMBIO_NO_PERMITIDO','CAMBIO_OPCIONES',
  'CAMBIO_PED_CONFIRMAR','CAMBIO_PED_DETALLE','PAGO_CAMBIAR_MEDIO','PAGO_DATOS','PAGO_ESPERANDO_VOUCHER',
  'PAGO_RECHAZADO','PAGO_VALIDANDO','PEDIDO_ACCION_CARRITO','PEDIDO_CANTIDAD','PEDIDO_CATEGORIAS',
  'PEDIDO_COMPROBANTE_TIPO','PEDIDO_CONFIRMAR_NOMBRE','PEDIDO_DIRECCION_ELEGIR','PEDIDO_DIRECCION_TEXTO',
  'PEDIDO_GRUPO_OPCION','PEDIDO_INGRESAR_NOMBRE','PEDIDO_INGRESAR_TELEFONO',
  'PEDIDO_MEDIO_PAGO','PEDIDO_MODALIDAD','PEDIDO_MONTO_EFECTIVO','PEDIDO_NOMBRES_CONFIRMAR','PEDIDO_NOMBRES_ENVASE',
  'PEDIDO_NOTA','PEDIDO_OFERTA_APLICAR','PEDIDO_OFERTA_FALTA','PEDIDO_PAGO_DIV_MONTO',
  'PEDIDO_PRODUCTOS','PEDIDO_QUITAR_ITEM','PEDIDO_REFERENCIA','PEDIDO_SABOR','PEDIDO_TAMANO','PEDIDO_UBICACION',
  'PEDIDO_VER_CARRITO','RESERVA_CAMBIAR_DETALLE','RESERVA_CANCELAR_CONFIRMAR','RESERVA_CANCELAR_ELEGIR',
  'RESERVA_CONFIRMAR_NOMBRE','RESERVA_FECHA','RESERVA_FECHA_OTRA','RESERVA_HORA','RESERVA_INGRESAR_NOMBRE',
  'RESERVA_INGRESAR_TELEFONO','RESERVA_PERSONAS','RESERVA_PREGUNTAR_NOTA','RESERVA_RESUMEN_CONFIRMAR',
  'MODAL','LOC','CAT','PROD','VARIANT','GROUP','MORE','PROMO','SUMMARY','PAY','CASH','RES_PEOPLE','RES_TIME','MINE','ASK',
];
const ENTRADAS = [
  { texto: 'hola' }, { texto: '?' }, { texto: 'gracias' }, { texto: 'asdf qwer zxcv' },
  { texto: 'x', buttonPayload: 'ped_viejo_xyz' }, { texto: 'x', buttonPayload: 'id_que_no_existe' },
];

describe('Invariante: la máquina de estados nunca deja un mensaje sin acción', () => {
  for (const estado of ESTADOS.filter((e) => e !== 'ATENCION_PERSONA')) { // ATENCION_PERSONA puede callar por diseño; el ejecutor lo registra (invariante-ejecutor)
    for (const e of ENTRADAS) {
      it(`${estado} + ${JSON.stringify(e)} produce al menos una acción`, () => {
        const res = transicionarEstado({ version: 2, estado: estado as any, repreguntasFallidas: 0 } as any, normalizarEntrada(e as any), {
          datosLocal: { abierta: true, abre: '12:00', cierra: '23:00' } as any,
          categoriasCarta: [],
        } as any);
        expect(res.acciones.length).toBeGreaterThan(0);
      });
    }
  }
});

describe('esSaludo', () => {
  it.each(['hola', 'Hola!', 'ola', 'buenas', 'Buenos días', 'buenas tardes', 'BUENAS NOCHES', 'hi', 'hello', 'menú', 'holaaa', '¡Hola, buenas tardes!'])('%s es saludo', (t) =>
    expect(esSaludo(t)).toBe(true));
  it.each(['', '?', 'quiero pedir', 'hola quiero mi pedido', 'gracias'])('%s no es saludo', (t) => expect(esSaludo(t)).toBe(false));
});
