import { useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { ModalPorPasos } from '../../comun/ModalPorPasos';
import { ofertasApi, type RevisionCupon } from './ofertasApi';

const soles = (n: number | null | undefined) => `S/ ${Number(n ?? 0).toFixed(2)}`;
const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' }) : '—';
const vigencia = (iso: string | null | undefined) =>
  !iso ? 'Sin fecha de vencimiento' : /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `Hasta el ${iso.split('-').reverse().join('/')}` : `Hasta el ${fechaHora(iso)}`;
const descuentoTxt = (c: NonNullable<RevisionCupon['cupon']>) =>
  c.tipo === 'PORCENTAJE' ? `${c.valor} % de descuento` : c.tipo === 'ENVIO_GRATIS' ? 'Envío gratis' : `${soles(c.valor)} de descuento`;
const ESTADOS: Record<string, string> = { VIGENTE: 'Vigente', CANJEADO: 'Canjeado', VENCIDO: 'Vencido', ANULADO: 'Anulado', INACTIVO: 'Desactivado' };

interface Props {
  pedido: { id: string | number; codigo: string };
  /** Desde dónde se canjea: queda guardado con el canje. */
  canal: 'CAJA' | 'MOZO';
  alCerrar: () => void;
  /** Ya se aplicó: el padre recarga el pedido (total y recibo). */
  alAplicado: () => void;
}

/** «Canjear cupón»: 1) código y Revisar, 2) detalles del cupón sin consumirlo, 3) confirmar Sí/No y aplicar al pedido. */
export function ModalCanjearCupon({ pedido, canal, alCerrar, alAplicado }: Props) {
  const [codigo, setCodigo] = useState('');
  const [revision, setRevision] = useState<RevisionCupon | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [aplicando, setAplicando] = useState(false);

  const revisar = async () => {
    const limpio = codigo.trim();
    if (!limpio) return setError('Escribe el código del cupón');
    setRevisando(true);
    setError('');
    try {
      setRevision(await ofertasApi.revisarCupon(limpio, String(pedido.id), canal));
      setVersion((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo revisar el cupón');
    } finally {
      setRevisando(false);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    try {
      await ofertasApi.canjearCupon(revision?.codigo ?? codigo, String(pedido.id), canal);
      alAplicado();
      alCerrar();
    } finally {
      setAplicando(false);
    }
  };

  const c = revision?.cupon ?? null;
  const pasoCodigo = (
    <>
      <Campo
        etiqueta="Código del cupón"
        value={codigo}
        autoFocus
        autoComplete="off"
        autoCapitalize="characters"
        placeholder="Escríbelo o pégalo"
        onChange={(e) => { setCodigo(e.target.value.replace(/\s+/g, '').toUpperCase()); setError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void revisar(); } }}
      />
      <Boton tamano="grande" onClick={() => void revisar()} cargando={revisando} disabled={revisando || !codigo.trim()}>Revisar</Boton>
      {error && <div role="alert" className="mpp-error">{error}</div>}
      <p className="as-ayuda">Revisar no usa el cupón: solo muestra sus detalles. Se aplica al pedido {pedido.codigo} en el último paso.</p>
    </>
  );

  const pasoDetalles = !revision ? (
    <p>Primero revisa un código.</p>
  ) : (
    <div data-testid="detalle-cupon" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {revision.aplicable ? (
        <div role="status" style={{ fontWeight: 800, color: '#14633b' }}>Sirve para este pedido: descuenta {soles(revision.descuento)}</div>
      ) : (
        <div role="alert" style={{ fontWeight: 800, color: '#9a2b12' }}>No se puede aplicar: {revision.motivo}</div>
      )}
      {c && (
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px', fontSize: 14 }}>
          <dt>Cupón</dt><dd style={{ margin: 0 }}>{c.codigoBase}{c.descripcion ? ` · ${c.descripcion}` : ''}</dd>
          <dt>Descuento</dt><dd style={{ margin: 0 }}>{descuentoTxt(c)}</dd>
          {revision.descuento != null && <><dt>En este pedido</dt><dd style={{ margin: 0 }}>{soles(revision.totalActual)} pasa a {soles(revision.nuevoTotal)}</dd></>}
          {c.compraMinima != null && <><dt>Compra mínima</dt><dd style={{ margin: 0 }}>{soles(c.compraMinima)}</dd></>}
          {c.alcance && <><dt>Alcance</dt><dd style={{ margin: 0 }}>{c.alcance}</dd></>}
          <dt>Vigencia</dt><dd style={{ margin: 0 }}>{vigencia(c.venceEn)}</dd>
          {revision.estado && <><dt>Estado</dt><dd style={{ margin: 0 }}>{ESTADOS[revision.estado] ?? revision.estado}</dd></>}
          {revision.dado && (
            <>
              <dt>Lo dio</dt>
              <dd style={{ margin: 0 }}>
                {revision.dado.por ?? 'Sistema'}{revision.dado.pedido ? ` en el pedido ${revision.dado.pedido}` : ''}
                {revision.dado.cliente ? ` · cliente ${revision.dado.cliente}` : ''} · {fechaHora(revision.dado.en)}
              </dd>
            </>
          )}
          {revision.canje && (
            <>
              <dt>Ya canjeado</dt>
              <dd style={{ margin: 0 }}>{fechaHora(revision.canje.en)}{revision.canje.por ? ` por ${revision.canje.por}` : ''}{revision.canje.pedido ? ` en ${revision.canje.pedido}` : ''}</dd>
            </>
          )}
        </dl>
      )}
    </div>
  );

  const pasoConfirmar = (
    <p data-testid="pregunta-aplicar">
      ¿Aplicar el cupón <strong>{c?.codigoBase}</strong> al pedido <strong>{pedido.codigo}</strong>? El total pasará de {soles(revision?.totalActual)} a {soles(revision?.nuevoTotal)}. Una vez aplicado, el cupón queda canjeado.
    </p>
  );

  return (
    <ModalPorPasos
      // al llegar la revisión se vuelve a montar directo en el paso de detalles
      key={version}
      titulo="Canjear cupón"
      subtitulo={`Pedido ${pedido.codigo}`}
      ancho={520}
      indiceInicial={revision ? 1 : 0}
      pasos={[
        { id: 'codigo', titulo: 'Código', contenido: pasoCodigo, validar: () => (revision ? null : 'Escribe el código y pulsa Revisar') },
        { id: 'detalles', titulo: 'Detalles', contenido: pasoDetalles, validar: () => (revision?.aplicable ? null : (revision?.motivo ?? 'Revisa primero el cupón')) },
        { id: 'confirmar', titulo: 'Confirmar', contenido: pasoConfirmar },
      ]}
      alCerrar={alCerrar}
      alFinalizar={aplicar}
      enviando={aplicando}
      accionFinal={
        <>
          <Boton variante="secundario" onClick={alCerrar} disabled={aplicando}>No</Boton>
          <Boton cargando={aplicando} disabled={aplicando} onClick={() => void aplicar().catch((e) => setError(e instanceof Error ? e.message : 'No se pudo aplicar el cupón'))}>Sí, aplicar</Boton>
        </>
      }
      error={error}
    />
  );
}
