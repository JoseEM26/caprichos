import { useEffect, useState } from 'react';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { comprobantesApi } from './comprobantesApi';
import type { ConfigFacturaWhatsapp } from './tipos';

const ALTO_TOQUE = '44px';
const PLANTILLA_SUGERIDA = 'caprichos_factura_electronica';

/** Interruptor Sí/No y nombre de la plantilla de Meta del envío de facturas por WhatsApp (solo ADMIN, con confirmación). */
export function FacturaWhatsappConfig() {
  const [config, setConfig] = useState<ConfigFacturaWhatsapp | null>(null);
  const [propuesta, setPropuesta] = useState<boolean | null>(null);
  const [plantilla, setPlantilla] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    comprobantesApi
      .obtenerFacturaWhatsapp()
      .then((c) => {
        setConfig(c);
        setPlantilla(c.plantilla ?? '');
      })
      .catch(() => setConfig(null));
  }, []);

  if (!config) return null;

  const guardar = async (activo: boolean, nombre: string) => {
    setGuardando(true);
    setError(null);
    setAviso(null);
    try {
      const r = await comprobantesApi.guardarFacturaWhatsapp({ activo, plantilla: nombre.trim() });
      setConfig(r);
      setPlantilla(r.plantilla ?? '');
      setAviso('Factura por WhatsApp guardado');
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
      setPropuesta(null);
    }
  };

  const boton = (activo: boolean, texto: string) => {
    const marcado = config.activo === activo;
    return (
      <button
        type="button"
        aria-pressed={marcado}
        onClick={() => !marcado && setPropuesta(activo)}
        style={{ minHeight: ALTO_TOQUE, minWidth: 96, borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: marcado ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)', background: marcado ? 'var(--cp-navy)' : 'var(--cp-white)', color: marcado ? 'var(--cp-cream)' : 'var(--cp-navy)' }}
      >
        {texto}
      </button>
    );
  };

  return (
    <section aria-label="Factura por WhatsApp" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Factura por WhatsApp</div>
      <p style={{ margin: 0, fontSize: 13 }}>
        Cuando SUNAT acepta una factura, el bot manda su PDF al celular del pedido (su WhatsApp). Sin celular válido no se envía nada.
        Fuera de las 24 horas de WhatsApp solo sale con una plantilla aprobada en Meta; sin ella queda «Sin ventana de WhatsApp».
      </p>
      <div role="group" aria-label="Enviar la factura por WhatsApp" style={{ display: 'flex', gap: 8 }}>
        {boton(true, 'Sí')}
        {boton(false, 'No')}
      </div>
      <label style={{ fontWeight: 700, fontSize: 13 }}>
        Plantilla de Meta (con encabezado de documento)
        <input
          type="text"
          value={plantilla}
          placeholder={PLANTILLA_SUGERIDA}
          onChange={(e) => setPlantilla(e.target.value)}
          style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }}
        />
      </label>
      <div>
        <Boton variante="secundario" cargando={guardando} onClick={() => void guardar(config.activo, plantilla)} style={{ minHeight: ALTO_TOQUE }}>
          Guardar plantilla
        </Boton>
      </div>
      {aviso && <div role="status">{aviso}</div>}
      {error && <div role="alert" style={{ color: 'var(--cp-red, #b00020)' }}>{error}</div>}
      <Confirmar
        abierto={propuesta !== null}
        titulo="Factura por WhatsApp"
        mensaje={propuesta ? 'El bot mandará cada factura nueva aceptada por SUNAT al WhatsApp del cliente. ¿Encenderlo?' : 'No se enviará ninguna factura por WhatsApp (ni con Reenviar). ¿Apagarlo?'}
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardando}
        alConfirmar={() => void guardar(propuesta === true, plantilla)}
        alCancelar={() => setPropuesta(null)}
      />
    </section>
  );
}
