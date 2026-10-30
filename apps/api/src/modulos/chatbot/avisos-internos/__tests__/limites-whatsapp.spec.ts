import {
  BOTONES_AVISO_ALMACEN,
  BOTONES_AVISO_PEDIDO,
  FILAS_ACCIONES_EQUIPO,
  TEXTOS_AVISOS,
} from '../avisos-internos.textos';
import { DatosAvisoAlmacen, DatosAvisoNuevoPedido } from '../avisos-internos.tipos';

describe('Límites estrictos de WhatsApp Meta Cloud API para Avisos Internos al Equipo (Ola 4, Agente H)', () => {
  const LIMITE_BOTON_TITULO = 20;
  const LIMITE_CUERPO_TEXTO = 1024;
  const LIMITE_MAX_BOTONES = 3;
  const LIMITE_BOTON_LISTA = 20;
  const LIMITE_FILA_TITULO = 24;
  const LIMITE_FILA_DESCRIPCION = 72;
  const LIMITE_MAX_FILAS = 10;

  describe('Validación de Botones de Respuesta Rápida (Quick Reply)', () => {
    const gruposBotones = [
      { nombre: 'BOTONES_AVISO_PEDIDO', botones: BOTONES_AVISO_PEDIDO(101n) },
      { nombre: 'BOTONES_AVISO_PEDIDO con ID string', botones: BOTONES_AVISO_PEDIDO('ped_999') },
      { nombre: 'BOTONES_AVISO_ALMACEN', botones: BOTONES_AVISO_ALMACEN(55n) },
      { nombre: 'BOTONES_AVISO_ALMACEN con ID string', botones: BOTONES_AVISO_ALMACEN('ins_888') },
    ];

    it('ningún grupo de botones debe superar el máximo de 3 botones de Meta', () => {
      for (const grupo of gruposBotones) {
        expect(grupo.botones.length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
        expect(grupo.botones.length).toBeGreaterThan(0);
      }
    });

    it('cada botón debe tener un ID no vacío y su título debe tener <= 20 caracteres', () => {
      for (const grupo of gruposBotones) {
        for (const b of grupo.botones) {
          expect(b.id.trim().length).toBeGreaterThan(0);
          expect(b.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
          expect(b.titulo.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Validación de Mensajes de Lista (List Messages)', () => {
    it('las filas de acción para el equipo respetan los límites de Meta', () => {
      const filas = FILAS_ACCIONES_EQUIPO(101n);
      expect(filas.length).toBeLessThanOrEqual(LIMITE_MAX_FILAS);

      for (const f of filas) {
        expect(f.id.trim().length).toBeGreaterThan(0);
        expect(f.titulo.length).toBeLessThanOrEqual(LIMITE_FILA_TITULO);
        if (f.descripcion) {
          expect(f.descripcion.length).toBeLessThanOrEqual(LIMITE_FILA_DESCRIPCION);
        }
      }
    });
  });

  describe('Validación exhaustiva de Cuerpos de Texto (Body <= 1024 caracteres)', () => {
    const datosPedidoBase: DatosAvisoNuevoPedido = {
      pedidoId: 101n,
      codigo: 'CP-W001',
      canal: 'WHATSAPP',
      modalidad: 'DELIVERY',
      clienteNombre: 'Ana Pérez',
      clienteTelefonoMask: '+51 9*** ***21',
      total: 45.5,
      direccion: 'Av. Larco 1234, Dpto 502, Miraflores',
      referencia: 'Edificio blanco con rejas negras',
      lineas: [
        { nombre: 'Frappe Oreo', cantidad: 2, tamano: 'Grande', nota: 'Sin crema' },
        { nombre: 'Tarta de Fresa', cantidad: 1, tamano: null, nota: null },
      ],
    };

    const datosAlmacenAgotado: DatosAvisoAlmacen = {
      insumoId: 12n,
      nombreInsumo: 'Leche Evaporada Gloria Azul',
      tipoAlerta: 'AGOTADO',
      stockActual: 0,
      stockMinimo: 10,
      unidadMedida: 'UND',
      lugarNombre: 'Almacén Principal - Estante 2',
    };

    const datosAlmacenPorPedir: DatosAvisoAlmacen = {
      insumoId: 15n,
      nombreInsumo: 'Café Grano Tostado Especial Villa Rica',
      tipoAlerta: 'POR_PEDIR',
      stockActual: 4.5,
      stockMinimo: 5.0,
      unidadMedida: 'KG',
      lugarNombre: 'Barra y Cocina',
    };

    it('todos los textos generados deben tener longitud <= 1024 caracteres', () => {
      // Caso 1: Pedido delivery estándar
      const txtDelivery = TEXTOS_AVISOS.nuevoPedido(datosPedidoBase);
      expect(txtDelivery.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
      expect(txtDelivery.length).toBeGreaterThan(0);

      // Caso 2: Pedido recojo sin dirección
      const txtRecojo = TEXTOS_AVISOS.nuevoPedido({
        ...datosPedidoBase,
        codigo: 'CP-W002',
        canal: 'CARTA',
        modalidad: 'RECOJO',
        direccion: null,
        referencia: null,
      });
      expect(txtRecojo.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);

      // Caso 3: Pedido en salón
      const txtSalon = TEXTOS_AVISOS.nuevoPedido({
        ...datosPedidoBase,
        codigo: 'CP-W003',
        canal: 'MOZO',
        modalidad: 'SALON',
      });
      expect(txtSalon.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);

      // Caso 4: Pedido gigante con muchas líneas (debe recortarse limpiamente sin superar 1024)
      const lineasLargas = Array.from({ length: 40 }, (_, i) => ({
        nombre: `Producto Especial Sabor Intenso Variedad ${i + 1}`,
        cantidad: 5,
        tamano: 'Extra Grande Familiar',
        nota: 'Con bastante hielo y empaque térmico reforzado',
      }));

      const txtGigante = TEXTOS_AVISOS.nuevoPedido({
        ...datosPedidoBase,
        codigo: 'CP-W999',
        lineas: lineasLargas,
      });
      expect(txtGigante.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
      expect(txtGigante).toContain('... y más items');

      // Caso 5: Alerta almacén agotado
      const txtAgotado = TEXTOS_AVISOS.almacenInsumoAgotado(datosAlmacenAgotado);
      expect(txtAgotado.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);

      // Caso 6: Alerta almacén por pedir
      const txtPorPedir = TEXTOS_AVISOS.almacenInsumoPorPedir(datosAlmacenPorPedir);
      expect(txtPorPedir.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);

      // Caso 7: Confirmaciones de acción admin
      const txtAprobado = TEXTOS_AVISOS.confirmacionAccionAdmin('APROBADO', 'CP-W001');
      expect(txtAprobado.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);

      const txtRechazado = TEXTOS_AVISOS.confirmacionAccionAdmin('RECHAZADO', 'CP-W001');
      expect(txtRechazado.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
    });
  });

  describe('Conservación de Emojis en los Mensajes', () => {
    it('verifica que los mensajes de aviso interno conserven los emojis para claridad visual', () => {
      const pedidoTxt = TEXTOS_AVISOS.nuevoPedido({
        pedidoId: 1n,
        codigo: 'CP-W001',
        canal: 'WHATSAPP',
        modalidad: 'DELIVERY',
        clienteNombre: 'Ana',
        clienteTelefonoMask: '+51 9*** ***21',
        total: 20,
        lineas: [{ nombre: 'Frappe', cantidad: 1 }],
      });

      expect(pedidoTxt).toContain('🚨');
      expect(pedidoTxt).toContain('📦');
      expect(pedidoTxt).toContain('👤');
      expect(pedidoTxt).toContain('🛵');
      expect(pedidoTxt).toContain('💵');
      expect(pedidoTxt).toContain('📋');

      const agotadoTxt = TEXTOS_AVISOS.almacenInsumoAgotado({
        insumoId: 1n,
        nombreInsumo: 'Leche',
        tipoAlerta: 'AGOTADO',
        stockActual: 0,
        stockMinimo: 5,
      });

      expect(agotadoTxt).toContain('🚨');
      expect(agotadoTxt).toContain('⚠️');
      expect(agotadoTxt).toContain('🔴');
      expect(agotadoTxt).toContain('📦');
      expect(agotadoTxt).toContain('📉');

      const porPedirTxt = TEXTOS_AVISOS.almacenInsumoPorPedir({
        insumoId: 2n,
        nombreInsumo: 'Café',
        tipoAlerta: 'POR_PEDIR',
        stockActual: 3,
        stockMinimo: 5,
      });

      expect(porPedirTxt).toContain('📦');
      expect(porPedirTxt).toContain('⚠️');
      expect(porPedirTxt).toContain('🟡');
      expect(porPedirTxt).toContain('📊');

      const botonesPedido = BOTONES_AVISO_PEDIDO(1n);
      expect(botonesPedido[0].titulo).toContain('✅');
      expect(botonesPedido[1].titulo).toContain('❌');

      const botonesAlmacen = BOTONES_AVISO_ALMACEN(1n);
      expect(botonesAlmacen[0].titulo).toContain('👍');
      expect(botonesAlmacen[1].titulo).toContain('📦');
    });
  });
});
