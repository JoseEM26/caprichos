jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { WhatsAppEnrutadorAdaptador } from '../adaptadores/whatsapp-enrutador.adaptador';

const res = { exito: true, estado: 'ENVIADO' } as any;
const puerto = () => ({ enviarTexto: jest.fn(async () => res), enviarPlantilla: jest.fn(async () => res), estaConectado: jest.fn() }) as any;

describe('enrutador: el proveedor se decide al ENVIAR', () => {
  it('con Evolution elegido, ni plantilla ni texto tocan a Meta (aunque se encolaran con Meta)', async () => {
    const meta = puerto();
    const evo = puerto();
    const cfg: any = { proveedor: async () => 'EVOLUTION', proveedorEnCache: () => 'EVOLUTION' };
    const r = new WhatsAppEnrutadorAdaptador(meta, evo, cfg);
    await r.enviarPlantilla('51900000001', 'encuesta_pedido', 'es', ['Ana']);
    await r.enviarTexto('51900000001', 'hola');
    expect(meta.enviarPlantilla).not.toHaveBeenCalled();
    expect(meta.enviarTexto).not.toHaveBeenCalled();
    expect(evo.enviarPlantilla).toHaveBeenCalledTimes(1);
    expect(evo.enviarTexto).toHaveBeenCalledTimes(1);
  });
  it('con Meta elegido a mano sale por Meta', async () => {
    const meta = puerto();
    const evo = puerto();
    const r = new WhatsAppEnrutadorAdaptador(meta, evo, { proveedor: async () => 'META', proveedorEnCache: () => 'META' } as any);
    await r.enviarTexto('51900000001', 'hola');
    expect(meta.enviarTexto).toHaveBeenCalledTimes(1);
    expect(evo.enviarTexto).not.toHaveBeenCalled();
  });
  describe('respaldo de Meta (evolution_meta_respaldo, apagado por defecto)', () => {
    const caido = { exito: false, estado: 'FALLIDO', errorCodigo: 'EVOLUTION_NO_DISPONIBLE' } as any;
    const armar = (respaldo: string, resultadoEvo = caido) => {
      const meta = puerto();
      const evo = { ...puerto(), enviarPlantilla: jest.fn(async () => resultadoEvo), enviarTexto: jest.fn(async () => resultadoEvo) } as any;
      const cfg: any = { proveedor: async () => 'EVOLUTION', proveedorEnCache: () => 'EVOLUTION', obtener: async () => ({ whatsapp_proveedor: 'EVOLUTION', evolution_meta_respaldo: respaldo }) };
      return { meta, evo, r: new WhatsAppEnrutadorAdaptador(meta, evo, cfg) };
    };
    it('apagado: aunque Evolution esté caído, no se llama a Meta (ni plantilla ni texto)', async () => {
      const { meta, evo, r } = armar('no');
      expect((await r.enviarPlantilla('51900000001', 'encuesta_pedido', 'es', ['Ana'])).exito).toBe(false);
      await r.enviarTexto('51900000001', 'hola');
      expect(evo.enviarPlantilla).toHaveBeenCalledTimes(1);
      expect(meta.enviarPlantilla).not.toHaveBeenCalled();
      expect(meta.enviarTexto).not.toHaveBeenCalled();
    });
    it('encendido: Meta solo recoge lo que Evolution no pudo entregar por estar caído', async () => {
      const { meta, r } = armar('si');
      await r.enviarTexto('51900000001', 'hola');
      expect(meta.enviarTexto).toHaveBeenCalledTimes(1);
    });
    it('encendido, pero un rechazo del destinatario (no es caída) no pasa a Meta', async () => {
      const { meta, r } = armar('si', { exito: false, estado: 'FALLIDO', errorCodigo: 'ERROR_EVOLUTION' } as any);
      await r.enviarTexto('51900000001', 'hola');
      expect(meta.enviarTexto).not.toHaveBeenCalled();
    });
  });
});
