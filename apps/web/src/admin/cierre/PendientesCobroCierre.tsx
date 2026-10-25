import { useState } from 'react';
import { ModalCobrar } from '../pedidos/ModalCobrar';
import { ModalAnular } from '../pedidos/ModalAnular';
import { pedidosApi, Pedido } from '../pedidos/pedidosApi';
import { cierreApi, PendienteCobro } from './cierreApi';
import { ErrorApi } from '../../comun/api';
import { CampoCodigoSupervisor } from '../../comun/CampoCodigoSupervisor';

export interface PendientesCobroCierreProps {
  esAdmin: boolean;
  pendientes: PendienteCobro[];
  setPendientes: (lista: PendienteCobro[]) => void;
  alCambiarTurno: () => void;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Pedidos sin cobrar de cualquier día que impiden cerrar la caja (RN-CAP-079). Cada uno se cobra
 * en la caja que se cierra («Cobrar ahora») o se anula con motivo y PIN («Anular»). Un cajero
 * ve la lista solo con el PIN de supervisor.
 */
export function PendientesCobroCierre({
  esAdmin,
  pendientes,
  setPendientes,
  alCambiarTurno,
}: PendientesCobroCierreProps) {
  const [codigo, setCodigo] = useState('');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [pedidoCobrar, setPedidoCobrar] = useState<Pedido | null>(null);
  const [pendienteAnular, setPendienteAnular] = useState<PendienteCobro | null>(null);

  const mostrarLista = esAdmin || desbloqueado;

  const verConCodigo = async () => {
    if (!/^\d{6}$/.test(codigo.trim())) {
      setError('El código del supervisor debe ser de exactamente 6 dígitos numéricos.');
      return;
    }
    setCargando(true);
    setError('');
    try {
      const lista = await cierreApi.listarPendientesDeCobro(codigo);
      setPendientes(lista);
      setDesbloqueado(true);
    } catch (err: unknown) {
      if (err instanceof ErrorApi) {
        if (err.codigo === 'CODIGO_INVALIDO' || err.codigo === 'PIN_INVALIDO') {
          setError('Código del supervisor inválido. Pídelo nuevamente a la supervisora.');
        } else if (err.codigo === 'CODIGO_BLOQUEADO' || err.codigo === 'PIN_BLOQUEADO') {
          setError(err.message || 'Demasiados intentos fallidos de código de supervisor. Espera 5 minutos.');
        } else if (err.codigo === 'SUPERVISOR_SIN_CONFIGURAR') {
          setError('El local aún no tiene configurado el código de supervisor. El administrador debe generarlo desde su pantalla.');
        } else {
          setError(err.message);
        }
      } else {
        setError('No se pudo cargar la lista. Intenta de nuevo.');
      }
    } finally {
      setCodigo('');
      setCargando(false);
    }
  };

  const quitar = (id: number) => setPendientes(pendientes.filter((p) => p.id !== id));

  const cobrarAhora = async (p: PendienteCobro) => {
    setError('');
    try {
      setPedidoCobrar(await pedidosApi.obtenerPorId(p.id));
    } catch (err: unknown) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo abrir el cobro del pedido.');
    }
  };

  if (pendientes.length === 0 && mostrarLista) return null;

  return (
    <div
      style={{
        border: '1.5px dashed var(--cp-rust, #B2500F)',
        borderRadius: 12,
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        background: 'var(--cp-white, #FFFFFF)',
      }}
    >
      <div style={{ fontWeight: 800, color: 'var(--cp-rust, #B2500F)', fontSize: 13 }}>
        Pedidos sin cobrar: impiden cerrar la caja
      </div>

      {!mostrarLista ? (
        <>
          <div style={{ fontSize: 13 }}>
            Ingresa el código del supervisor para ver los pedidos sin cobrar de cualquier día.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <CampoCodigoSupervisor
                id="codigo-supervisor-pendientes"
                valor={codigo}
                onChange={(v) => {
                  setCodigo(v);
                  setError('');
                }}
                error={error}
                etiqueta="Código del supervisor (6 dígitos)"
                ayuda="Pídelo a la supervisora: lo ve en su pantalla y cambia cada 30 segundos"
              />
            </div>
            <button
              type="button"
              onClick={verConCodigo}
              disabled={cargando}
              style={{ minHeight: 44, marginTop: 24, padding: '0 16px', borderRadius: 10, border: 0, background: 'var(--cp-navy, #0B2C3E)', color: '#fff', fontWeight: 800, cursor: 'pointer' }}
            >
              {cargando ? 'Verificando…' : 'Ver pedidos'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13 }}>
            {pendientes.length} {pendientes.length === 1 ? 'pedido' : 'pedidos'} sin cobrar o por confirmar. Cóbralos o anúlalos para poder cerrar la caja.
          </div>
          {pendientes.map((p) => (
            <div
              key={p.id}
              style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderTop: '1px solid var(--cp-sand, #EDE1D1)', paddingTop: 8, fontSize: 13 }}
            >
              <div style={{ flex: 1, minWidth: 160 }}>
                <b>{p.codigo}</b> · {p.canal} · {p.modalidad} · {p.estado}
                <div style={{ fontSize: 12, color: 'var(--cp-soft, #6B7B86)' }}>
                  {fechaCorta(p.fecha)} · s/ {Number(p.total || 0).toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => cobrarAhora(p)}
                style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: 0, background: 'var(--cp-orange, #E67929)', color: 'var(--cp-navy, #0B2C3E)', fontWeight: 800, cursor: 'pointer' }}
              >
                Cobrar ahora
              </button>
              <button
                type="button"
                onClick={() => setPendienteAnular(p)}
                style={{ minHeight: 40, padding: '0 12px', borderRadius: 10, border: '1.5px solid var(--cp-rust, #B2500F)', background: 'transparent', color: 'var(--cp-rust, #B2500F)', fontWeight: 800, cursor: 'pointer' }}
              >
                Anular con motivo
              </button>
            </div>
          ))}
        </>
      )}

      {error && mostrarLista && (
        <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}

      {pedidoCobrar && (
        <ModalCobrar
          pedido={pedidoCobrar}
          alCerrar={() => setPedidoCobrar(null)}
          cobrar={(dto) => cierreApi.cobrarPendiente(pedidoCobrar.id, dto)}
          alCobrarExitoso={() => {
            quitar(Number(pedidoCobrar.id));
            setPedidoCobrar(null);
            alCambiarTurno();
          }}
        />
      )}

      {pendienteAnular && (
        <ModalAnular
          pedidoId={pendienteAnular.id}
          codigoPedido={pendienteAnular.codigo}
          alCerrar={() => setPendienteAnular(null)}
          alAnularExitoso={() => {
            quitar(pendienteAnular.id);
            setPendienteAnular(null);
            alCambiarTurno();
          }}
        />
      )}
    </div>
  );
}
