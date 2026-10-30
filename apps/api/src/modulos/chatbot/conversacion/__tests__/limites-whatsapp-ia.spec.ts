import {
  BOTON_IA_VOLVER_MENU,
  BOTON_IA_HABLAR_PERSONA,
  BOTON_IA_HACER_PEDIDO,
  BOTON_IA_VER_CARTA,
  BOTONES_IA_ESTANDAR,
  BOTONES_IA_CON_PEDIDO,
  TEXTOS_IA,
} from '../textos-ia';

describe('Límites estrictos de Meta WhatsApp Cloud API para catálogo de textos de IA (Ola 3, Agente G)', () => {
  const LIMITE_BOTON_TITULO = 20;
  const LIMITE_CUERPO_TEXTO = 1024;
  const LIMITE_MAX_BOTONES = 3;

  const todosLosBotones = [
    BOTON_IA_VOLVER_MENU,
    BOTON_IA_HABLAR_PERSONA,
    BOTON_IA_HACER_PEDIDO,
    BOTON_IA_VER_CARTA,
  ];

  it('todos los títulos de botones individuales deben tener <= 20 caracteres', () => {
    todosLosBotones.forEach((boton) => {
      expect(boton.titulo.length).toBeLessThanOrEqual(LIMITE_BOTON_TITULO);
      expect(boton.id).toBeTruthy();
    });
  });

  it('los conjuntos de botones no deben exceder el máximo de 3 botones por mensaje', () => {
    expect(BOTONES_IA_ESTANDAR.length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
    expect(BOTONES_IA_CON_PEDIDO.length).toBeLessThanOrEqual(LIMITE_MAX_BOTONES);
  });

  it('todos los textos del catálogo TEXTOS_IA deben tener <= 1024 caracteres en el cuerpo', () => {
    const funcionesTexto = Object.values(TEXTOS_IA);

    funcionesTexto.forEach((fn) => {
      if (typeof fn === 'function') {
        const resultado = fn();
        expect(typeof resultado).toBe('string');
        expect(resultado.length).toBeGreaterThan(0);
        expect(resultado.length).toBeLessThanOrEqual(LIMITE_CUERPO_TEXTO);
      }
    });
  });

  it('los textos contienen los emojis amigables del mockup', () => {
    const defensa = TEXTOS_IA.defensaInyeccion();
    expect(defensa).toContain('🍰');

    const avisoPedido = TEXTOS_IA.avisoHacerPedidoPorBotones();
    expect(avisoPedido).toContain('🍰');
  });
});
