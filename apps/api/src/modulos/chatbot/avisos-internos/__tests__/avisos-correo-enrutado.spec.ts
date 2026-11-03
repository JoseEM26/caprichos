jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosInternosService } from '../avisos-internos.service';

/** Con el flag de WhatsApp APAGADO, los avisos marcados para correo igual salen por correo. */
describe('Avisos al equipo: enrutado a correo con el WhatsApp apagado', () => {
  let servicio: AvisosInternosService;
  let correo: { avisar: jest.Mock };
  let prisma: any;

  beforeEach(() => {
    correo = { avisar: jest.fn().mockResolvedValue(null) };
    prisma = { notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) } };
    const configuracion = { obtener: jest.fn().mockResolvedValue('false') };
    const outbox = { encolar: jest.fn(), despertar: jest.fn() };
    const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    servicio = new AvisosInternosService(
      prisma,
      { get: jest.fn() } as any,
      { obtenerCliente: jest.fn().mockReturnValue(null) } as any,
      configuracion as any,
      auditoria as any,
      {} as any,
      {} as any,
      outbox as any,
      undefined,
      correo as any,
    );
  });

  it('enviarAvisoAdmin con correo: manda por correo aunque el flag de WhatsApp esté apagado', async () => {
    const r = await servicio.enviarAvisoAdmin('Falla de Impresora: Trabajo #7', 'Papel atascado', '/admin/configuracion', undefined, 'impresora:7', {
      correo: true,
    });
    expect(correo.avisar).toHaveBeenCalledWith(
      expect.objectContaining({ clave: 'impresora:7', asunto: 'Falla de Impresora: Trabajo #7' }),
    );
    expect(r.motivo).toBe('DESACTIVADO');
  });

  it('enviarAvisoAdmin sin correo: no toca el correo', async () => {
    await servicio.enviarAvisoAdmin('Chat esperando asesor', 'detalle', '/admin/mensajes', undefined, 'chat:1');
    expect(correo.avisar).not.toHaveBeenCalled();
  });

  it('notificarAlmacen (stock agotado o por pedir) va por correo con clave diaria', async () => {
    await servicio.notificarAlmacen({
      insumoId: 12n,
      nombreInsumo: 'Queso Cheddar',
      tipoAlerta: 'POR_PEDIR',
      stockActual: 2,
      stockMinimo: 5,
      unidadMedida: 'KG',
    });
    const hoy = new Date().toISOString().slice(0, 10);
    expect(correo.avisar).toHaveBeenCalledWith(
      expect.objectContaining({
        clave: `almacen:Queso Cheddar:POR_PEDIR:${hoy}`,
        origen: 'ALMACEN',
        texto: expect.stringContaining('2.00 KG'),
      }),
    );
  });

  it('avisarCalificacionBaja manda por correo, una vez por encuesta', async () => {
    await servicio.avisarCalificacionBaja({
      encuestaId: 9n,
      codigo: 'CP-1',
      cliente: 'Ana',
      puntaje: 2,
      telefono: null,
    });
    expect(correo.avisar).toHaveBeenCalledWith(expect.objectContaining({ clave: 'calificacion-baja-9', origen: 'ALERTA_ADMIN' }));
  });
});
