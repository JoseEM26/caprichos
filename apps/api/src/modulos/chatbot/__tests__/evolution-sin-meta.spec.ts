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
});
