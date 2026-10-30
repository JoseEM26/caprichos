import { useState, useEffect, useCallback } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';

export interface ConsumoWhatsapp {
  mes: string;
  servicio: number;
  plantillas: number;
  plantillasPorTipo?: Record<string, number>;
  gratisMes: number;
  avisoPct: number;
  porcentaje: number;
  proyeccionFinDeMes: number;
}

const RUTA = '/admin/chatbot/configuracion/consumo-whatsapp';
const n = (v: number) => v.toLocaleString('es-PE');

export function TarjetaConsumoWhatsapp({ esAdmin = false }: { esAdmin?: boolean }) {
  const [c, setC] = useState<ConsumoWhatsapp | null>(null);
  const [tope, setTope] = useState('1000');
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const aplicar = (r: ConsumoWhatsapp) => {
    setC(r);
    setTope(String(r.gratisMes));
  };

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<ConsumoWhatsapp>(RUTA);
      if (typeof r?.servicio === 'number' && typeof r?.gratisMes === 'number') aplicar(r);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el consumo de WhatsApp.');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const topeNum = Number(tope);
  const valido = Number.isInteger(topeNum) && topeNum >= 1 && topeNum <= 10_000_000;

  const guardar = async () => {
    setGuardando(true);
    try {
      aplicar(await api.put<ConsumoWhatsapp>(RUTA, { gratisMes: topeNum }));
      setError(null);
      setExito('Guardado');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar el tope.');
    } finally {
      setConfirmar(false);
      setGuardando(false);
    }
  };

  const pct = c ? Math.min(100, c.porcentaje) : 0;
  const color = !c ? 'var(--cp-green)' : c.porcentaje >= 100 ? 'var(--cp-rust)' : c.porcentaje >= c.avisoPct ? 'var(--cp-gold)' : 'var(--cp-green)';

  return (
    <div
      data-testid="tarjeta-consumo-whatsapp"
      style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <h3 style={{ margin: 0, fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 15, color: 'var(--cp-navy)' }}>
        Mensajes de WhatsApp este mes{c ? ` (${c.mes})` : ''}
      </h3>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: 12, fontWeight: 700 }}>{error}</div>}
      {c && (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--cp-navy)' }}>
            {n(c.servicio)} de {n(c.gratisMes)} gratis ({c.porcentaje}%)
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            style={{ height: 10, borderRadius: 6, background: 'var(--cp-cream)', border: '1px solid var(--cp-line)', overflow: 'hidden' }}
          >
            <div style={{ width: `${pct}%`, height: '100%', background: color }} />
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--cp-soft)' }}>
            <span>De servicio (dentro de 24 h): <b>{n(c.servicio)}</b></span>
            <span>Plantillas: <b>{n(c.plantillas)}</b></span>
            <span>Proyección a fin de mes: <b>{n(c.proyeccionFinDeMes)}</b></span>
          </div>
          {Object.keys(c.plantillasPorTipo ?? {}).length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--cp-soft)' }}>
              {Object.entries(c.plantillasPorTipo!).map(([k, v]) => `${k}: ${n(v)}`).join(' · ')}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <label htmlFor="wa-gratis-mes" style={{ fontSize: 12, fontWeight: 700 }}>Mensajes gratis al mes</label>
            <input
              id="wa-gratis-mes"
              type="number"
              min={1}
              value={tope}
              disabled={!esAdmin || guardando}
              onChange={(e) => { setExito(null); setTope(e.target.value); }}
              style={{ width: 110, minHeight: 44, padding: '0 8px', borderRadius: 8, border: '1.5px solid var(--cp-line)', fontWeight: 700, textAlign: 'center' }}
            />
            {esAdmin && (
              <Boton variante="primario" disabled={guardando || !valido || topeNum === c.gratisMes} onClick={() => setConfirmar(true)}>
                Guardar tope
              </Boton>
            )}
            {exito && <span role="status" style={{ fontSize: 12, fontWeight: 700, color: 'var(--cp-green)' }}>{exito}</span>}
          </div>
        </>
      )}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--cp-soft)' }}>
        Desde el 1 de octubre de 2026 Meta cobra cada mensaje de servicio pasados los {c ? n(c.gratisMes) : '1,000'} gratis al mes por número,
        y las plantillas se cobran siempre. Se avisa a los administradores al llegar al {c?.avisoPct ?? 80}% y al 100%.
      </p>
      <Confirmar
        abierto={confirmar}
        titulo="¿Cambiar el tope de mensajes gratis?"
        mensaje={`El aviso se calculará sobre ${valido ? n(topeNum) : tope} mensajes gratis al mes.`}
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
