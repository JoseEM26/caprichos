import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AprendizajesView from '../AprendizajesView';
import { MODULOS } from '../../modulos';
import { moduloVisible } from '../../../comun/permisosPuro';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';

function sesion(permisos: string[]) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Prueba', rol: 'CAJERO', roles: ['CAJERO'] },
    permisos,
    tiene: (p: string) => permisos.includes(p),
  } as any);
}

const prop = (o: any = {}) => ({
  id: 'p1', tipo: 'FAQ', intencion: 'horario', pregunta: '¿Abren domingo?', respuesta: 'Sí, desde las 9.', frases: ['abren hoy'],
  repeticiones: 3, evidencia: [{ conversacionId: 'c1', extracto: 'Cliente: hola, abren?' }], estado: 'PENDIENTE', noche: '2026-11-11',
  creadoEn: '2026-11-12T03:00:00Z', decididoPor: null, decididoEn: null, motivo: null, ...o,
});
const resumen = (o: any = {}) => ({
  pendientes: 1, topeUsd: 1,
  ultimaNoche: { fecha: '2026-11-11', estado: 'TOPE', chatsLeidos: 10, descartadosFueraTema: 4, propuestas: 2, tokens: 1234, usd: 0.98 },
  noches: [{ fecha: '2026-11-10', estado: 'OK', usd: 0.2, propuestas: 1 }, { fecha: '2026-11-11', estado: 'TOPE', usd: 0.98, propuestas: 2 }], ...o,
});

let post: any;
let items: any[];
beforeEach(() => {
  vi.restoreAllMocks();
  items = [prop()];
  post = vi.spyOn(api, 'post').mockResolvedValue({});
  vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
    if (url.includes('/resumen')) return resumen();
    if (url.includes('/conocimiento')) return { items: [{ id: 'k1', version: 2, tipo: 'FAQ', intencion: 'horario', pregunta: '¿Hasta qué hora?', respuesta: 'Hasta las 9.', frases: [], aprobadoPor: 'Ana', aprobadoEn: '2026-11-10T10:00:00Z' }] };
    return { items, total: items.length };
  });
});

