import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Confirmar } from '../../comun/Confirmar';
import { impresionApi, type ResultadoSimulacion } from './impresionApi';

const MODALIDADES = [
  { id: 'LLEVAR', texto: 'Para llevar' },
  { id: 'MESA', texto: 'En mesa (Mesa 4)' },
  { id: 'DELIVERY', texto: 'Delivery' },
  { id: 'COMER_LOCAL', texto: 'Comer en el local' },
];

/**
 * «Simular un pedido completo»: imprime un pedido de PRUEBA en todas las PC según lo configurado, por el mismo camino
 * que una venta (sin crear pedido, cobro ni stock). La modalidad se elige al confirmar.
 */
export function SimularPedido() {
  const [abierto, setAbierto] = useState(false);
  const [modalidad, setModalidad] = useState('LLEVAR');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoSimulacion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const simular = async () => {
    setEnviando(true);
    setError(null);
    try {
      setResultado(await impresionApi.simularPedido(modalidad));
    } catch (err: any) {
      setError(err?.message || 'No se pudo simular el pedido');
    } finally {
      setEnviando(false);
      setAbierto(false);
    }
  };

  return (
    <div data-testid="simular-pedido" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <button
          type="button"
          aria-label="Simular un pedido completo"
          title="Imprime un pedido de prueba completo en todas las PC según la configuración actual."
          onClick={() => setAbierto(true)}
          style={{ minHeight: 44, padding: '0 14px', borderRadius: 8, border: '1.5px solid var(--cp-orange, #E67929)', background: 'transparent', color: 'var(--cp-rust, #B2500F)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
        >
          Simular un pedido completo
        </button>
      </div>
      {error && (
        <div role="alert" style={{ color: 'var(--cp-rust, #B2500F)', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      {resultado && (
        <div role="status" data-testid="resultado-simulacion" style={{ border: '1px solid var(--cp-line, #E3D6C6)', borderRadius: 10, padding: 10, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong>{resultado.total > 0 ? `Se enviaron ${resultado.total} trabajos` : 'No se envió nada'}</strong>
          {resultado.enviados.map((g) => (
            <div key={`${g.equipoId}-${g.maquina}`}>
              {g.maquina} de {g.equipo}: {g.cantidad} ({g.trabajos.join(', ')})
            </div>
          ))}
          {resultado.sinReceptor.length > 0 && <div>Sin PC que lo imprima: {resultado.sinReceptor.join(', ')}</div>}
          {resultado.noRecibieron.length > 0 && (
            <div style={{ color: 'var(--cp-rust, #B2500F)', fontWeight: 700 }}>
              No recibieron: {resultado.noRecibieron.map((n) => `PC «${n.equipo}» (${n.motivo})`).join(' · ')}
            </div>
          )}
          <Link to="?tab=impresion&seccion=cola" style={{ minHeight: 44, display: 'inline-flex', alignItems: 'center', fontWeight: 800 }}>
            Ver cola
          </Link>
        </div>
      )}
      <Confirmar
        abierto={abierto}
        titulo="¿Simular un pedido completo?"
        mensaje="Se imprimirá un pedido de PRUEBA completo en todas las PCs según la configuración actual. No crea pedido, ni cobro, ni stock."
        textoSi="Sí, simular"
        textoNo="No"
        cargando={enviando}
        alConfirmar={simular}
        alCancelar={() => setAbierto(false)}
      >
        <fieldset style={{ border: 0, padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <legend style={{ fontSize: 13, fontWeight: 800 }}>Modalidad del pedido de prueba</legend>
          {MODALIDADES.map((m) => (
            <label key={m.id} style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input type="radio" name="modalidad-simulacion" value={m.id} checked={modalidad === m.id} onChange={() => setModalidad(m.id)} />
              {m.texto}
            </label>
          ))}
        </fieldset>
      </Confirmar>
    </div>
  );
}
