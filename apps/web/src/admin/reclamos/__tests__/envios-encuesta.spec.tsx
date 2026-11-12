import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { comprobantesApi } from '../../comprobantes/comprobantesApi';
import { EnviosEncuestaPanel } from '../EnviosEncuestaPanel';

describe('EnviosEncuestaPanel', () => {
  it('al abrir muestra la plantilla, el motivo de omision y el error de envio', async () => {
    vi.spyOn(comprobantesApi, 'listarEnviosEncuesta').mockResolvedValue({
      plantilla: { nombre: 'caprichos_encuesta_posventa', idioma: 'es', categoria: 'UTILITY' },
      envios: [
        { id: '1', pedidoCodigo: 'CP-1', cliente: 'Ana', telefonoEnmascarado: '9** *** 321', estado: 'ENVIADA', motivo: null, envio: 'FALLIDO', errorEnvio: 'plantilla no encontrada', fecha: '2026-11-12T15:00:00Z' },
        { id: '2', pedidoCodigo: 'CP-2', cliente: 'Ana', telefonoEnmascarado: '9** *** 321', estado: 'OMITIDA', motivo: 'TOPE_POR_CELULAR', envio: null, errorEnvio: null, fecha: '2026-11-12T16:00:00Z' },
      ],
    });
    const { container } = render(<EnviosEncuestaPanel />);
    const det = container.querySelector('details')!;
    det.open = true;
    fireEvent(det, new Event('toggle'));
    await waitFor(() => expect(screen.getByText('caprichos_encuesta_posventa')).toBeTruthy());
    expect(screen.getByText(/plantilla no encontrada/)).toBeTruthy();
    expect(screen.getByText(/Omitida: Ya recibió una encuesta/)).toBeTruthy();
  });
});
