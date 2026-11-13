import { useCallback, useEffect, useState } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Boton } from '../../comun/Boton';
import { Insignia } from '../../comun/Insignia';
import { ErrorApi } from '../../comun/api';
import { culqiApi, type PagoOnline } from '../../carta/pagos/culqiApi';

const POR_PAGINA = 20;
const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Pagos en línea (Culqi). La devolución es solo del ADMIN. */
export function PagosOnlineTab() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol?.toUpperCase() === 'ADMIN';
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [estado, setEstado] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ items: PagoOnline[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aDevolver, setADevolver] = useState<PagoOnline | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errDevolver, setErrDevolver] = useState<string | null>(null);
  const [devolviendo, setDevolviendo] = useState(false);

  const cargar = useCallback(() => {
    setError(null);
    setDatos(null);
    culqiApi
      .listar({ desde, hasta, estado, pagina })
      .then(setDatos)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la lista.'));
  }, [desde, hasta, estado, pagina]);
  useEffect(cargar, [cargar]);

  const cambiar = (fn: () => void) => {
    fn();
    setPagina(1);
  };

  const devolver = async () => {
    if (!aDevolver || devolviendo) return;
    setDevolviendo(true);
    setErrDevolver(null);
    try {
      await culqiApi.devolver(aDevolver.id, { motivo: motivo.trim() });
      setADevolver(null);
      setMotivo('');
      cargar();
    } catch (e) {
      setErrDevolver(e instanceof ErrorApi ? e.message : 'No se pudo devolver. Intenta de nuevo.');
    } finally {
      setDevolviendo(false);
    }
  };

  return (
    <section aria-label="Pagos en línea">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <label>Desde <input type="date" value={desde} onChange={(e) => cambiar(() => setDesde(e.target.value))} style={{ minHeight: 44 }} /></label>
        <label>Hasta <input type="date" value={hasta} onChange={(e) => cambiar(() => setHasta(e.target.value))} style={{ minHeight: 44 }} /></label>
        <label>
          Estado{' '}
          <select value={estado} onChange={(e) => cambiar(() => setEstado(e.target.value))} style={{ minHeight: 44 }}>
            <option value="">Todos</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="DEVUELTO">Devuelto</option>
          </select>
        </label>
      </div>

      {error ? (
        <EstadoError mensaje={error} alReintentar={cargar} />
      ) : !datos ? (
        <Cargando />
      ) : datos.items.length === 0 ? (
        <EstadoVacio titulo="Sin pagos en línea" descripcion="No hay pagos con esos filtros." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Fecha', 'Pedido', 'Medio', 'Monto', 'Estado', ''].map((h) => (
                  <th key={h} scope="col" style={{ textAlign: 'left', padding: 8 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datos.items.map((p) => (
                <tr key={p.id} style={{ borderTop: '1px solid var(--cp-line)' }}>
                  <td style={{ padding: 8 }}>{fecha(p.creadoEn)}</td>
                  <td style={{ padding: 8 }}>#{p.pedidoCodigo}</td>
                  <td style={{ padding: 8 }}>{p.medio === 'YAPE' ? 'Yape' : 'Tarjeta'}</td>
                  <td style={{ padding: 8 }}>S/ {Number(p.monto).toFixed(2)}</td>
                  <td style={{ padding: 8 }}>
                    <Insignia variante={p.devuelto ? 'neutro' : p.estado === 'APROBADO' ? 'exito' : p.estado === 'RECHAZADO' ? 'peligro' : 'aviso'}>
                      {p.devuelto ? 'Devuelto' : p.estado}
                    </Insignia>
                  </td>
                  <td style={{ padding: 8 }}>
                    {esAdmin && p.estado === 'APROBADO' && !p.devuelto && (
                      <Boton variante="peligro" tamano="pequeno" onClick={() => { setADevolver(p); setMotivo(''); setErrDevolver(null); }}>
                        Devolver
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {datos && <Paginacion pagina={pagina} totalPaginas={Math.max(1, Math.ceil(datos.total / POR_PAGINA))} alCambiarPagina={setPagina} totalRegistros={datos.total} tamanoPagina={POR_PAGINA} />}

      <Confirmar
        abierto={!!aDevolver}
        titulo="Devolver el pago"
        mensaje={aDevolver ? `¿Devolver S/ ${Number(aDevolver.monto).toFixed(2)} del pedido #${aDevolver.pedidoCodigo}? Se devuelve el total al cliente.` : ''}
        textoSi="Sí, devolver"
        textoNo="No"
        peligro
        focoInicialNo
        cargando={devolviendo}
        deshabilitarConfirmar={motivo.trim().length < 3}
        error={errDevolver}
        alConfirmar={devolver}
        alCancelar={() => setADevolver(null)}
      >
        <label style={{ display: 'block', marginTop: 8 }}>
          Motivo (obligatorio)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} style={{ width: '100%', minHeight: 44 }} />
        </label>
      </Confirmar>
    </section>
  );
}
