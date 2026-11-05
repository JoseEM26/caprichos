import { transicionarEstado } from '../maquina-estados';
import { normalizarEntrada } from '../normalizador-entrada.util';
import { ContextoConversacion, FlujoConversacion } from '../tipos-conversacion';
import { BOTONES_PEDIDO_NOMBRE_CONFIRMAR, TEXTOS_BOT } from '../textos-bot';
import { celularPuntosEnmascarado } from '../../utilidades/enmascarar.util';

// Lo que el bot dice de puntos: solo se acumulan con el celular de quien escribe y se canjean en la carta virtual
const FRASE_CANJE_PERMITIDA = 'los canjeas en nuestra carta virtual';
const PALABRAS_CANJE = /canjear|canjeas|canje|usar (tus )?puntos|cup[oó]n|otro n[uú]mero|otro celular/i;

describe('Puntos en el bot de WhatsApp: solo acumular, con el celular de quien escribe', () => {
  describe('celularPuntosEnmascarado', () => {
    it('muestra solo los 3 últimos dígitos del celular peruano', () => {
      expect(celularPuntosEnmascarado('51987654321')).toBe('9•• ••• 321');
      expect(celularPuntosEnmascarado('987654321')).toBe('9•• ••• 321');
    });

    it('sin celular real (BSUID de WhatsApp, vacío) devuelve null', () => {
      expect(celularPuntosEnmascarado('bsuid:user123')).toBeNull();
      expect(celularPuntosEnmascarado('PE.12345678')).toBeNull();
      expect(celularPuntosEnmascarado(undefined)).toBeNull();
    });
  });

  describe('mensaje de confirmación del nombre (el mismo mensaje, con la línea de puntos)', () => {
    it('con celular: la línea de puntos muestra el número enmascarado', () => {
      const texto = TEXTOS_BOT.pedidoConfirmarNombre('José M', { celular: '9•• ••• 321', saldo: null });
      expect(texto).toBe(
        '¿Confirmas que tu nombre es José M? 👤\n\n' +
          '⭐ Con este pedido sumas puntos en tu número 9•• ••• 321. Aquí solo se acumulan; los canjeas en nuestra carta virtual.',
      );
    });

    it('sin celular: la línea va sin número', () => {
      const texto = TEXTOS_BOT.pedidoConfirmarNombre('José M', { celular: null, saldo: null });
      expect(texto).toContain('sumas puntos en tu número de WhatsApp.');
      expect(texto).not.toMatch(/\d/);
    });

    it('con cuenta: agrega el saldo ya disponible; sin cuenta no lo muestra', () => {
      expect(TEXTOS_BOT.pedidoConfirmarNombre('José M', { celular: '9•• ••• 321', saldo: 12.5 })).toContain('\nTu saldo: 12.50 puntos.');
      expect(TEXTOS_BOT.pedidoConfirmarNombre('José M', { celular: '9•• ••• 321', saldo: null })).not.toContain('Tu saldo');
    });

    it('los botones siguen con títulos de 20 caracteres o menos', () => {
      for (const b of BOTONES_PEDIDO_NOMBRE_CONFIRMAR) expect(b.titulo.length).toBeLessThanOrEqual(20);
    });
  });

  describe('confirmación del pedido', () => {
    it('incluye la línea «Sumaste puntos» y la frase de la carta virtual, en una línea', () => {
      const texto = TEXTOS_BOT.pedidoConfirmadoExito({ codigo: 'CP-W001', tiempoMin: 25, tiempoMax: 35, esPagoDigital: false });
      expect(texto).toContain('⭐ Sumaste puntos en este pedido; los usas en la carta virtual.');
      expect(texto).not.toMatch(/Sumas puntos con|\*\*\*/);
    });
  });

  describe('ningún texto de puntos ofrece canjear ni pide otro número', () => {
    it('la confirmación del nombre y la del pedido solo mencionan canje en la frase de la carta virtual', () => {
      const textos = [
        TEXTOS_BOT.pedidoConfirmarNombre('José M', { celular: '9•• ••• 321', saldo: 12.5 }),
        TEXTOS_BOT.pedidoConfirmadoExito({ codigo: 'CP-W001', tiempoMin: 25, tiempoMax: 35, esPagoDigital: false }),
      ];
      for (const t of textos) {
        expect(t.includes(FRASE_CANJE_PERMITIDA) || !/canjea/i.test(t)).toBe(true);
        expect(t.replace(FRASE_CANJE_PERMITIDA, '')).not.toMatch(PALABRAS_CANJE);
      }
    });
  });

  describe('flujo de pedido: al llegar a la confirmación del nombre', () => {
    const flujo: FlujoConversacion = {
      version: 2,
      estado: 'PEDIDO_ACCION_CARRITO',
      repreguntasFallidas: 0,
      nombre_perfil_wa: 'José M',
      pedido: {
        estadoInterno: 'PEDIDO_ACCION_CARRITO',
        modalidad: 'RECOGER',
        items: [{ productoId: 'prod_clasica', nombre: 'Hamburguesa Clásica', cantidad: 1, subtotal: 20, opciones: [] }],
      } as any,
    };
    const base = {
      nombreCliente: 'José M',
      telefonoCliente: '51987654321',
      cartaUrlPublica: 'https://carta.caprichos.pe',
      datosLocalPublicos: { pedidoMinimo: 0, tiempo_base: 25, tiempo_maximo: 35 },
    } as ContextoConversacion;

    it('muestra el celular de quien escribe, enmascarado, sin pedirlo', () => {
      const res = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_cart_continuar' }), base);
      expect(res.nuevoEstado).toBe('PEDIDO_CONFIRMAR_NOMBRE');
      const accion = res.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(accion.texto).toContain('sumas puntos en tu número 9•• ••• 321.');
    });

    it('con cuenta de puntos ya cargada en el contexto, muestra el saldo sin consultar nada más', () => {
      const ctx = { ...base, puntos: { porcentaje: 5, cuentaTelefono: { partyId: '1', primerNombre: 'José', saldo: 7 } } } as ContextoConversacion;
      const res = transicionarEstado(flujo, normalizarEntrada({ buttonPayload: 'ped_cart_continuar' }), ctx);
      const accion = res.acciones.find((a) => a.tipo === 'enviarBotones') as any;
      expect(accion.texto).toContain('Tu saldo: 7.00 puntos.');
    });
  });
});
