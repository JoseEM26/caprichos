import { useEffect, useState } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Paginacion } from '../../comun/Paginacion';
import { Boton } from '../../comun/Boton';
import { ofertasApi, type CuponItem, type DadoCuponFila, type UsoCuponFila, type UsosCupon } from './ofertasApi';

const soles = (n: number) => `S/ ${n.toFixed(2)}`;
const CANAL: Record<string, string> = { CARTA: 'Carta', CAJA: 'Caja', MOZO: 'Mozo', BOT: 'WhatsApp' };
const ESTADO_DADO: Record<string, string> = { VIGENTE: 'Sin usar', CANJEADO: 'Canjeado', VENCIDO: 'Vencido', ANULADO: 'Quitado' };
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div style={{ flex: '1 1 140px', border: '1px solid var(--cp-line)', borderRadius: 12, padding: '10px 12px', background: 'var(--cp-white)' }}>
      <div style={{ fontSize: 12, color: 'var(--cp-soft)', fontWeight: 700 }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--cp-navy)' }}>{valor}</div>
    </div>
  );
}

/** Barras simples (CSS): un día por barra, alto según los usos. */
function BarrasPorDia({ datos }: { datos: UsosCupon['porDia'] }) {
  const max = Math.max(1, ...datos.map((d) => d.usos));
  return (
    <div role="img" aria-label="Usos por día, últimos 30 días" data-testid="barras-dia">
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 110, borderBottom: '1px solid var(--cp-line)' }}>
        {datos.map((d) => (
          <div
            key={d.dia}
            title={`${d.dia.slice(8, 10)}/${d.dia.slice(5, 7)}: ${d.usos} ${d.usos === 1 ? 'uso' : 'usos'} · ${soles(d.soles)}`}
            style={{ flex: 1, height: `${(d.usos / max) * 100}%`, minHeight: d.usos ? 3 : 1, background: d.usos ? 'var(--cp-orange)' : 'var(--cp-line)', borderRadius: '3px 3px 0 0' }}
          />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--cp-soft)', marginTop: 4 }}>
        <span>{datos[0]?.dia.slice(8, 10)}/{datos[0]?.dia.slice(5, 7)}</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}

/** «Ver usos» de un cupón: quién lo usó, cuánto descontó y cuándo. */
export function ModalUsosCupon({ cupon, onCerrar }: { cupon: CuponItem; onCerrar: () => void }) {
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<UsosCupon | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError(false);
    ofertasApi
      .usosDeCupon(cupon.id, pagina, 10)
      .then((d) => vigente && setDatos(d))
      .catch(() => vigente && setError(true))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [cupon.id, pagina, intento]);

  const estado = error ? (
    <div role="alert" style={{ padding: 12 }}>
      No pudimos cargar los usos. <Boton variante="secundario" tamano="pequeno" onClick={() => setIntento((n) => n + 1)}>Reintentar</Boton>
    </div>
  ) : !datos ? (
    <p role="status">Cargando…</p>
  ) : null;

  const r = datos?.resumen;
  const asig = datos?.modo === 'ASIGNADO_PERSONAL';
  const resumen = estado ?? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <Cifra titulo={asig ? 'Dados' : 'Usos'} valor={r!.tope != null ? `${r!.usos} de ${r!.tope}` : String(r!.usos)} />
        {asig && <Cifra titulo="Canjeados" valor={String(r!.canjeados ?? 0)} />}
        {r!.quedan != null && <Cifra titulo={asig ? 'Quedan por dar' : 'Quedan'} valor={String(r!.quedan)} />}
        <Cifra titulo="Descuento dado" valor={soles(r!.descuentoTotal)} />
        <Cifra titulo="Clientes distintos" valor={String(r!.clientesDistintos)} />
        {!asig && r!.emitidos != null && <Cifra titulo="Impresos" valor={String(r!.emitidos)} />}
        {r!.vencidos != null && <Cifra titulo="Vencidos" valor={String(r!.vencidos)} />}
      </div>
      {r!.anulados > 0 && <p style={{ margin: 0, fontSize: 13, color: 'var(--cp-soft)' }}>{r!.anulados} {r!.anulados === 1 ? 'pedido anulado no suma' : 'pedidos anulados no suman'} al descuento.</p>}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6 }}>{asig ? 'Cupones dados por día (últimos 30 días)' : 'Usos por día (últimos 30 días)'}</div>
        <BarrasPorDia datos={datos!.porDia} />
      </div>
    </div>
  );

  const trabajadores = estado ?? (
    datos!.porTrabajador.length === 0 ? (
      <p>Todavía nadie usó este cupón.</p>
    ) : (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--cp-soft)' }}>
              <th scope="col" style={{ padding: 6 }}>{asig ? 'Quién lo dio' : 'Quién lo aplicó'}</th>
              <th scope="col" style={{ padding: 6 }}>{asig ? 'Dados' : 'Usos'}</th>
              {asig && <th scope="col" style={{ padding: 6 }}>Canjeados</th>}
              <th scope="col" style={{ padding: 6 }}>Descuento dado</th>
            </tr>
          </thead>
          <tbody>
            {datos!.porTrabajador.map((t) => (
              <tr key={t.partyId ?? 'sin'} style={{ borderTop: '1px solid var(--cp-sand)' }}>
                <td style={{ padding: 6 }}>{t.nombre}</td>
                <td style={{ padding: 6 }}>{t.usos}</td>
                {asig && <td style={{ padding: 6 }}>{t.canjeados ?? 0}</td>}
                <td style={{ padding: 6 }}>{soles(t.soles)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  const h = datos?.historial;
  const historial = estado ?? (
    h!.items.length === 0 ? (
      <p>Todavía nadie usó este cupón.</p>
    ) : (
      <>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--cp-soft)' }}>
                {(asig ? ['Fecha dado', 'Pedido', 'Lo dio', 'Cliente', 'Código', 'Estado', 'Pedido de canje', 'Fecha canje'] : ['Fecha', 'Pedido', 'Canal', 'Lo aplicó', 'Cliente', 'Total', 'Descuento']).map((c) => (
                  <th key={c} scope="col" style={{ padding: 6 }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {asig && (h!.items as DadoCuponFila[]).map((f) => (
                <tr key={f.codigo} style={{ borderTop: '1px solid var(--cp-sand)' }}>
                  <td style={{ padding: 6 }}>{fechaHora(f.fecha)}</td>
                  <td style={{ padding: 6 }}>{f.pedidoOrigenCodigo ?? '—'}</td>
                  <td style={{ padding: 6 }}>{f.otorgadoPor ?? '—'}</td>
                  <td style={{ padding: 6 }}>{f.cliente.sinCuenta ? 'Sin cuenta' : `${f.cliente.nombre ?? 'Cliente'}${f.cliente.celular ? ` · ${f.cliente.celular}` : ''}`}</td>
                  <td style={{ padding: 6, fontFamily: 'monospace' }}>{f.codigo}</td>
                  <td style={{ padding: 6 }}>{ESTADO_DADO[f.estado] ?? f.estado}</td>
                  <td style={{ padding: 6 }}>{f.pedidoCanjeCodigo ?? '—'}</td>
                  <td style={{ padding: 6 }}>{f.canjeadoEn ? fechaHora(f.canjeadoEn) : '—'}</td>
                </tr>
              ))}
              {!asig && (h!.items as UsoCuponFila[]).map((f) => (
                <tr key={`${f.pedidoCodigo}-${f.fecha}`} style={{ borderTop: '1px solid var(--cp-sand)', opacity: f.anulado ? 0.6 : 1 }}>
                  <td style={{ padding: 6 }}>{fechaHora(f.fecha)}</td>
                  <td style={{ padding: 6 }}>
                    {f.pedidoCodigo}
                    {f.anulado && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: '#8A2A18' }}>ANULADO</span>}
                  </td>
                  <td style={{ padding: 6 }}>{f.canal ? (CANAL[f.canal] ?? f.canal) : '—'}</td>
                  <td style={{ padding: 6 }}>{f.aplicadoPor ?? '—'}</td>
                  <td style={{ padding: 6 }}>
                    {f.cliente.sinCuenta ? 'Sin cuenta' : `${f.cliente.nombre ?? 'Cliente'}${f.cliente.celular ? ` · ${f.cliente.celular}` : ''}`}
                  </td>
                  <td style={{ padding: 6 }}>{soles(f.totalPedido)}</td>
                  <td style={{ padding: 6 }}>{soles(f.descuento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Paginacion pagina={h!.pagina} totalPaginas={h!.totalPaginas} alCambiarPagina={setPagina} totalRegistros={h!.total} tamanoPagina={h!.tamano} />
      </>
    )
  );

  return (
    <ModalConPestanas
      titulo={`Usos del cupón ${cupon.codigoBase}`}
      subtitulo={cargando && datos ? 'Actualizando…' : undefined}
      ancho={900}
      pestanas={[
        { id: 'resumen', etiqueta: 'Resumen', contenido: resumen },
        { id: 'trabajador', etiqueta: 'Por trabajador', contenido: trabajadores },
        { id: 'historial', etiqueta: 'Historial', insignia: h?.total ?? null, contenido: historial },
      ]}
      pie={<Boton variante="secundario" onClick={onCerrar}>Cerrar</Boton>}
      alCerrar={onCerrar}
    />
  );
}
