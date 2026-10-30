import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CampoCodigoSupervisor } from '../../../comun/CampoCodigoSupervisor';
import { CodigoSupervisorView } from '../CodigoSupervisorView';
import { api, ErrorApi } from '../../../comun/api';

describe('Componentes del Código del Supervisor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('CampoCodigoSupervisor', () => {
    it('renderiza etiqueta, placeholder y texto de ayuda predeterminados', () => {
      render(
        <CampoCodigoSupervisor
          valor=""
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Código del supervisor (6 dígitos)')).toBeInTheDocument();
      expect(
        screen.getByText('Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos'),
      ).toBeInTheDocument();
      const input = screen.getByTestId('input-codigo-supervisor') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.placeholder).toBe('••••••');
      expect(input.maxLength).toBe(6);
      expect(input.getAttribute('inputmode')).toBe('numeric');
    });

    it('solo admite dígitos numéricos y trunca a 6 dígitos', () => {
      const onChange = vi.fn();
      render(
        <CampoCodigoSupervisor
          valor=""
          onChange={onChange}
        />,
      );

      const input = screen.getByTestId('input-codigo-supervisor');
      fireEvent.change(input, { target: { value: 'abc123xyz456extra' } });

      expect(onChange).toHaveBeenCalledWith('123456');
    });

    it('muestra el mensaje de error con rol alert cuando se provee', () => {
      render(
        <CampoCodigoSupervisor
          valor="123"
          onChange={vi.fn()}
          error="Código incorrecto"
        />,
      );

      const alerta = screen.getByRole('alert');
      expect(alerta).toHaveTextContent('Código incorrecto');
    });

    it('permite personalizar id, etiqueta, ayuda y dataTestId', () => {
      render(
        <CampoCodigoSupervisor
          id="custom-id"
          dataTestId="custom-test-id"
          etiqueta="Código de autorización"
          ayuda="Ayuda personalizada"
          valor="654321"
          onChange={vi.fn()}
        />,
      );

      expect(screen.getByText('Código de autorización')).toBeInTheDocument();
      expect(screen.getByText('Ayuda personalizada')).toBeInTheDocument();
      expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
      expect(screen.getByLabelText('Código de autorización')).toHaveAttribute('id', 'custom-id');
    });
  });

  describe('CodigoSupervisorView', () => {
    let writeTextMock: any;

    beforeEach(() => {
      writeTextMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextMock },
        writable: true,
        configurable: true,
      });
    });

    it('obtiene y renderiza el código rotativo de 6 dígitos con cuenta regresiva', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        codigo: '482910',
        segundosRestantes: 25,
      });

      render(<CodigoSupervisorView />);

      const codigoEl = await screen.findByTestId('codigo-grande');
      expect(codigoEl).toHaveTextContent('482 910');
      expect(screen.getByTestId('segundos-restantes')).toHaveTextContent('25s');
      expect(
        screen.getByText(/Dicta este código al cajero; cambia cada 30 segundos/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId('btn-copiar-codigo')).toBeInTheDocument();
      expect(screen.getByTestId('btn-rotar-secreto')).toBeInTheDocument();
    });

    it('el botón Copiar copia el código y muestra retroalimentación visual', async () => {
      vi.spyOn(api, 'get').mockResolvedValueOnce({
        codigo: '123456',
        segundosRestantes: 20,
      });

      render(<CodigoSupervisorView />);
      const codigoEl = await screen.findByTestId('codigo-grande');
      expect(codigoEl).toHaveTextContent('123 456');

      const btnCopiar = screen.getByTestId('btn-copiar-codigo');
      fireEvent.click(btnCopiar);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('123456');
      expect(await screen.findByText(/Copiado/i)).toBeInTheDocument();
    });

    it('decrementa el temporizador cada segundo', async () => {
      vi.useFakeTimers();

      vi.spyOn(api, 'get').mockResolvedValue({
        codigo: '789012',
        segundosRestantes: 15,
      });

      render(<CodigoSupervisorView />);

      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('codigo-grande')).toHaveTextContent('789 012');
      expect(screen.getByTestId('segundos-restantes')).toHaveTextContent('15s');

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByTestId('segundos-restantes')).toHaveTextContent('12s');

      vi.useRealTimers();
    });

    it('muestra estado 409 SUPERVISOR_SIN_CONFIGURAR y botón Generar secreto', async () => {
      vi.spyOn(api, 'get').mockRejectedValueOnce(
        new ErrorApi('SUPERVISOR_SIN_CONFIGURAR', 'El local no tiene configurado el secreto', 409),
      );

      render(<CodigoSupervisorView />);

      expect(await screen.findByText(/Código rotativo no configurado/i)).toBeInTheDocument();
      expect(
        screen.getByText(/El código rotativo de supervisor aún no está configurado/i),
      ).toBeInTheDocument();

      const btnGenerar = screen.getByTestId('btn-generar-secreto');
      expect(btnGenerar).toBeInTheDocument();
    });

    it('Generar secreto abre confirmación Sí/No y al confirmar llama a la API', async () => {
      vi.spyOn(api, 'get')
        .mockRejectedValueOnce(
          new ErrorApi('SUPERVISOR_SIN_CONFIGURAR', 'Sin configurar', 409),
        )
        .mockResolvedValueOnce({
          codigo: '998877',
          segundosRestantes: 30,
        });

      const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({ ok: true });

      render(<CodigoSupervisorView />);

      const btnGenerar = await screen.findByTestId('btn-generar-secreto');
      fireEvent.click(btnGenerar);

      // Modal de confirmación
      expect(screen.getByText(/¿Generar secreto del supervisor\?/i)).toBeInTheDocument();

      const btnConfirmar = screen.getByRole('button', { name: /Sí, generar secreto/i });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyPost).toHaveBeenCalledWith('/admin/supervisor/generar-secreto', {});
      });

      const codigoEl = await screen.findByTestId('codigo-grande');
      expect(codigoEl).toHaveTextContent('998 877');
    });

    it('Rotar secreto advierte invalidación del anterior y al confirmar llama a la API', async () => {
      vi.spyOn(api, 'get')
        .mockResolvedValueOnce({
          codigo: '112233',
          segundosRestantes: 28,
        })
        .mockResolvedValueOnce({
          codigo: '445566',
          segundosRestantes: 30,
        });

      const spyPost = vi.spyOn(api, 'post').mockResolvedValueOnce({ ok: true });

      render(<CodigoSupervisorView />);
      const codigoEl = await screen.findByTestId('codigo-grande');
      expect(codigoEl).toHaveTextContent('112 233');

      const btnRotar = screen.getByTestId('btn-rotar-secreto');
      fireEvent.click(btnRotar);

      expect(screen.getByText(/¿Rotar secreto del supervisor\?/i)).toBeInTheDocument();
      expect(
        screen.getByText(/quedarán invalidados inmediatamente/i),
      ).toBeInTheDocument();

      const btnConfirmar = screen.getByRole('button', { name: /Sí, rotar secreto/i });
      fireEvent.click(btnConfirmar);

      await waitFor(() => {
        expect(spyPost).toHaveBeenCalledWith('/admin/supervisor/rotar-secreto', {});
      });

      const nuevoCodigo = await screen.findByTestId('codigo-grande');
      expect(nuevoCodigo).toHaveTextContent('445 566');
    });
  });
});
