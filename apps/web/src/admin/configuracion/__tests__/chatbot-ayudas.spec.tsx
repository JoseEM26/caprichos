import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../../comun/api';
import { ChatbotConfiguracionTab, META_FUNCIONES, META_TEXTOS, CLAVES_TEXTOS_BOT, idCatalogoTexto } from '../ChatbotConfiguracionTab';
import { useResaltarCampo } from '../CampoConfig';
import { CATALOGO } from '../catalogo';

const TEXTOS = Object.fromEntries(CLAVES_TEXTOS_BOT.map((k) => [k, `texto ${k}`]));
const CONFIG = {
  textos: TEXTOS,
  textosDefecto: TEXTOS,
  funciones: { pedido: true, pago: true, reservas: true, cambios: true, ia: false, promociones: true },
  antiSpam: { maxPorMinuto: 10, maxPorHora: 60 },
  privacidad: { diasRetencion: 90 },
};
const CONSUMO = { periodo: '2026-10', llamadasTotal: 1, tokensTotal: 10, costoUsdEstimado: 0.1, topeMensualUsd: 20, porcentajeConsumido: 1, topeAlcanzado: false, iaActiva: false };

function Salto() {
  useResaltarCampo();
  return <ChatbotConfiguracionTab puedeVer puedeEditar />;
}

describe('Chatbot: ayudas visibles y saltos del buscador', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'get').mockImplementation(async (ruta: string) => {
      if (ruta === '/admin/chatbot/configuracion') return CONFIG;
      if (ruta === '/admin/configuracion/ia-consumo') return CONSUMO;
      if (ruta === '/admin/configuracion') return [];
      return {};
    });
  });

  it('cada ajuste del catálogo de chatbot tiene su destino en la pantalla y viceversa', async () => {
    const { container } = render(<MemoryRouter><ChatbotConfiguracionTab puedeVer puedeEditar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('tarjeta-proteccion-spam')).toBeInTheDocument());
    await waitFor(() => expect(container.querySelector('[data-cfg-id="chatbot-limite-spam"]')).not.toBeNull());
    const enPantalla = new Set(Array.from(container.querySelectorAll('[data-cfg-id]')).map((e) => e.getAttribute('data-cfg-id')));
    const enCatalogo = new Set(CATALOGO.filter((e) => e.tab === 'chatbot').map((e) => e.id));
    for (const id of enCatalogo) expect(enPantalla.has(id), `falta destino: ${id}`).toBe(true);
    for (const id of enPantalla) expect(enCatalogo.has(id as string), `sin catálogo: ${id}`).toBe(true);
  });

  it('las 5 secciones plegables existen y solo Funciones abre por defecto', async () => {
    render(<MemoryRouter><ChatbotConfiguracionTab puedeVer puedeEditar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('grupo-funciones')).toBeInTheDocument());
    const abiertos = ['grupo-funciones', 'grupo-textos', 'grupo-atencion', 'grupo-proteccion', 'grupo-ia']
      .map((t) => (screen.getByTestId(t) as HTMLDetailsElement).open);
    expect(abiertos).toEqual([true, false, false, false, false]);
  });

  it('cada función explica qué pasa si se pausa y cada texto tiene ayuda y «?»', async () => {
    render(<MemoryRouter><ChatbotConfiguracionTab puedeVer puedeEditar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('grupo-funciones')).toBeInTheDocument());
    for (const m of Object.values(META_FUNCIONES)) expect(screen.getByText(m.siPausas)).toBeInTheDocument();
    for (const k of CLAVES_TEXTOS_BOT) {
      expect(screen.getByText(META_TEXTOS[k].descripcion)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: `Qué pasa si cambias: ${META_TEXTOS[k].titulo}` }));
      expect(screen.getByText(META_TEXTOS[k].efecto)).toBeInTheDocument();
    }
  });

  it('los límites de spam traen unidad, rango, por defecto y ayuda', async () => {
    render(<MemoryRouter><ChatbotConfiguracionTab puedeVer puedeEditar /></MemoryRouter>);
    await waitFor(() => expect(screen.getByLabelText('Mensajes por minuto')).toBeInTheDocument());
    expect(screen.getByText(/Unidad: mensajes · Rango: 3 a 60 · Por defecto: 10/)).toBeInTheDocument();
    expect(screen.getByText(/Unidad: minutos · Rango: 5 a 1440 · Por defecto: 60/)).toBeInTheDocument();
  });

  it('?campo=chatbot-spam-excesos abre la sección Protección, enfoca el input y resalta', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=chatbot&campo=chatbot-spam-excesos']}>
        <Salto />
      </MemoryRouter>,
    );
    await waitFor(() => expect(screen.getByLabelText('Excesos para bloquear')).toBeInTheDocument());
    await waitFor(() => expect((screen.getByTestId('grupo-proteccion') as HTMLDetailsElement).open).toBe(true));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Excesos para bloquear')));
  });

  it('?campo=chatbot-texto-fuera-horario abre Atención y horarios', async () => {
    render(
      <MemoryRouter initialEntries={['/?tab=chatbot&campo=chatbot-texto-fuera-horario']}>
        <Salto />
      </MemoryRouter>,
    );
    await waitFor(() => expect((screen.getByTestId('grupo-atencion') as HTMLDetailsElement).open).toBe(true));
    expect(idCatalogoTexto('chatbot_texto_fuera_horario')).toBe('chatbot-texto-fuera-horario');
  });
});
