import { useCallback, useEffect, useState } from 'react';
import {
  INSIGNIAS_SUGERIDAS,
  INSIGNIA_MAX,
  MEDIOS_PRESENTACION,
  NOMBRE_MEDIO_PRESENTACION,
  normalizarPresentacionMedios,
  presentacionPorDefecto,
  sanearInsignia,
  type MedioPresentacion,
  type PresentacionMedios,
  type TamanoMedio,
} from '@caprichos/compartido';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { ElegirEnTarjetas } from '../../carta/ElegirEnTarjetas';
import { opcionesMedioPago } from '../../carta/MediosPago';
import type { MetodoPago } from '../../carta/tipos';
import { useSesionSegura } from './TarjetaMediosPagoCanal';

/** Orden 1..n sin huecos según el orden actual (así «sin guardar» compara lo mismo que lo guardado). */
function compactar(p: PresentacionMedios): PresentacionMedios {
  const n = normalizarPresentacionMedios(p);
  const lista = [...MEDIOS_PRESENTACION].sort((a, b) => n[a].orden - n[b].orden || MEDIOS_PRESENTACION.indexOf(a) - MEDIOS_PRESENTACION.indexOf(b));
  lista.forEach((m, i) => (n[m] = { ...n[m], orden: i + 1 }));
  return n;
}
const ordenados = (p: PresentacionMedios) => [...MEDIOS_PRESENTACION].sort((a, b) => p[a].orden - p[b].orden);
const firma = (p: PresentacionMedios) => JSON.stringify(compactar(p));
const esSugerida = (t: string | null) => t === null || (INSIGNIAS_SUGERIDAS as readonly string[]).includes(t);

