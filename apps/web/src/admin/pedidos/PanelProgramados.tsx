import { useCallback, useEffect, useState } from 'react';
import { pedidosApi, type PedidoProgramado } from './pedidosApi';
import { errorParaCuando, programadoParaIso, textoProgramado, type ParaCuando } from '../salon/componentes/paraCuando';

export interface PanelProgramadosProps {
  /** Permiso de cambiar pedidos (pedidos/cambiar_estado): sin él no hay botón «Pasar a cocina ahora». */
  puedePasar: boolean;
  alActualizar: () => void;
}

const soles = (n: number) => `S/ ${n.toFixed(2)}`;

/**
 * Lista «Programados»: pedidos para otro día que aún no entran a cocina ni a reparto. Pasan solos a su hora de aviso;
 * aquí se ve lo adelantado y el saldo, y se pueden pasar a cocina antes de tiempo.
 */
export function PanelProgramados({ puedePasar, alActualizar }: PanelProgramadosProps) {
  const [lista, setLista] = useState<PedidoProgramado[] | null>(null);
  const [error, setError] = useState('');
  // Acción abierta en una fila: reprogramar, anular (con adelanto: se devuelve o se reprograma) o recibir un adelanto
  const [abierta, setAbierta] = useState<{ id: string; tipo: 'reprogramar' | 'anular' | 'adelanto' } | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [motivo, setMotivo] = useState('');
  const [monto, setMonto] = useState('');
  const [medio, setMedio] = useState<'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA'>('EFECTIVO');

  const cargar = useCallback(async () => {
    try {
      setLista(await pedidosApi.listarProgramados());
      setError('');
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los pedidos programados');
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pasarAhora = async (p: PedidoProgramado) => {
    try {
      await pedidosApi.cambiarEstado(p.id, 'COLA');
      await cargar();
      alActualizar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo pasar el pedido a cocina');
    }
  };

  const abrir = (id: string, tipo: 'reprogramar' | 'anular' | 'adelanto') => {
    setAbierta(abierta?.id === id && abierta.tipo === tipo ? null : { id, tipo });
    setError('');
  };
  const ejecutar = async (accion: () => Promise<unknown>) => {
    try {
      await accion();
      setAbierta(null);
      setMotivo('');
      setMonto('');
      await cargar();
      alActualizar();
    } catch (e: any) {
      setError(e?.message || 'No se pudo completar la acción');
    }
  };
  const reprogramar = (p: PedidoProgramado) => {
    const v: ParaCuando = { modo: 'OTRA', fecha: nuevaFecha, hora: nuevaHora };
    const err = errorParaCuando(v);
    if (err) return setError(err);
    void ejecutar(() => pedidosApi.reprogramar(p.id, programadoParaIso(v) as string));
  };

  return (
    <section aria-label="Pedidos programados" data-testid="panel-programados">
      <h2>Programados</h2>
      {error && <p role="alert">{error}</p>}
      {lista === null && !error && <p>Cargando…</p>}
      {lista?.length === 0 && <p>No hay pedidos programados.</p>}
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
        {(lista ?? []).map((p) => (
          <li key={p.id} data-testid="fila-programado" style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: 10 }}>
            <strong>{p.codigo}</strong> · {p.clienteNombre ?? 'Cliente'} · {p.modalidad === 'DELIVERY' ? 'Delivery' : p.modalidad === 'MESA' ? 'Comer en local' : 'Recoger'}
            <div>Para {textoProgramado(p.programadoPara)}</div>
            <div>
              Total {soles(p.total)} · Adelanto {soles(p.adelanto)} · Saldo {soles(p.saldo)}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {puedePasar && (
                <button type="button" onClick={() => void pasarAhora(p)}>
                  Pasar a cocina ahora
                </button>
              )}
              <button type="button" onClick={() => abrir(p.id, 'adelanto')}>Adelanto</button>
              <button type="button" onClick={() => abrir(p.id, 'reprogramar')}>Reprogramar</button>
              <button type="button" onClick={() => abrir(p.id, 'anular')}>Anular</button>
            </div>
            {abierta?.id === p.id && abierta.tipo === 'adelanto' && (
              <div style={{ marginTop: 6 }}>
                <input type="number" min="0" step="0.01" aria-label="Monto del adelanto" value={monto} onChange={(e) => setMonto(e.target.value)} style={{ width: 90 }} />{' '}
                <select aria-label="Medio del adelanto" value={medio} onChange={(e) => setMedio(e.target.value as typeof medio)}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="YAPE">Yape</option>
                  <option value="PLIN">Plin</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                </select>{' '}
                <button type="button" onClick={() => void ejecutar(() => pedidosApi.registrarAdelanto(p.id, { medio, monto: Number(monto) }))}>Registrar adelanto</button>
                <div style={{ fontSize: 12 }}>La captura del pago digital es opcional: se puede adjuntar después en el detalle del pedido.</div>
              </div>
            )}
            {abierta?.id === p.id && abierta.tipo === 'reprogramar' && (
              <div style={{ marginTop: 6 }}>
                <input type="date" aria-label="Nueva fecha" value={nuevaFecha} onChange={(e) => setNuevaFecha(e.target.value)} />{' '}
                <input type="time" aria-label="Nueva hora" value={nuevaHora} onChange={(e) => setNuevaHora(e.target.value)} />{' '}
                <button type="button" onClick={() => reprogramar(p)}>Guardar nueva fecha</button>
              </div>
            )}
            {abierta?.id === p.id && abierta.tipo === 'anular' && (
              <div style={{ marginTop: 6 }}>
                {p.adelanto > 0 && (
                  <div style={{ fontSize: 13 }}>
                    Tiene un adelanto de {soles(p.adelanto)}: al anular se devuelve (egreso de la caja de hoy si es efectivo; en otros medios queda registrado). Para conservarlo, usa «Reprogramar».
                  </div>
                )}
                <input type="text" aria-label="Motivo de la anulación" placeholder="Motivo (mínimo 5 letras)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />{' '}
                <button type="button" disabled={motivo.trim().length < 5} onClick={() => void ejecutar(() => pedidosApi.anularProgramado(p.id, motivo.trim(), p.adelanto > 0))}>
                  {p.adelanto > 0 ? 'Anular y devolver adelanto' : 'Anular pedido'}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
