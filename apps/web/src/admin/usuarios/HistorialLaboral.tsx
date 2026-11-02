import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Confirmar } from '../../comun/Confirmar';

export interface PeriodoLaboralApi {
  id: string;
  desde: string;
  hasta: string | null;
  abierto: boolean;
  duracion: string;
}

export interface HistorialLaboralApi {
  activo: boolean;
  enLicencia: boolean;
  periodos: PeriodoLaboralApi[];
  tiempoTotal: string;
  vecesSalio: number;
}

/** AAAA-MM-DD a DD/MM/AAAA. */
export function fechaCorta(iso: string): string {
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

/** «Ingresó 02/07/2024 · Salió 15/03/2025 · 8 meses 13 días» o «Reingresó 20/06/2025 · Sigue · 1 año 4 meses». */
export function lineaPeriodo(p: PeriodoLaboralApi, indice: number): string {
  const inicio = `${indice === 0 ? 'Ingresó' : 'Reingresó'} ${fechaCorta(p.desde)}`;
  const salida = p.hasta ? `Salió ${fechaCorta(p.hasta)}` : 'Sigue';
  return `${inicio} · ${salida} · ${p.duracion}`;
}

export interface HistorialLaboralProps {
  usuarioId: string;
  esAdmin: boolean;
  deshabilitado?: boolean;
}

/** Historial laboral: periodos trabajados, tiempo total y salidas. El ADMIN corrige las fechas de un periodo. */
export function HistorialLaboral({ usuarioId, esAdmin, deshabilitado = false }: HistorialLaboralProps) {
  const [datos, setDatos] = useState<HistorialLaboralApi | null>(null);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState<{ id: string; desde: string; hasta: string } | null>(null);
  const [pendiente, setPendiente] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<HistorialLaboralApi>(`/admin/usuarios/${usuarioId}/periodos`);
      setDatos(r && Array.isArray(r.periodos) ? r : null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar el historial laboral.');
    }
  }, [usuarioId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function guardar() {
    if (!editando) return;
    setPendiente(false);
    setGuardando(true);
    setError('');
    try {
      const r = await api.patch<HistorialLaboralApi>(`/admin/usuarios/${usuarioId}/periodos/${editando.id}`, {
        desde: editando.desde,
        hasta: editando.hasta || null,
      });
      setDatos(r);
      setEditando(null);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudieron guardar las fechas.');
    } finally {
      setGuardando(false);
    }
  }

  if (!datos) return error ? <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px' }}>{error}</div> : null;

  return (
    <section aria-label="Historial laboral" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <strong style={{ color: 'var(--cp-navy)' }}>Historial laboral</strong>
      <div style={{ fontSize: '13px' }}>
        <div>Tiempo total trabajado: {datos.tiempoTotal}</div>
        <div>Veces que salió: {datos.vecesSalio}</div>
        {datos.enLicencia && <div style={{ fontWeight: 700, color: 'var(--cp-orange)' }}>En licencia</div>}
      </div>
      {datos.periodos.length === 0 && <div style={{ fontSize: '13px', color: 'var(--cp-soft)' }}>Sin periodos registrados.</div>}
      <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        {datos.periodos.map((p, i) => (
          <li key={p.id}>
            {lineaPeriodo(p, i)}
            {esAdmin && !deshabilitado && (
              <Boton
                type="button"
                variante="texto"
                tamano="pequeno"
                aria-label={`Corregir periodo ${fechaCorta(p.desde)}`}
                onClick={() => setEditando({ id: p.id, desde: p.desde, hasta: p.hasta ?? '' })}
              >
                Corregir
              </Boton>
            )}
            {editando?.id === p.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                <Campo
                  id={`hist-desde-${p.id}`}
                  etiqueta="Fecha de ingreso del periodo"
                  type="date"
                  value={editando.desde}
                  onChange={(e) => setEditando({ ...editando, desde: e.target.value })}
                />
                <Campo
                  id={`hist-hasta-${p.id}`}
                  etiqueta="Fecha de salida (vacío = sigue)"
                  type="date"
                  value={editando.hasta}
                  onChange={(e) => setEditando({ ...editando, hasta: e.target.value })}
                />
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Boton type="button" variante="primario" tamano="pequeno" disabled={guardando} onClick={() => setPendiente(true)}>
                    Guardar fechas
                  </Boton>
                  <Boton type="button" variante="secundario" tamano="pequeno" onClick={() => setEditando(null)}>
                    Cancelar
                  </Boton>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
      {error && <div role="alert" style={{ color: 'var(--cp-rust)', fontSize: '13px', fontWeight: 700 }}>{error}</div>}
      <Confirmar
        abierto={pendiente}
        titulo="Guardar fechas del periodo"
        mensaje="¿Guardar estas fechas del historial laboral? Los periodos no pueden cruzarse."
        textoSi="Sí, guardar"
        textoNo="No"
        alConfirmar={guardar}
        alCancelar={() => setPendiente(false)}
      />
    </section>
  );
}