const selectEstilo = { minHeight: 44, padding: '0 8px', borderRadius: 10, border: '1.5px solid var(--cp-line)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontSize: 13 } as const;
const flechaEstilo = { minWidth: 44, minHeight: 44, borderRadius: 10, border: '1.5px solid var(--cp-navy)', background: 'var(--cp-white)', color: 'var(--cp-navy)', fontWeight: 800, fontSize: 16, cursor: 'pointer' } as const;

/**
 * Cómo se muestran los medios de pago (parámetro medios_pago_presentacion): orden, tamaño e insignia por medio,
 * para la carta, Caja y mozo. Vista previa en vivo de la grilla de la carta. Solo ADMIN guarda.
 */
export function TarjetaPresentacionMediosPago({ esAdmin: esAdminProp }: { esAdmin?: boolean } = {}) {
  const sesion = useSesionSegura();
  const esAdmin = esAdminProp !== undefined ? esAdminProp : (sesion?.usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [guardado, setGuardado] = useState<PresentacionMedios>(presentacionPorDefecto());
  const [config, setConfig] = useState<PresentacionMedios>(presentacionPorDefecto());
  // Medios donde se eligió «Otro…» (texto libre), aunque el texto aún esté vacío
  const [otro, setOtro] = useState<Partial<Record<MedioPresentacion, boolean>>>({});
  const [cargando, setCargando] = useState(true);
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await api.get<{ presentacion?: unknown }>('/admin/medios-pago');
      const n = compactar(normalizarPresentacionMedios(r?.presentacion));
      setGuardado(n);
      setConfig(n);
      setOtro({});
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo leer cómo se muestran los medios de pago');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El texto libre se compara ya saneado: «Nuevo » y «Nuevo» son lo mismo
  const limpio = (p: PresentacionMedios): PresentacionMedios => {
    const c = { ...p };
    for (const m of MEDIOS_PRESENTACION) c[m] = { ...c[m], insignia: sanearInsignia(c[m].insignia) };
    return c;
  };
  const hayCambios = firma(limpio(config)) !== firma(guardado);
  const lista = ordenados(compactar(config));

  const cambiar = (m: MedioPresentacion, parte: Partial<PresentacionMedios[MedioPresentacion]>) => {
    setExito(null);
    setConfig({ ...config, [m]: { ...config[m], ...parte } });
  };
  const mover = (m: MedioPresentacion, delta: -1 | 1) => {
    const c = compactar(config);
    const o = ordenados(c);
    const i = o.indexOf(m);
    const j = i + delta;
    if (j < 0 || j >= o.length) return;
    setExito(null);
    const otroMedio = o[j];
    setConfig({ ...c, [m]: { ...c[m], orden: c[otroMedio].orden }, [otroMedio]: { ...c[otroMedio], orden: c[m].orden } });
  };
  const restablecer = () => {
    setExito(null);
    setOtro({});
    setConfig(presentacionPorDefecto());
  };
  const elegirInsignia = (m: MedioPresentacion, v: string) => {
    if (v === '__otro') {
      setOtro({ ...otro, [m]: true });
      cambiar(m, { insignia: esSugerida(config[m].insignia) ? '' : config[m].insignia });
    } else {
      setOtro({ ...otro, [m]: false });
      cambiar(m, { insignia: v || null });
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setError(null);
    try {
      await api.put('/admin/configuracion/medios_pago_presentacion', { valor: compactar(limpio(config)) });
      setConfirmar(false);
      setExito('Listo: así se mostrarán los medios de pago.');
      await cargar();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo guardar');
      setConfirmar(false);
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <Cargando mensaje="Cargando cómo se muestran los medios de pago..." />;

  return (
    <div
      data-cfg-id="pagos-presentacion"
      tabIndex={-1}
      data-testid="tarjeta-presentacion-medios"
      style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 16px', background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16 }}
    >
      <div>
        <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: 'var(--cp-navy)' }}>Cómo se muestran los medios de pago</div>
        <div style={{ fontSize: 12.5, color: 'var(--cp-soft)', marginTop: 2, maxWidth: 560 }}>
          Elige el orden, el tamaño y la insignia de cada medio. Se ve igual en la carta, en Caja y en mozo.
        </div>
      </div>

      <details style={{ fontSize: 12.5, color: 'var(--cp-soft)' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, color: 'var(--cp-navy)', minHeight: 24 }}>Ayuda</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <li>Sube o baja un medio con las flechas: el de arriba sale primero.</li>
          <li>Grande: en la carta ocupa todo el ancho de la fila; en Caja y mozo solo se resalta. Normal: tarjeta cuadrada.</li>
          <li>La insignia es una etiqueta corta (hasta {INSIGNIA_MAX} letras), por ejemplo «Nuevo».</li>
          <li>Qué medios están encendidos se decide en «Medios de pago por canal». «Tarjeta / Yape en línea» solo sale en la carta y si el pago en línea está activo.</li>
        </ul>
      </details>

      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((m, i) => {
          const nombre = NOMBRE_MEDIO_PRESENTACION[m];
          const p = config[m];
          const modoOtro = otro[m] || !esSugerida(p.insignia);
          return (
            <li key={m} data-testid={`fila-medio-${m}`} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingTop: 8, borderTop: i ? '1px solid var(--cp-line)' : 'none' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" aria-label={`Subir ${nombre}`} disabled={!esAdmin || guardando || i === 0} onClick={() => mover(m, -1)} style={flechaEstilo}>↑</button>
                <button type="button" aria-label={`Bajar ${nombre}`} disabled={!esAdmin || guardando || i === lista.length - 1} onClick={() => mover(m, 1)} style={flechaEstilo}>↓</button>
              </div>
              <span style={{ flex: '1 1 120px', minWidth: 100, fontWeight: 700, color: 'var(--cp-navy)', fontSize: 14 }}>{i + 1}. {nombre}</span>
              <select
                aria-label={`Tamaño de ${nombre}`}
                value={p.tamano}
                disabled={!esAdmin || guardando}
                onChange={(e) => cambiar(m, { tamano: e.target.value as TamanoMedio })}
                style={selectEstilo}
              >
                <option value="normal">Normal</option>
                <option value="grande">Grande</option>
              </select>
              <select
                aria-label={`Insignia de ${nombre}`}
                value={modoOtro ? '__otro' : p.insignia ?? ''}
                disabled={!esAdmin || guardando}
                onChange={(e) => elegirInsignia(m, e.target.value)}
                style={selectEstilo}
              >
                <option value="">Ninguna</option>
                {INSIGNIAS_SUGERIDAS.map((t) => <option key={t} value={t}>{t}</option>)}
                <option value="__otro">Otro texto…</option>
              </select>
              {modoOtro && (
                <input
                  aria-label={`Texto de la insignia de ${nombre}`}
                  value={p.insignia ?? ''}
                  maxLength={INSIGNIA_MAX}
                  disabled={!esAdmin || guardando}
                  onChange={(e) => cambiar(m, { insignia: e.target.value.replace(/[<>]/g, '') })}
                  style={{ ...selectEstilo, width: 130 }}
                />
              )}
            </li>
          );
        })}
      </ol>

      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cp-navy)', marginBottom: 6 }}>Vista previa en la carta (con datos de ejemplo)</div>
        <div
          {...({ inert: '' } as object)}
          aria-hidden="true"
          style={{ maxWidth: 380, padding: 10, borderRadius: 14, background: 'var(--cp-sand)', border: '1px dashed var(--cp-line)', pointerEvents: 'none' }}
        >
          <ElegirEnTarjetas titulo="Vista previa de ¿Cómo pagas?" testId="vista-previa-medios" opciones={opcionesMedioPago(MEDIOS_PRESENTACION as unknown as MetodoPago[], limpio(config))} alElegir={() => undefined} />
        </div>
      </div>

      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--cp-red, #b3261e)' }}>{error}</div>}
      {exito && <div role="status" style={{ fontSize: 13, color: 'var(--cp-navy)' }}>{exito}</div>}
      {hayCambios && !exito && <div role="status" style={{ fontSize: 12.5, color: 'var(--cp-rust)', fontWeight: 700 }}>Tienes cambios sin guardar.</div>}
      {esAdmin ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Boton variante="primario" onClick={() => setConfirmar(true)} disabled={!hayCambios || guardando}>Guardar presentación</Boton>
          <Boton variante="secundario" onClick={restablecer} disabled={guardando || firma(limpio(config)) === firma(presentacionPorDefecto())}>Restablecer valores</Boton>
        </div>
      ) : (
        <span style={{ fontSize: 11, color: 'var(--cp-soft)', fontStyle: 'italic' }}>Solo ADMIN</span>
      )}

      <Confirmar
        abierto={confirmar}
        titulo="Guardar presentación de los medios de pago"
        mensaje="Desde ahora la carta, Caja y mozo mostrarán los medios en este orden, con este tamaño e insignias. ¿Guardar?"
        textoSi="Sí, guardar"
        textoNo="No, cancelar"
        peligro={false}
        cargando={guardando}
        alConfirmar={guardar}
        alCancelar={() => setConfirmar(false)}
      />
    </div>
  );
}
