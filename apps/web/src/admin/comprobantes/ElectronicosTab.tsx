import { useState, useEffect, useCallback } from 'react';
import { useSesion } from '../../comun/sesion';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Confirmar } from '../../comun/Confirmar';
import { Paginacion } from '../../comun/Paginacion';
import { Insignia, type VarianteInsignia } from '../../comun/Insignia';
import { Boton } from '../../comun/Boton';
import { comprobantesApi } from './comprobantesApi';
import { formatearSoles, rucValido } from './utilidades';
import { consultarDocumento, mensajeConsulta, tipoPorLongitud } from '../pedidos/consultaDocumento';
import type { BoletaPorDefecto, ComprobanteElectronico, ConfigFacturacion, ProveedorFacturacion, SaludFacturacion } from './tipos';

const ALTO_TOQUE = '44px';

/** Estado para la vista: lo que SUNAT dice (y si es de prueba). */
function estadoDe(c: ComprobanteElectronico): { texto: string; variante: VarianteInsignia } {
  if (c.baja_estado === 'ACEPTADA') return { texto: 'Anulado (baja aceptada)', variante: 'neutro' };
  if (c.baja_estado === 'SOLICITADA') return { texto: 'Baja solicitada', variante: 'aviso' };
  if (c.baja_estado === 'PENDIENTE_RESUMEN') return { texto: 'Baja en el resumen diario', variante: 'aviso' };
  if (c.facturacion_estado === 'EMITIDO_SUNAT') return c.simulado ? { texto: 'Simulado', variante: 'aviso' } : { texto: 'Emitido SUNAT', variante: 'exito' };
  if (c.facturacion_estado === 'PENDIENTE_ENVIO') return { texto: 'Pendiente de envío', variante: 'aviso' };
  if (c.facturacion_estado === 'PENDIENTE_RESUMEN') return { texto: 'Pendiente de resumen diario', variante: 'aviso' };
  if (c.facturacion_estado === 'ENVIADA_RESUMEN') return { texto: 'En resumen diario (espera a SUNAT)', variante: 'aviso' };
  if (c.facturacion_estado === 'REVISION_MANUAL') return { texto: 'Revisión manual', variante: 'peligro' };
  return { texto: 'Rechazado', variante: 'peligro' };
}

const tipoTexto = (t: string) => (t === 'FACTURA' ? 'Factura' : 'Boleta');

const NOMBRE_PROVEEDOR: Record<ProveedorFacturacion, string> = {
  SIMULADO: 'Simulado (sin SUNAT)',
  SUNAT: 'SUNAT directo',
};

/** Fecha AAAA-MM-DD a DD/MM/AAAA. */
const fechaCorta = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
};

/** Días que faltan para el vencimiento del certificado (negativo si ya venció). */
const diasParaVencer = (iso: string) => Math.floor((new Date(`${iso}T12:00:00`).getTime() - Date.now()) / 86_400_000);

/** Insignia del proveedor que de verdad emite (sin valores de conexión). */
function insigniaProveedor(config: ConfigFacturacion): { texto: string; variante: VarianteInsignia } {
  const efectivo: ProveedorFacturacion = config.proveedor_efectivo ?? 'SIMULADO';
  if (efectivo === 'SUNAT') return { texto: `SUNAT directo · ${config.sunat?.ambiente === 'prod' ? 'producción' : 'beta (pruebas)'}`, variante: 'exito' };
  return { texto: 'Modo simulado (sin SUNAT)', variante: 'aviso' };
}

/** Fecha y hora de Lima de la fecha de corte (ISO). */
const fechaHoraCorta = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

/** Rechazo 0133: falla interna y temporal de SUNAT, no del comprobante; se reintenta tal cual. */
const esTemporal0133 = (c: ComprobanteElectronico) => c.facturacion_estado === 'RECHAZADO' && /\b0133\b/.test(c.respuesta_sunat ?? '');

/** Lo que el panel «Con problemas» dice de cada caso: qué hacer. */
function accionDe(c: ComprobanteElectronico): string {
  if (esTemporal0133(c)) return 'Reintentar';
  if (c.facturacion_estado === 'REVISION_MANUAL' || c.facturacion_estado === 'RECHAZADO') return 'Corregir y reintentar';
  return 'Reintentar';
}

