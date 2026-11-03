import { ComprobantesCertificadoAvisoService, avisoCertificado } from './comprobantes-certificado-aviso.service';
import { VENCIMIENTO_CERTIFICADO_AVISO } from './sunat/sunat.config';

const DIA = 86_400_000;
const VENCE = new Date('2027-10-07T12:00:00Z');
const ANTES_DE = (dias: number) => new Date(VENCE.getTime() - dias * DIA);

describe('avisoCertificado', () => {
  it('avisa a 60 días o menos, no a más de 60', () => {
    expect(avisoCertificado(VENCE, ANTES_DE(61))).toBeNull();
    expect(avisoCertificado(VENCE, ANTES_DE(60))).not.toBeNull();
    expect(avisoCertificado(VENCE, ANTES_DE(1))).not.toBeNull();
  });

  it('el asunto lleva la fecha DD/MM/AAAA y la clave identifica fecha y umbral', () => {
    const a = avisoCertificado(VENCE, ANTES_DE(60))!;
    expect(a.asunto).toBe('Renovar el certificado digital de SUNAT (vence el 07/10/2027)');
    expect(a.clave).toBe('cert-sunat-venc:2027-10-07:60d');
    expect(a.texto).toContain('SUNAT_CERT_P12_B64');
    expect(a.texto).toContain('configurar-sunat');
  });

  it('vencido también avisa y lo dice', () => {
    const a = avisoCertificado(VENCE, new Date(VENCE.getTime() + 3 * DIA));
    expect(a).not.toBeNull();
    expect(a!.texto).toContain('Ya venció hace 3 días');
  });
});

describe('ComprobantesCertificadoAvisoService', () => {
  /** Simula la clave única de correo_envio: un mismo caso no se manda dos veces al mismo destinatario. */
  function nuevo(vence: Date | null) {
    const enviados = new Set<string>();
    const correo = {
      avisarAdministradores: jest.fn(async (aviso: { clave: string }) => {
        if (enviados.has(aviso.clave)) return { enviados: 0, simulados: 0, fallidos: 0, omitidos: 1 };
        enviados.add(aviso.clave);
        return { enviados: 1, simulados: 0, fallidos: 0, omitidos: 0 };
      }),
    };
    const sunat = { certificadoVence: jest.fn(() => vence) };
    const servicio = new ComprobantesCertificadoAvisoService(sunat as any, correo as any);
    return { servicio, correo };
  }

  it('no envía si faltan más de 60 días', async () => {
    const { servicio, correo } = nuevo(VENCE);
    await servicio.ejecutar(ANTES_DE(90));
    expect(correo.avisarAdministradores).not.toHaveBeenCalled();
  });

  it('no duplica: revisar cada día con la misma fecha envía una sola vez', async () => {
    const { servicio, correo } = nuevo(VENCE);
    await servicio.ejecutar(ANTES_DE(60));
    await servicio.ejecutar(ANTES_DE(59));
    await servicio.ejecutar(ANTES_DE(10));
    expect(correo.avisarAdministradores).toHaveBeenCalledTimes(3);
    const claves = correo.avisarAdministradores.mock.calls.map((c: any[]) => c[0].clave);
    expect(new Set(claves).size).toBe(1);
  });

  it('si el certificado se renueva (nueva fecha) el aviso vuelve a aplicar', async () => {
    let vence: Date | null = VENCE;
    const { servicio, correo } = nuevo(null);
    (servicio as any).sunat.certificadoVence = () => vence;
    await servicio.ejecutar(ANTES_DE(60));
    vence = new Date('2028-10-07T12:00:00Z');
    const r = await servicio.ejecutar(new Date('2028-08-08T12:00:00Z'));
    expect(r?.enviados).toBe(1);
    expect(correo.avisarAdministradores).toHaveBeenCalledTimes(2);
  });

  it('certificado ilegible usa la constante VENCIMIENTO_CERTIFICADO_AVISO', async () => {
    const { servicio, correo } = nuevo(null);
    const dias60 = new Date(`${VENCIMIENTO_CERTIFICADO_AVISO}T12:00:00Z`).getTime() - 60 * DIA;
    await servicio.ejecutar(new Date(dias60 - 5 * DIA));
    expect(correo.avisarAdministradores).not.toHaveBeenCalled();
    await servicio.ejecutar(new Date(dias60));
    expect(correo.avisarAdministradores).toHaveBeenCalledTimes(1);
    expect(correo.avisarAdministradores.mock.calls[0][0].clave).toBe('cert-sunat-venc:2027-10-07:60d');
  });

  it('certificado vencido sí envía', async () => {
    const { servicio, correo } = nuevo(VENCE);
    await servicio.ejecutar(new Date(VENCE.getTime() + 2 * DIA));
    expect(correo.avisarAdministradores).toHaveBeenCalledTimes(1);
  });
});
