import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { ETIQUETA_TIPO_CAL, type FilaCal } from './calendarioApi';
import type { CronoDia, CronoMarca } from './correccionesApi';
import { DetalleMarca } from './CronogramaTab';
import { SelfieMarca } from './SelfieMarca';
import { normalizarTipo, type TipoMarcaElegido } from './tiposMarca';
import './tarjetas-marcas.css';

type Avisar = (m: string | null) => void;
const hh = (min: number) => (min ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : '—');

/** Ícono y color por tipo de marca (el texto siempre acompaña: el color solo no basta). */
const TIPO: Record<TipoMarcaElegido, { icono: string; color: string }> = {
  ENTRADA: { icono: '▶', color: 'verde' },
  ALMUERZO_SALIDA: { icono: '⏸', color: 'dorado' },
  ALMUERZO_VUELTA: { icono: '⏵', color: 'azul' },
  SALIDA: { icono: '■', color: 'rojo' },
};
const ESTADO: Record<string, { texto: string; variante: VarianteInsignia }> = {
  APROBADA: { texto: 'Aprobada', variante: 'exito' },
  VALIDA: { texto: 'Válida', variante: 'exito' },
  A_REVISAR: { texto: 'Por revisar', variante: 'acento' },
  ANULADA: { texto: 'Anulada', variante: 'peligro' },
};
const ORIGEN: Record<string, string> = { CELULAR: 'QR en el celular', WEB: 'Usuario y contraseña', CORRECCION: 'Corrección manual del admin', MANUAL: 'Manual (solo GPS)' };

/** Franja-resumen del día: usa los datos que ya calcula la fila del calendario (no recalcula nada). */
function Franja({ fila }: { fila: FilaCal }) {
  const almuerzo = fila.almuerzoSalida || fila.almuerzoVuelta ? `${fila.almuerzoSalida ?? '—'}–${fila.almuerzoVuelta ?? '—'}` : '—';
  const datos: Array<[string, string]> = [
    ['Entrada', fila.entrada ?? '—'], ['Salida', fila.salida ?? '—'], ['Trabajado', hh(fila.trabajadaMin)],
    ['Tardanza', fila.tardanzaMin ? `${fila.tardanzaMin} min` : '—'], ['Almuerzo', almuerzo],
  ];
  return (
    <dl className="tm-franja" aria-label="Resumen del día">
      {datos.map(([t, v]) => <div key={t}><dt>{t}</dt><dd>{v}</dd></div>)}
    </dl>
  );
}

/**
 * Pestaña «Marcas» del detalle de una persona: franja-resumen y una tarjeta por marca (ordenadas por hora) con la selfie
 * en miniatura. Las acciones (aprobar, anular, separar, reasignar) son las de siempre (DetalleMarca), dentro de «Acciones».
 */
export function TarjetasMarcas({ fila, dia, cargando, error, reintentar, onError, onOk, recargar }: {
  fila: FilaCal; dia: CronoDia | null; cargando: boolean; error: boolean; reintentar: () => void;
  onError: Avisar; onOk: Avisar; recargar: () => Promise<void>;
}) {
  const [abierta, setAbierta] = useState<number | null>(null);
  const marcas: CronoMarca[] = dia ? [...dia.marcas].sort((a, b) => a.minutos - b.minutos) : [];
  return (
    <div className="ca-detalle-sec">
      <Franja fila={fila} />
      {cargando ? <Cargando mensaje="Cargando marcas" /> : error || !dia ? (
        <div role="alert" className="tm-error">
          <p>No pudimos cargar las marcas de este día.</p>
          <Boton type="button" variante="secundario" onClick={reintentar}>Reintentar</Boton>
        </div>
      ) : marcas.length === 0 ? (
        <EstadoVacio titulo="Sin marcas este día" descripcion="Si falta una, agrégala abajo como corrección manual." />
      ) : (
        <ol className="tm-lista" aria-label="Marcas del día">
          {marcas.map((m) => {
            const tipo = normalizarTipo(m.rol);
            const t = tipo ? TIPO[tipo] : { icono: '?', color: 'gris' };
            const est = ESTADO[m.estado] ?? { texto: m.estado, variante: 'neutro' as VarianteInsignia };
            return (
              <li key={m.id} className={`tm-tarjeta tm-tarjeta--${t.color}${m.duplicada ? ' tm-tarjeta--dup' : ''}`} aria-label={`Marca de las ${m.hora}`}>
                <div className="tm-fila">
                  <SelfieMarca marcaId={m.id} hora={m.hora} tieneSelfie={m.tieneSelfie} />
                  <div className="tm-datos">
                    <b className="tm-hora">{m.hora}</b>
                    <span className="tm-tipo"><span aria-hidden className="tm-icono">{t.icono}</span> {tipo ? ETIQUETA_TIPO_CAL[tipo] : 'Marca sin tipo'}</span>
                    <span className="tm-insignias">
                      <Insignia variante={est.variante}>{est.texto}</Insignia>
                      {m.duplicada && <Insignia variante="aviso">Doble marca: no cuenta</Insignia>}
                    </span>
                    <small className="tm-origen">
                      {ORIGEN[m.origen ?? ''] ?? 'Origen desconocido'}
                      {m.distanciaM != null ? ` · GPS a ${m.distanciaM} m del local` : ''}
                    </small>
                  </div>
                  <Boton type="button" variante="secundario" tamano="pequeno" aria-expanded={abierta === m.id} aria-label={`Acciones de la marca de las ${m.hora}`} onClick={() => setAbierta(abierta === m.id ? null : m.id)}>
                    {abierta === m.id ? 'Ocultar' : 'Acciones'}
                  </Boton>
                </div>
                {abierta === m.id && <DetalleMarca marca={m} dia={dia} onError={onError} onOk={onOk} recargar={recargar} sinSelfie />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