export function ElectronicosTab() {
  const { usuario } = useSesion();
  const esAdmin = usuario?.rol === 'ADMIN';

  const [filas, setFilas] = useState<ComprobanteElectronico[]>([]);
  const [problemas, setProblemas] = useState<ComprobanteElectronico[]>([]);
  const [salud, setSalud] = useState<SaludFacturacion | null>(null);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [config, setConfig] = useState<ConfigFacturacion | null>(null);
  const [formIgv, setFormIgv] = useState('');
  const [formSerieB, setFormSerieB] = useState('');
  const [formSerieF, setFormSerieF] = useState('');
  const [formProveedor, setFormProveedor] = useState<ProveedorFacturacion>('SIMULADO');
  const [confirmarConfig, setConfirmarConfig] = useState(false);
  const [enviandoResumen, setEnviandoResumen] = useState(false);
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [errorConfig, setErrorConfig] = useState<string | null>(null);
  // Boleta por defecto: valor propuesto (Sí/No) pendiente de confirmar
  const [boleta, setBoleta] = useState<BoletaPorDefecto | null>(null);
  const [propuestaBoleta, setPropuestaBoleta] = useState<boolean | null>(null);
  const [guardandoBoleta, setGuardandoBoleta] = useState(false);
  const [errorBoleta, setErrorBoleta] = useState<string | null>(null);

  const [reintentarDe, setReintentarDe] = useState<ComprobanteElectronico | null>(null);
  const [corrDoc, setCorrDoc] = useState('');
  const [corrRazon, setCorrRazon] = useState('');
  const [corrDir, setCorrDir] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [buscandoRuc, setBuscandoRuc] = useState(false);
  const [errorRuc, setErrorRuc] = useState<string | null>(null);

  const [realDe, setRealDe] = useState<ComprobanteElectronico | null>(null);
  const [anularDe, setAnularDe] = useState<ComprobanteElectronico | null>(null);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);

  /** Panel «Con problemas» y contador: si fallan, la pestaña sigue funcionando sin ellos. */
  const cargarProblemas = useCallback(async () => {
    if (!esAdmin) return;
    try {
      const [p, s] = await Promise.all([comprobantesApi.listarProblemasElectronicos(1, 50), comprobantesApi.saludFacturacion()]);
      setProblemas(p.elementos);
      setSalud(s);
    } catch {
      setProblemas([]);
      setSalud(null);
    }
  }, [esAdmin]);

  const cargar = useCallback(async (p = 1) => {
    setCargando(true);
    setError(null);
    try {
      const r = await comprobantesApi.listarElectronicos(p, 20);
      setFilas(r.elementos);
      setPagina(r.pagina);
      setTotalPaginas(Math.max(1, r.totalPaginas));
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar los comprobantes electrónicos');
    } finally {
      setCargando(false);
    }
    void cargarProblemas();
  }, [cargarProblemas]);

  useEffect(() => {
    cargar(1);
    comprobantesApi
      .obtenerFacturacion()
      .then((c) => {
        setConfig(c);
        setFormIgv(String(c.igvPct));
        setFormSerieB(c.serieBoleta);
        setFormSerieF(c.serieFactura);
        setFormProveedor(c.proveedor ?? 'SIMULADO');
      })
      .catch(() => setConfig(null));
  }, [cargar]);

  useEffect(() => {
    if (!esAdmin) return;
    comprobantesApi.obtenerBoletaPorDefecto().then(setBoleta).catch(() => setBoleta(null));
  }, [esAdmin]);

  const guardarBoleta = async () => {
    if (propuestaBoleta === null) return;
    setGuardandoBoleta(true);
    setErrorBoleta(null);
    try {
      const r = await comprobantesApi.guardarBoletaPorDefecto(propuestaBoleta);
      setBoleta(r);
      setAviso('Comprobante por defecto guardado');
    } catch (err: any) {
      setErrorBoleta(err?.message || 'No se pudo guardar el comprobante por defecto');
    } finally {
      setGuardandoBoleta(false);
      setPropuestaBoleta(null);
    }
  };

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    setErrorConfig(null);
    try {
      const c = await comprobantesApi.guardarFacturacion({
        igvPct: Number(formIgv),
        serieBoleta: formSerieB.trim().toUpperCase(),
        serieFactura: formSerieF.trim().toUpperCase(),
        proveedor: formProveedor,
      });
      setConfig(c);
      setConfirmarConfig(false);
      setAviso('Configuración de facturación guardada');
    } catch (err: any) {
      setErrorConfig(err?.message || 'No se pudo guardar la configuración');
      setConfirmarConfig(false);
    } finally {
      setGuardandoConfig(false);
    }
  };

  /** Abre el PDF de la boleta o factura en una pestaña nueva. */
  const verPdf = async (c: ComprobanteElectronico) => {
    try {
      const url = await comprobantesApi.urlPdfElectronico(c.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setError(err?.message || 'No se pudo abrir el PDF');
    }
  };

  const descargar = async (c: ComprobanteElectronico, tipo: 'XML' | 'CDR') => {
    try {
      const url = await comprobantesApi.urlArchivoElectronico(c.id, tipo);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${c.numero_texto}-${tipo}.xml`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    } catch (err: any) {
      const noExiste = /404/.test(String(err?.message ?? ''));
      setError(
        noExiste && tipo === 'CDR'
          ? 'Todavía no hay constancia de SUNAT para este comprobante: aparece cuando SUNAT responde.'
          : err?.message || `No se pudo descargar el ${tipo}`,
      );
    }
  };

  const enviarResumen = async () => {
    setEnviandoResumen(true);
    try {
      const r = await comprobantesApi.enviarResumenSunat();
      setAviso(r.boletas > 0 ? `Resumen diario enviado: ${r.boletas} boleta(s) en ${r.resumenes} resumen(es)` : 'No hay boletas pendientes de resumen');
      await cargar(pagina);
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el resumen diario');
    } finally {
      setEnviandoResumen(false);
    }
  };

  const abrirReintento = (c: ComprobanteElectronico) => {
    setReintentarDe(c);
    setCorrDoc(c.documento ?? '');
    setCorrRazon(c.razon_social ?? '');
    setCorrDir('');
    setErrorRuc(null);
  };

  // Solo rellena al pulsar el botón; si el servicio no responde o no encuentra, se escribe a mano.
  const puedeBuscar = tipoPorLongitud(corrDoc.trim()) === 'DNI' || rucValido(corrDoc.trim());
  const buscarRuc = async () => {
    setBuscandoRuc(true);
    setErrorRuc(null);
    const r = await consultarDocumento(corrDoc.trim());
    if (r.estado === 'ok' && r.tipo === 'DNI') setCorrRazon(r.nombre);
    else if (r.estado === 'ok') {
      setCorrRazon(r.razon);
      if (r.direccion) setCorrDir(r.direccion);
    } else setErrorRuc(mensajeConsulta(r));
    setBuscandoRuc(false);
  };

  const confirmarReintento = async () => {
    if (!reintentarDe) return;
    setOcupado(true);
    try {
      const correccion = {
        ...(corrDoc.trim() ? { documento: corrDoc.trim() } : {}),
        ...(corrRazon.trim() ? { razon: corrRazon.trim() } : {}),
        ...(corrDir.trim() ? { direccion: corrDir.trim() } : {}),
      };
      await comprobantesApi.reintentarElectronico(reintentarDe.id, correccion);
      setAviso(`Se reenvió ${reintentarDe.numero_texto} a SUNAT`);
      setReintentarDe(null);
      await cargar(pagina);
    } catch (err: any) {
      setError(err?.message || 'No se pudo reintentar');
      setReintentarDe(null);
    } finally {
      setOcupado(false);
    }
  };

  const confirmarEmitirReal = async () => {
    if (!realDe) return;
    setOcupado(true);
    try {
      const nuevo = await comprobantesApi.emitirReal(realDe.id);
      setAviso(`Se anuló ${realDe.numero_texto} (simulado) y se emitió ${nuevo.numero_texto} a SUNAT`);
      setRealDe(null);
      await cargar(pagina);
    } catch (err: any) {
      setError(err?.message || 'No se pudo emitir el comprobante real');
      setRealDe(null);
    } finally {
      setOcupado(false);
    }
  };

  const confirmarAnulacion = async () => {
    if (!anularDe) return;
    if (motivo.trim().length < 5) {
      setErrorMotivo('El motivo debe tener al menos 5 caracteres');
      return;
    }
    setOcupado(true);
    try {
      await comprobantesApi.anularElectronico(anularDe.id, motivo.trim());
      setAviso(`Se envió la baja de ${anularDe.numero_texto}`);
      setAnularDe(null);
      setMotivo('');
      await cargar(pagina);
    } catch (err: any) {
      setError(err?.message || 'No se pudo anular');
      setAnularDe(null);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <section aria-label="Facturación electrónica" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 16, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <strong>Facturación electrónica</strong>
          {config && <Insignia variante={insigniaProveedor(config).variante}>{insigniaProveedor(config).texto}</Insignia>}
        </div>
        {config && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 10, fontSize: 13 }}>
            <span>Proveedor elegido: <strong>{NOMBRE_PROVEEDOR[config.proveedor ?? 'SIMULADO']}</strong></span>
            {config.facturacion_desde && (
              <span>Facturación desde: <strong>{fechaHoraCorta(config.facturacion_desde)}</strong> (pedidos cobrados antes no se emiten)</span>
            )}
            {(config.proveedor === 'SUNAT' || config.sunat?.credenciales) && (
              <>
                <span>Ambiente: <strong>{config.sunat?.ambiente === 'prod' ? 'producción' : 'beta (pruebas)'}</strong></span>
                <span>Credenciales SUNAT: <strong>{config.sunat?.credenciales ? 'configuradas' : 'falta configurar'}</strong></span>
                {config.sunat?.vence_certificado && <span>Certificado vence: <strong>{fechaCorta(config.sunat.vence_certificado)}</strong></span>}
              </>
            )}
          </div>
        )}
        {config?.sunat?.vence_certificado && diasParaVencer(config.sunat.vence_certificado) <= 60 && (
          <div role="status" style={{ marginTop: 8, fontSize: 13, color: 'var(--cp-texto-suave, #6b5b4e)' }}>
            {diasParaVencer(config.sunat.vence_certificado) < 0
              ? `El certificado de SUNAT ya venció el ${fechaCorta(config.sunat.vence_certificado)}. Hay que cargar uno nuevo.`
              : `El certificado de SUNAT vence el ${fechaCorta(config.sunat.vence_certificado)} (en ${diasParaVencer(config.sunat.vence_certificado)} días). Renuévalo a tiempo.`}
          </div>
        )}
        {config && config.proveedor === 'SUNAT' && config.proveedor_efectivo !== 'SUNAT' && (
          <div role="alert" style={{ color: 'var(--cp-red, #b00020)', marginTop: 8, fontSize: 13 }}>
            Eligió SUNAT, pero faltan credenciales en el servidor: los comprobantes nuevos se emiten en simulado.
          </div>
        )}
        {config && esAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Proveedor
              <select value={formProveedor} onChange={(e) => setFormProveedor(e.target.value as ProveedorFacturacion)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }}>
                <option value="SIMULADO">Simulado (sin SUNAT)</option>
                <option value="SUNAT">SUNAT directo</option>
              </select>
            </label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              IGV (%)
              <input type="number" step="0.5" min={0} max={100} value={formIgv} onChange={(e) => setFormIgv(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Serie de boleta
              <input type="text" maxLength={4} value={formSerieB} onChange={(e) => setFormSerieB(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Serie de factura
              <input type="text" maxLength={4} value={formSerieF} onChange={(e) => setFormSerieF(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <Boton variante="oscuro" onClick={() => setConfirmarConfig(true)} style={{ minHeight: ALTO_TOQUE, flex: 1 }}>
                Guardar configuración
              </Boton>
              {config.proveedor === 'SUNAT' && (
                <Boton variante="secundario" onClick={enviarResumen} cargando={enviandoResumen} style={{ minHeight: ALTO_TOQUE, flex: 1 }}>
                  Enviar resumen de boletas
                </Boton>
              )}
            </div>
          </div>
        )}
        {errorConfig && <div role="alert" style={{ color: 'var(--cp-red, #b00020)', marginTop: 8 }}>{errorConfig}</div>}
      </section>

      {esAdmin && boleta && (
        <section aria-label="Boleta electrónica por defecto" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontWeight: 800 }}>Boleta electrónica por defecto</div>
          <p style={{ margin: 0, fontSize: 13 }}>
            Todo pedido lleva comprobante simple (por defecto, sin SUNAT), boleta o factura. Esta marca ya no cambia el valor
            inicial del selector: el mozo y Caja empiezan con Comprobante simple.
          </p>
          <div role="group" aria-label="Boleta electrónica por defecto" style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              aria-pressed={boleta.activo}
              onClick={() => !boleta.activo && setPropuestaBoleta(true)}
              style={{ minHeight: ALTO_TOQUE, minWidth: 96, borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: boleta.activo ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)', background: boleta.activo ? 'var(--cp-navy)' : 'var(--cp-white)', color: boleta.activo ? 'var(--cp-cream)' : 'var(--cp-navy)' }}
            >
              Sí
            </button>
            <button
              type="button"
              aria-pressed={!boleta.activo}
              onClick={() => boleta.activo && setPropuestaBoleta(false)}
              style={{ minHeight: ALTO_TOQUE, minWidth: 96, borderRadius: 10, fontWeight: 700, cursor: 'pointer', border: !boleta.activo ? '2px solid var(--cp-navy)' : '1.5px solid var(--cp-line)', background: !boleta.activo ? 'var(--cp-navy)' : 'var(--cp-white)', color: !boleta.activo ? 'var(--cp-cream)' : 'var(--cp-navy)' }}
            >
              No
            </button>
          </div>
          <div style={{ fontSize: 13 }}>
            {boleta.activo
              ? 'Sugerencia activa: el selector empieza con Boleta. Nunca sale un pedido sin boleta o factura.'
              : 'Desactivada: el selector empieza sin elegir; hay que elegir boleta o factura.'}
          </div>
          {errorBoleta && <div role="alert" style={{ color: 'var(--cp-red, #b00020)' }}>{errorBoleta}</div>}
        </section>
      )}

      {esAdmin && salud && (
        <div data-testid="contador-facturacion" role="status" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontWeight: 700 }}>
          <span>Pendientes: {salud.pendientes}</span>
          <span style={{ color: salud.con_problemas > 0 ? 'var(--cp-red, #b00020)' : undefined }}>Con problemas: {salud.con_problemas}</span>
          {salud.circuito_abierto && <span>SUNAT en pausa</span>}
          {salud.credenciales_invalidas && <span style={{ color: 'var(--cp-red, #b00020)' }}>Credenciales SUNAT inválidas</span>}
        </div>
      )}
      {aviso && <div role="status" style={{ fontWeight: 600 }}>{aviso}</div>}
      {error && <EstadoError mensaje={error} />}

      {cargando ? (
        <Cargando />
      ) : filas.length === 0 ? (
        <EstadoVacio titulo="Sin comprobantes electrónicos" descripcion="Aquí aparecen las boletas y facturas enviadas a SUNAT." />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filas.map((c) => {
            const estado = estadoDe(c);
            const puedeReintentar = esAdmin && (c.facturacion_estado === 'RECHAZADO' || c.facturacion_estado === 'PENDIENTE_ENVIO' || c.facturacion_estado === 'REVISION_MANUAL');
            const puedeAnular =
              esAdmin &&
              (c.facturacion_estado === 'EMITIDO_SUNAT' || c.facturacion_estado === 'PENDIENTE_RESUMEN') &&
              (!c.baja_estado || c.baja_estado === 'RECHAZADA');
            const puedeEmitirReal = esAdmin && c.simulado && !c.baja_estado;
            const tieneArchivos = c.emisor === 'SUNAT' && !c.simulado;
            return (
              <li key={c.id} data-testid={`electronico-${c.id}`} style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-line)', borderRadius: 14, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <strong>{tipoTexto(c.tipo)} {c.numero_texto}</strong>
                    <div style={{ fontSize: 13 }}>Pedido {c.codigo_pedido} · {c.fecha_lima} · {formatearSoles(c.total)}</div>
                    <div style={{ fontSize: 13 }}>{c.documento ? `Documento ${c.documento}` : 'Sin documento'}{c.razon_social ? ` · ${c.razon_social}` : ''}</div>
                  </div>
                  <Insignia variante={estado.variante}>{estado.texto}</Insignia>
                </div>
                {c.respuesta_sunat && <div style={{ fontSize: 12, marginTop: 6, wordBreak: 'break-word' }}>{c.respuesta_sunat}</div>}
                {c.baja_motivo && <div style={{ fontSize: 12, marginTop: 4 }}>Motivo de baja: {c.baja_motivo}</div>}
                {c.baja_estado === 'RECHAZADA' && <div style={{ fontSize: 12, marginTop: 4, color: 'var(--cp-red, #b00020)' }}>SUNAT rechazó la baja: revise la respuesta</div>}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  <Boton variante="secundario" onClick={() => verPdf(c)} style={{ minHeight: ALTO_TOQUE }}>
                    Ver PDF
                  </Boton>
                  {c.enlace_pdf && (
                    <a href={c.enlace_pdf} target="_blank" rel="noopener noreferrer" style={{ minHeight: ALTO_TOQUE, display: 'inline-flex', alignItems: 'center', padding: '0 14px', fontWeight: 700 }}>
                      Ver PDF
                    </a>
                  )}
                  {tieneArchivos && (
                    <>
                      <Boton variante="secundario" onClick={() => descargar(c, 'XML')} style={{ minHeight: ALTO_TOQUE }}>
                        XML firmado
                      </Boton>
                      {/* La constancia (CDR) existe solo cuando SUNAT ya respondió: en espera de resumen no hay nada que bajar */}
                      {!['PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'ENVIADA_RESUMEN'].includes(String(c.facturacion_estado)) && (
                        <Boton variante="secundario" onClick={() => descargar(c, 'CDR')} style={{ minHeight: ALTO_TOQUE }}>
                          CDR SUNAT
                        </Boton>
                      )}
                    </>
                  )}
                  {puedeReintentar && (
                    <Boton variante="secundario" onClick={() => abrirReintento(c)} style={{ minHeight: ALTO_TOQUE }}>
                      Reintentar
                    </Boton>
                  )}
                  {puedeEmitirReal && (
                    <Boton variante="primario" onClick={() => setRealDe(c)} style={{ minHeight: ALTO_TOQUE }}>
                      Emitir real
                    </Boton>
                  )}
                  {puedeAnular && (
                    <Boton variante="peligro" onClick={() => { setAnularDe(c); setMotivo(''); setErrorMotivo(null); }} style={{ minHeight: ALTO_TOQUE }}>
                      Anular
                    </Boton>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalPaginas > 1 && <Paginacion paginaActual={pagina} totalPaginas={totalPaginas} alCambiarPagina={(p) => cargar(p)} />}

      {esAdmin && problemas.length > 0 && (
        <section aria-label="Comprobantes con problemas" style={{ background: 'var(--cp-white)', border: '1px solid var(--cp-red, #b00020)', borderRadius: 16, padding: 16 }}>
          <strong>Con problemas ({problemas.length})</strong>
          <p style={{ fontSize: 13, margin: '4px 0 10px' }}>
            Rechazados por SUNAT, en revisión manual o pendientes de envío hace más de 15 minutos. Nada se borra: corrija los datos o reintente con el mismo número.
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {problemas.map((c) => {
              const estado = estadoDe(c);
              return (
                <li key={`problema-${c.id}`} data-testid={`problema-${c.id}`} style={{ borderTop: '1px solid var(--cp-line)', paddingTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <strong>{tipoTexto(c.tipo)} {c.numero_texto}</strong>
                    <Insignia variante={estado.variante}>{estado.texto}</Insignia>
                  </div>
                  {(c.revision_motivo || c.respuesta_sunat) && (
                    <div style={{ fontSize: 12, marginTop: 4, wordBreak: 'break-word' }}>{c.revision_motivo || c.respuesta_sunat}</div>
                  )}
                  <div style={{ marginTop: 8 }}>
                    <Boton variante="secundario" onClick={() => abrirReintento(c)} style={{ minHeight: ALTO_TOQUE }}>
                      {accionDe(c)}
                    </Boton>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Confirmar
        abierto={propuestaBoleta !== null}
        titulo="Boleta electrónica por defecto"
        mensaje={
          propuestaBoleta
            ? 'El selector del mozo y de Caja empezará con Boleta como sugerencia (sin obligar a confirmarla). ¿Activarlo?'
            : 'El selector del mozo y de Caja empezará sin elegir: habrá que elegir boleta o factura. ¿Desactivarlo?'
        }
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardandoBoleta}
        alConfirmar={guardarBoleta}
        alCancelar={() => setPropuestaBoleta(null)}
      />
      <Confirmar
        abierto={confirmarConfig}
        titulo="Guardar configuración de facturación"
        mensaje={`¿Guardar proveedor ${NOMBRE_PROVEEDOR[formProveedor]}, IGV ${formIgv}%, serie de boleta ${formSerieB.toUpperCase()} y serie de factura ${formSerieF.toUpperCase()}? Los comprobantes nuevos usarán estos datos.${formProveedor === 'SUNAT' && config?.proveedor !== 'SUNAT' && !config?.facturacion_desde ? ' Al pasar a SUNAT se fija la fecha de corte: los pedidos cobrados antes no se emiten.' : ''}`}
        textoSi="Sí, guardar"
        textoNo="No"
        cargando={guardandoConfig}
        alConfirmar={guardarConfig}
        alCancelar={() => setConfirmarConfig(false)}
      />

      <Confirmar
        abierto={reintentarDe !== null}
        titulo="Reintentar el envío"
        mensaje={reintentarDe ? `¿Reenviar ${reintentarDe.numero_texto} a SUNAT con estos datos? Se usa el mismo número.` : undefined}
        textoSi="Sí, reintentar"
        textoNo="No"
        cargando={ocupado}
        alConfirmar={confirmarReintento}
        alCancelar={() => setReintentarDe(null)}
      >
        {reintentarDe && esTemporal0133(reintentarDe) && (
          <div style={{ fontSize: 13, marginTop: 8 }}>Falla temporal de SUNAT (0133): no es un rechazo del comprobante, puedes reintentar tal cual.</div>
        )}
        {reintentarDe && reintentarDe.facturacion_estado === 'REVISION_MANUAL' && reintentarDe.revision_motivo && (
          <div style={{ fontSize: 13, marginTop: 8, wordBreak: 'break-word' }}>Motivo: {reintentarDe.revision_motivo}</div>
        )}
        {(reintentarDe?.facturacion_estado === 'RECHAZADO' || reintentarDe?.facturacion_estado === 'REVISION_MANUAL') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Documento (DNI o RUC)
              <input type="text" value={corrDoc} onChange={(e) => setCorrDoc(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
            <Boton variante="secundario" onClick={buscarRuc} disabled={buscandoRuc || !puedeBuscar} style={{ minHeight: ALTO_TOQUE }}>
              {buscandoRuc ? 'Buscando…' : 'Buscar por DNI o RUC'}
            </Boton>
            {errorRuc && (
              <div role="alert" style={{ color: 'var(--cp-rust, #b00020)', fontSize: 12, fontWeight: 700 }}>
                {errorRuc}
              </div>
            )}
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Razón social
              <input type="text" value={corrRazon} onChange={(e) => setCorrRazon(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
            <label style={{ fontWeight: 700, fontSize: 13 }}>
              Dirección (opcional)
              <input type="text" value={corrDir} onChange={(e) => setCorrDir(e.target.value)} style={{ display: 'block', width: '100%', minHeight: ALTO_TOQUE, marginTop: 4, fontWeight: 400 }} />
            </label>
          </div>
        )}
      </Confirmar>

      <Confirmar
        abierto={realDe !== null}
        titulo="Emitir comprobante real"
        mensaje={realDe ? `Se anulará el simulado ${realDe.numero_texto} y se emitirá uno nuevo a SUNAT con la fecha de hoy; no se puede deshacer.` : undefined}
        textoSi="Sí, emitir real"
        textoNo="No"
        peligro
        cargando={ocupado}
        alConfirmar={confirmarEmitirReal}
        alCancelar={() => setRealDe(null)}
      />

      <Confirmar
        abierto={anularDe !== null}
        titulo="Anular comprobante"
        mensaje={anularDe ? `¿Dar de baja ${anularDe.numero_texto} ante SUNAT? Nada se borra: queda el motivo y la respuesta.` : undefined}
        textoSi="Sí, anular"
        textoNo="No"
        peligro
        cargando={ocupado}
        alConfirmar={confirmarAnulacion}
        alCancelar={() => setAnularDe(null)}
      >
        <label style={{ fontWeight: 700, fontSize: 13, display: 'block', marginTop: 8 }}>
          Motivo (obligatorio)
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, fontWeight: 400 }} />
        </label>
        {errorMotivo && <div role="alert" style={{ color: 'var(--cp-red, #b00020)', marginTop: 6 }}>{errorMotivo}</div>}
      </Confirmar>
    </div>
  );
}