describe('Aprendizajes', () => {
  it('el módulo exige aprendizajes/ver', () => {
    const m = MODULOS.find((x) => x.clave === 'aprendizajes')!;
    expect(m).toMatchObject({ ruta: '/admin/aprendizajes', permisoMinimo: 'aprendizajes/ver' });
    expect(moduloVisible(m, (p) => p === 'aprendizajes/ver')).toBe(true);
    expect(moduloVisible(m, (p) => p === 'analisis/ver')).toBe(false);
  });

  it('sin aprendizajes/ver no muestra nada ni consulta', () => {
    sesion(['analisis/ver']);
    render(<AprendizajesView />);
    expect(screen.getByText('Sin acceso')).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('lista propuestas con casos y sin permiso aprobar no hay acciones', async () => {
    sesion(['aprendizajes/ver']);
    render(<AprendizajesView />);
    expect(await screen.findByText('¿Abren domingo?')).toBeTruthy();
    expect(screen.getByText('Cliente: hola, abren?')).toBeTruthy();
    expect(screen.queryByText('Editar y aprobar')).toBeNull();
    expect(screen.queryByText('Descartar')).toBeNull();
  });

  it('estado vacío amable', async () => {
    items = [];
    sesion(['aprendizajes/ver']);
    render(<AprendizajesView />);
    expect(await screen.findByText('Esta noche no hubo casos nuevos')).toBeTruthy();
  });

  it('error de carga se muestra tal cual', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(Object.assign(new Error('El bot no responde'), { codigo: 'X' }));
    sesion(['aprendizajes/ver']);
    render(<AprendizajesView />);
    expect(await screen.findByText('El bot no responde')).toBeTruthy();
  });

  it('editar y aprobar envía lo editado solo tras confirmar', async () => {
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    render(<AprendizajesView />);
    fireEvent.click(await screen.findByText('Editar y aprobar'));
    fireEvent.change(screen.getByLabelText('Respuesta del bot'), { target: { value: 'Sí, desde las 8.' } });
    fireEvent.change(screen.getByLabelText('Otras formas de preguntar lo mismo'), { target: { value: 'atienden domingo' } });
    fireEvent.click(screen.getByText('Agregar frase'));
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, aprobar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/aprendizajes/p1/aprobar', {
      pregunta: '¿Abren domingo?', respuesta: 'Sí, desde las 8.', frases: ['abren hoy', 'atienden domingo'],
    }));
  });

  it('Mejorar reemplaza la respuesta, suma frases sin duplicar y Deshacer la recupera', async () => {
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    post.mockResolvedValue({ respuesta: 'Sí, abrimos desde las 9. 🥰✨', frases: ['abren hoy', 'atienden domingo'] });
    render(<AprendizajesView />);
    fireEvent.click(await screen.findByText('Editar y aprobar'));
    fireEvent.click(screen.getByRole('button', { name: 'Mejorar la respuesta con IA' }));
    await waitFor(() => expect((screen.getByLabelText('Respuesta del bot') as HTMLTextAreaElement).value).toBe('Sí, abrimos desde las 9. 🥰✨'));
    expect(post).toHaveBeenCalledWith('/admin/aprendizajes/mejorar', { pregunta: '¿Abren domingo?', respuesta: 'Sí, desde las 9.', intencion: 'horario', tipo: 'FAQ' });
    const chips = within(screen.getByRole('list', { name: 'Frases' }));
    expect(chips.getAllByText(/abren hoy/)).toHaveLength(1);
    expect(chips.getByText(/atienden domingo/)).toBeTruthy();
    fireEvent.click(screen.getByText('Deshacer'));
    expect((screen.getByLabelText('Respuesta del bot') as HTMLTextAreaElement).value).toBe('Sí, desde las 9.');
    expect(screen.queryByText('Deshacer')).toBeNull();
  });

  it('si Mejorar falla muestra el error y no toca la respuesta', async () => {
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    post.mockRejectedValue(new Error('La IA no está configurada'));
    render(<AprendizajesView />);
    fireEvent.click(await screen.findByText('Editar y aprobar'));
    fireEvent.click(screen.getByRole('button', { name: 'Mejorar la respuesta con IA' }));
    expect((await screen.findByRole('alert')).textContent).toBe('La IA no está configurada');
    expect((screen.getByLabelText('Respuesta del bot') as HTMLTextAreaElement).value).toBe('Sí, desde las 9.');
  });

  it('descartar exige motivo de 5 letras y confirmación', async () => {
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    render(<AprendizajesView />);
    fireEvent.click(await screen.findByText('Descartar'));
    const si = screen.getByText('Sí, descartar') as HTMLButtonElement;
    expect(si.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'no sirve' } });
    expect(si.disabled).toBe(false);
    fireEvent.click(si);
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/aprendizajes/p1/descartar', { motivo: 'no sirve' }));
  });

  it('retirar conocimiento pide motivo y confirma', async () => {
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    render(<AprendizajesView />);
    fireEvent.click(screen.getByRole('tab', { name: /Lo que sabe el bot/ }));
    expect(await screen.findByText('¿Hasta qué hora?')).toBeTruthy();
    expect(screen.getByText(/precios, stock y horarios siempre salen del sistema/)).toBeTruthy();
    fireEvent.click(screen.getByText('Retirar'));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'ya cambió' } });
    fireEvent.click(screen.getByText('Sí, retirar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/aprendizajes/conocimiento/k1/retirar', { motivo: 'ya cambió' }));
  });

  it('noches: estado TOPE con color y ejecutar solo con aprobar', async () => {
    sesion(['aprendizajes/ver']);
    const { unmount } = render(<AprendizajesView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Noches' }));
    const estado = await screen.findByText('Se llegó al tope de gasto');
    expect(estado.className).toContain('ap-estado--tope');
    expect(screen.queryByText('Analizar ayer ahora')).toBeNull();
    unmount();

    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    render(<AprendizajesView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Noches' }));
    fireEvent.click(await screen.findByText('Analizar ayer ahora'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, analizar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/aprendizajes/ejecutar-ahora'));
    expect(within(document.body).queryByText('¿Analizar ayer ahora?')).toBeNull();
  });

  it('historial: muestra avance y lanza el análisis completo tras confirmar', async () => {
    vi.spyOn(api, 'get').mockImplementation(async (url: string) => {
      if (url.includes('/resumen')) return resumen({ historico: { estado: 'NUNCA', diasProcesados: 0, diasTotales: 0, usd: 0 } });
      return { items: [], total: 0 };
    });
    sesion(['aprendizajes/ver', 'aprendizajes/aprobar']);
    render(<AprendizajesView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Noches' }));
    expect((await screen.findByTestId('historico')).textContent).toContain('Todavía no se analizó el historial');
    fireEvent.click(screen.getByText('Analizar todo el historial'));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, analizar'));
    await waitFor(() => expect(post).toHaveBeenCalledWith('/admin/aprendizajes/ejecutar-historico'));
  });
});
