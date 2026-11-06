import {
  buscarOfertaParaProducto,
  generarCierreComercial,
  adjuntarCierreComercial,
  validarYCorregirPreciosIa,
  limpiarFrasesPasivasIa,
  formatearMontoSoles,
  formatearMontoDecimal,
  TITULO_BOTON_PEDIR_ESTE,
  TITULO_BOTON_VER_PROMO,
  TITULO_BOTON_VER_PROMOS,
  TITULO_BOTON_VOLVER_MENU,
  TITULO_BOTON_HABLAR_PERSONA,
  TITULO_BOTON_VER_CARTA,
  TITULO_BOTON_HACER_PEDIDO,
  InfoProductoCierre,
} from '../cierre-comercial.util';
import { redondearMonto } from '@caprichos/compartido';
import { ContextoConversacion } from '../tipos-conversacion';

describe('Cierre Comercial Determinista y Promociones (cta-bot)', () => {
  const productoSandwich: InfoProductoCierre = {
    id: 'prod_sw_especial',
    nombre: 'Sándwich Especial',
    categoriaId: 'cat_sandwiches',
    categoria_id: 'cat_sandwiches',
    precio: 20.5,
    precioBase: 20.5,
    descripcion: 'Pechuga deshilachada, jamón inglés, queso Edam, huevo a la plancha y papas al hilo.',
    disponible: true,
    tamanos: [],
  };

  const productoConTamanos: InfoProductoCierre = {
    id: 'prod_frappe_oreo',
    nombre: 'Frappé Oreo',
    categoriaId: 'cat_frappes',
    categoria_id: 'cat_frappes',
    precio: 14.5,
    precioBase: 14.5,
    descripcion: 'Frappé artesanal de galletas Oreo con crema chantilly.',
    disponible: true,
    tamanos: [
      { id: 'tam_12oz', nombre: 'Regular 12 oz', precio: 14.5 },
      { id: 'tam_16oz', nombre: 'Grande 16 oz', precio: 16.5 },
    ],
  };

  const productoBebida: InfoProductoCierre = {
    id: 'prod_chicha',
    nombre: 'Chicha Morada 500ml',
    categoriaId: 'cat_bebidas',
    categoria_id: 'cat_bebidas',
    precio: 8.0,
    precioBase: 8.0,
    disponible: true,
  };

  const catalogoSimulado = [
    {
      id: 'cat_sandwiches',
      nombre: 'Sándwiches',
      productos: [productoSandwich],
    },
    {
      id: 'cat_frappes',
      nombre: 'Frappés',
      productos: [productoConTamanos],
    },
    {
      id: 'cat_bebidas',
      nombre: 'Bebidas',
      productos: [productoBebida],
    },
  ];

  const ofertaComboDuo = {
    id: 'ofe_duo',
    nombre: 'Dúo Irresistible',
    tipo: 'COMBO',
    activo: true,
    canales: ['WHATSAPP', 'CARTA'],
    precio: 24.5,
    combosPrecio: [{ precio: 24.5, tamanoValorId: '1' }],
    combosParte: [
      {
        tipo: 'FIJO',
        productos: ['prod_sw_especial'],
        categorias: ['cat_sandwiches'],
      },
      {
        tipo: 'FIJO',
        productos: ['prod_chicha'],
        categorias: ['cat_bebidas'],
      },
    ],
  };

  const ofertaLlevaPaga = {
    id: 'ofe_2x1',
    nombre: '2x1 Frappés',
    tipo: 'LLEVA_PAGA',
    lleva: 2,
    paga: 1,
    activo: true,
    canales: ['WHATSAPP'],
    alcance_categoria_id: 'cat_frappes',
  };

  const ofertaDescuento = {
    id: 'ofe_desc_15',
    nombre: '15% Descuento Especial',
    tipo: 'DESCUENTO',
    descuento_tipo: 'PORCENTAJE',
    descuento_valor: 15,
    activo: true,
    canales: ['WHATSAPP'],
    alcance_producto_id: 'prod_sw_especial',
  };

  const contextoBase: ContextoConversacion = {
    conversacionId: '100',
    nombreCliente: 'Carlos',
    telefonoCliente: '+51999888777',
    cartaUrlPublica: 'https://caprichos.pe/carta',
    categoriasCarta: catalogoSimulado,
    ofertas: [ofertaComboDuo, ofertaLlevaPaga],
    datosLocal: {
      abierta: true,
      abre: '12:00',
      cierra: '23:00',
      textoEstado: 'de 12:00 a 23:00',
      direccion: 'Campoy, SJL',
      enlaceMapa: 'https://maps.google.com',
      telefono: '999888777',
    },
    funcionesActivas: {
      pedido: true,
      pago: true,
      reservas: true,
      cambios: true,
      ia: true,
      promociones: true,
    },
  };

  // ---------------------------------------------------------------------------
  // 1. Cierre comercial con oferta
  // ---------------------------------------------------------------------------
  describe('1. Cierre comercial con oferta', () => {
    it('debe detectar la oferta combo vigente y calcular precio regular, final y ahorro exacto por código', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSimulado);

      expect(oferta).not.toBeNull();
      expect(oferta?.nombre).toBe('Dúo Irresistible');
      expect(oferta?.tipo).toBe('COMBO');
      // Sándwich (20.50) + Chicha (8.00) = 28.50 regular. Combo = 24.50. Ahorro = 4.00
      expect(oferta?.precioRegular).toBe(28.5);
      expect(oferta?.precioFinal).toBe(24.5);
      expect(oferta?.ahorro).toBe(4);
      expect(oferta?.lineaBeneficio).toBe('Con el Dúo Irresistible pagas S/ 24.50 en vez de S/ 28.50 (ahorras S/ 4)');
      expect(oferta?.sugerenciaVentaAdicional).toBe('Combínalo con Chicha Morada 500ml y ahorras S/ 4');
    });

    it('no ofrece como complemento un producto sin saldo (quedan 0)', () => {
      const catalogoSinSaldo = catalogoSimulado.map((c) => ({
        ...c,
        productos: c.productos.map((p: any) => (p.nombre === 'Chicha Morada 500ml' ? { ...p, quedan: 0 } : p)),
      }));
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSinSaldo);
      expect(oferta?.complementoNombre).toBeUndefined();
      expect(oferta?.sugerenciaVentaAdicional).toBeUndefined();
    });

    it('debe generar botones con [Pedir este producto], [Ver la promo] y [Volver al menú] priorizados', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSimulado);
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta,
        funcionesActivas: {
      pedido: true,
      pago: true,
      reservas: true,
      cambios: true,
      ia: true,
      promociones: true,
    },
      });

      expect(cierre.botones).toHaveLength(3);
      expect(cierre.botones[0]).toEqual({
        id: 'ped_prod_prod_sw_especial',
        titulo: TITULO_BOTON_PEDIR_ESTE,
      });
      expect(cierre.botones[1]).toEqual({
        id: 'btn_promo_ofe_duo',
        titulo: TITULO_BOTON_VER_PROMO,
      });
      expect(cierre.botones[2]).toEqual({
        id: 'btn_menu',
        titulo: TITULO_BOTON_VOLVER_MENU,
      });
      expect(cierre.lineaOferta).toContain('Dúo Irresistible');
      expect(cierre.fraseCierre).toBeDefined();
    });

    it('debe evaluar correctamente promociones tipo LLEVA_PAGA (2x1)', () => {
      const oferta = buscarOfertaParaProducto(productoConTamanos, [ofertaLlevaPaga], catalogoSimulado);

      expect(oferta).not.toBeNull();
      expect(oferta?.tipo).toBe('LLEVA_PAGA');
      // 2 * 14.50 = 29.00 regular, paga 1 * 14.50 = 14.50 final, ahorro = 14.50
      expect(oferta?.precioRegular).toBe(29);
      expect(oferta?.precioFinal).toBe(14.5);
      expect(oferta?.ahorro).toBe(14.5);
      expect(oferta?.lineaBeneficio).toContain('2x1');
      expect(oferta?.lineaBeneficio).toContain('ahorras S/ 14.50');
    });

    it('debe evaluar correctamente promociones tipo DESCUENTO', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaDescuento], catalogoSimulado);

      expect(oferta).not.toBeNull();
      expect(oferta?.tipo).toBe('DESCUENTO');
      // 20.50 * 0.15 = 3.075 -> 3.08 ahorro, final = 17.42
      expect(oferta?.ahorro).toBe(3.08);
      expect(oferta?.precioFinal).toBe(17.42);
      expect(oferta?.lineaBeneficio).toContain('15% Descuento Especial');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Cierre comercial sin oferta
  // ---------------------------------------------------------------------------
  describe('2. Cierre comercial sin oferta', () => {
    it('si no hay ofertas vigentes no inventa promociones ni las menciona', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [], catalogoSimulado);
      expect(oferta).toBeNull();

      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta: null,
        funcionesActivas: {
      pedido: true,
      pago: true,
      reservas: true,
      cambios: true,
      ia: true,
      promociones: true,
    },
      });

      expect(cierre.lineaOferta).toBeUndefined();
      expect(cierre.sugerenciaAdicional).toBeUndefined();
      // Sin oferta, botones: [Pedir este producto], [Volver al menú], [Hablar con persona]
      expect(cierre.botones).toHaveLength(3);
      expect(cierre.botones[0]).toEqual({
        id: 'ped_prod_prod_sw_especial',
        titulo: TITULO_BOTON_PEDIR_ESTE,
      });
      expect(cierre.botones[1]).toEqual({
        id: 'btn_menu',
        titulo: TITULO_BOTON_VOLVER_MENU,
      });
      expect(cierre.botones[2]).toEqual({
        id: 'btn_persona',
        titulo: TITULO_BOTON_HABLAR_PERSONA,
      });
    });

    it('adjuntarCierreComercial no agrega líneas de promo si oferta es nula', () => {
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta: null,
      });

      const textoFinal = adjuntarCierreComercial(
        'El Sándwich Especial cuesta S/ 20.50 y viene con pechuga deshilachada.',
        cierre,
      );

      expect(textoFinal).not.toContain('🏷');
      expect(textoFinal).toContain(cierre.fraseCierre);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Botón Pedir inicia el flujo directamente en ese producto
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // 4. Respeta interruptor de pedido apagado
  // ---------------------------------------------------------------------------
  describe('4. Función pedido apagada (funcionesActivas.pedido = false)', () => {
    it('NO muestra [Pedir este producto] y ofrece [Hablar con persona]', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSimulado);
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta,
        funcionesActivas: { pedido: false },
      });

      // Con pedido false: [Ver la promo], [Volver al menú], [Hablar con persona]
      expect(cierre.botones).toHaveLength(3);
      expect(cierre.botones.some((b) => b.id.startsWith('ped_prod_'))).toBe(false);
      expect(cierre.botones.some((b) => b.id === 'btn_persona')).toBe(true);
      expect(cierre.botones[0].id).toBe('btn_promo_ofe_duo');
      expect(cierre.botones[1].id).toBe('btn_menu');
      expect(cierre.botones[2].id).toBe('btn_persona');
    });

    it('sin oferta y con pedido apagado, ofrece menú y hablar con persona', () => {
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta: null,
        funcionesActivas: { pedido: false },
      });

      expect(cierre.botones).toHaveLength(2);
      expect(cierre.botones[0].id).toBe('btn_menu');
      expect(cierre.botones[1].id).toBe('btn_persona');
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Corrección de precios divergentes de la IA
  // ---------------------------------------------------------------------------
  describe('5. Corrección de precios divergentes de la IA', () => {
    it('si la IA responde con un precio que coincide con el catálogo, no modifica el texto', () => {
      const textoIa = 'El Sándwich Especial cuesta S/ 20.50 y lleva pechuga con queso Edam.';
      const res = validarYCorregirPreciosIa(textoIa, productoSandwich);

      expect(res.corregido).toBe(false);
      expect(res.texto).toBe(textoIa);
    });

    it('si la IA alucina un precio diferente (ej. S/ 18.00), reemplaza por la ficha determinista', () => {
      const textoIaAlucinado = 'El Sándwich Especial cuesta S/ 18.00 y lleva papas al hilo.';
      const res = validarYCorregirPreciosIa(textoIaAlucinado, productoSandwich);

      expect(res.corregido).toBe(true);
      expect(res.texto).not.toContain('S/ 18.00');
      expect(res.texto).toContain('SÁNDWICH ESPECIAL');
      expect(res.texto).toContain('s/ 20.50');
    });

    it('reconoce precios válidos en productos con múltiples presentaciones de tamaño', () => {
      const textoIa = 'El Frappé Oreo cuesta S/ 14.50 en regular y S/ 16.50 en tamaño grande.';
      const res = validarYCorregirPreciosIa(textoIa, productoConTamanos);

      expect(res.corregido).toBe(false);
      expect(res.texto).toBe(textoIa);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Redondeo determinista y formato de precios
  // ---------------------------------------------------------------------------
  describe('6. Redondeo determinista y formato de precios', () => {
    it('formatea montos con decimales respetando centavos', () => {
      expect(formatearMontoDecimal(16.5)).toBe('S/ 16.50');
      expect(formatearMontoDecimal(20.555)).toBe('S/ 20.56');
      expect(formatearMontoDecimal(4)).toBe('S/ 4.00');
    });

    it('formatearMontoSoles muestra números enteros de forma limpia', () => {
      expect(formatearMontoSoles(4)).toBe('S/ 4');
      expect(formatearMontoSoles(37)).toBe('S/ 37');
      expect(formatearMontoSoles(16.5)).toBe('S/ 16.50');
    });

    it('redondearMonto evita errores de precisión de punto flotante de JavaScript', () => {
      expect(redondearMonto(0.1 + 0.2)).toBe(0.3);
      expect(redondearMonto(1.005)).toBe(1.01);
      expect(redondearMonto(10.285)).toBe(10.29);
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Títulos de botones <= 20 caracteres y máximo 3 botones
  // ---------------------------------------------------------------------------
  describe('7. Reglas de botones de WhatsApp (Meta Cloud API)', () => {
    it('todos los títulos de botones generados tienen una longitud menor o igual a 20 caracteres', () => {
      const botonesTest = [
        TITULO_BOTON_PEDIR_ESTE,
        TITULO_BOTON_VER_PROMO,
        TITULO_BOTON_VER_PROMOS,
        TITULO_BOTON_VOLVER_MENU,
        TITULO_BOTON_HABLAR_PERSONA,
        TITULO_BOTON_VER_CARTA,
        TITULO_BOTON_HACER_PEDIDO,
      ];

      for (const titulo of botonesTest) {
        expect(titulo.length).toBeLessThanOrEqual(20);
      }
    });

    it('garantiza un máximo estricto de 3 botones por mensaje interactivo', () => {
      // Con producto y con oferta (habría 4 candidatos: pedir, promo, menú, persona)
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSimulado);
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta,
        funcionesActivas: {
      pedido: true,
      pago: true,
      reservas: true,
      cambios: true,
      ia: true,
      promociones: true,
    },
      });

      expect(cierre.botones.length).toBeLessThanOrEqual(3);
      for (const b of cierre.botones) {
        expect(b.titulo.length).toBeLessThanOrEqual(20);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 8. No repetir cierre dentro del flujo de pedido
  // ---------------------------------------------------------------------------
  describe('8. No repetir cierre dentro del flujo de pedido', () => {
    it('si el cliente ya se encuentra dentro del flujo de pedido de ese producto, omite el cierre', () => {
      const oferta = buscarOfertaParaProducto(productoSandwich, [ofertaComboDuo], catalogoSimulado);
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta,
        yaEnPedido: true,
      });

      expect(cierre.fraseCierre).toBe('');
      expect(cierre.botones).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Respuestas de IA que recomiendan varios productos
  // ---------------------------------------------------------------------------
  describe('9. Respuestas con múltiples productos recomendados', () => {
    it('ofrece botones [Hacer un pedido] y [Ver la carta] cuando se recomiendan varios productos', () => {
      const cierre = generarCierreComercial({
        productosRecomendados: [productoSandwich, productoConTamanos],
        funcionesActivas: {
      pedido: true,
      pago: true,
      reservas: true,
      cambios: true,
      ia: true,
      promociones: true,
    },
      });

      expect(cierre.botones).toHaveLength(3);
      expect(cierre.botones[0]).toEqual({
        id: 'pedir',
        titulo: TITULO_BOTON_HACER_PEDIDO,
      });
      expect(cierre.botones[1]).toEqual({
        id: 'carta',
        titulo: TITULO_BOTON_VER_CARTA,
      });
      expect(cierre.botones[2]).toEqual({
        id: 'btn_persona',
        titulo: TITULO_BOTON_HABLAR_PERSONA,
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Limpieza de frases pasivas o inventadas de la IA
  // ---------------------------------------------------------------------------
  describe('10. Limpieza de frases pasivas de compra de la IA', () => {
    it('elimina la frase no deseada "Si deseas pedirlo, recuerda hacerlo a través del menú de botones. Buen provecho!"', () => {
      const textoSucio =
        'Nuestro Sándwich Especial lleva pechuga y jamón inglés por S/ 20.50.\n\nSi deseas pedirlo, recuerda hacerlo a través del menú de botones. Buen provecho!';
      const textoLimpio = limpiarFrasesPasivasIa(textoSucio);

      expect(textoLimpio).toBe(
        'Nuestro Sándwich Especial lleva pechuga y jamón inglés por S/ 20.50.',
      );
      expect(textoLimpio).not.toContain('menú de botones');
      expect(textoLimpio).not.toContain('Buen provecho');
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Simulación completa: 'que lleva el sandwich especial' con IA simulada
  // ---------------------------------------------------------------------------
  describe('11. Simulación de consulta real sobre Sándwich Especial', () => {
    it('procesa la respuesta de IA simulada, reemplaza el cierre pasivo y agrega cierre comercial animando a comprar con botones', () => {
      const respuestaIaSimulada =
        'El Sándwich Especial lleva pechuga de pollo deshilachada, jamón inglés, queso Edam fundido, huevo a la plancha y papas al hilo por S/ 20.50. Si deseas pedirlo, recuerda hacerlo a través del menú de botones. Buen provecho!';

      // 1. Validar precio del catálogo
      const validacion = validarYCorregirPreciosIa(respuestaIaSimulada, productoSandwich, contextoBase.cartaUrlPublica);
      expect(validacion.corregido).toBe(false);

      // 2. Buscar oferta vinculada
      const oferta = buscarOfertaParaProducto(productoSandwich, contextoBase.ofertas, contextoBase.categoriasCarta);
      expect(oferta).not.toBeNull();
      expect(oferta?.nombre).toBe('Dúo Irresistible');

      // 3. Generar cierre comercial determinista
      const cierre = generarCierreComercial({
        producto: productoSandwich,
        oferta,
        funcionesActivas: contextoBase.funcionesActivas,
        indiceVariante: 0,
      });

      // 4. Adjuntar cierre
      const mensajeFinal = adjuntarCierreComercial(validacion.texto, cierre);

      // Verificaciones estrictas
      expect(mensajeFinal).toContain('El Sándwich Especial lleva pechuga');
      expect(mensajeFinal).not.toContain('recuerda hacerlo a través del menú de botones');
      expect(mensajeFinal).not.toContain('Buen provecho');
      expect(mensajeFinal).toContain('🏷 Con el Dúo Irresistible pagas S/ 24.50 en vez de S/ 28.50 (ahorras S/ 4)');
      expect(mensajeFinal).toContain('¿Te animas a pedirlo?');

      expect(cierre.botones).toHaveLength(3);
      expect(cierre.botones[0]).toEqual({
        id: 'ped_prod_prod_sw_especial',
        titulo: 'Pedir este producto',
      });
      expect(cierre.botones[1]).toEqual({
        id: 'btn_promo_ofe_duo',
        titulo: 'Ver la promo',
      });
      expect(cierre.botones[2]).toEqual({
        id: 'btn_menu',
        titulo: 'Volver al menú',
      });
    });
  });
});
