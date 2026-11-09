import { useEffect, useState } from 'react';
import { textoFecha, type VersionPublicada } from './versionPrograma';
import { useSesion } from '../../comun/sesion';
import { impresionApi } from './impresionApi';
import './cola-impresion.css';

export const URL_DESCARGA_WINDOWS = '/api/agente-impresion/descargar/windows';
export const URL_DESCARGA_LINUX = '/api/agente-impresion/descargar/linux';

type Sistema = 'windows' | 'linux';

function sistemaDetectado(): Sistema {
  const plataforma = (navigator as any).userAgentData?.platform || navigator.userAgent || '';
  return /linux/i.test(plataforma) && !/android/i.test(navigator.userAgent) ? 'linux' : 'windows';
}

/** Bloque de comando con botón Copiar. */
function Comando({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch { /* sin permiso de portapapeles: el texto queda seleccionable */ }
  };
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 0' }}>
      <pre data-testid="comando" style={{ flex: 1, margin: 0, padding: 8, background: '#0001', borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'all' }}>{texto}</pre>
      <button type="button" className="cola-btn" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}

/** Instalar el programa del local (Windows o Linux): descarga, código de un solo uso y elegir las dos máquinas. */
export function PanelInstalarPrograma({ alCerrar, incrustado = false }: { alCerrar: () => void; incrustado?: boolean }) {
  const { usuario } = useSesion();
  const esAdmin = (usuario?.rol || '').toUpperCase() === 'ADMIN';
  const [codigo, setCodigo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [sistema, setSistema] = useState<Sistema>(sistemaDetectado);
  const [nombrePc, setNombrePc] = useState('');
  const [descargando, setDescargando] = useState(false);
  const origen = window.location.origin;
  const [ultima, setUltima] = useState<VersionPublicada | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => impresionApi.ultimaVersionPrograma()).then((r) => setUltima(r?.publicada ?? null)).catch(() => {});
  }, []);

  const descargarVinculado = async () => {
    setError('');
    setDescargando(true);
    try {
      const blob = await impresionApi.descargarProgramaVinculado(nombrePc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'programa-impresion-caprichos.zip';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e: any) {
      setError(e?.message || 'No se pudo descargar el programa');
    } finally {
      setDescargando(false);
    }
  };

  const generar = async () => {
    setError('');
    try {
      setCodigo((await impresionApi.generarCodigoVinculo()).codigo);
    } catch (e: any) {
      setError(e?.message || 'No se pudo generar el código');
    }
  };

  return (
    <div className={incrustado ? 'ci-incr' : 'cola-fondo'} style={incrustado ? undefined : { zIndex: 6000 }} onClick={incrustado ? undefined : alCerrar}>
      <div
        className={incrustado ? 'ci-incr-cuerpo' : 'cola-panel'}
        role={incrustado ? 'region' : 'dialog'}
        aria-modal={incrustado ? undefined : true}
        aria-label="Instalar programa de impresión"
        onClick={incrustado ? undefined : (e) => e.stopPropagation()}
      >
        {!incrustado && (
          <div className="cola-cab">
            <h2>Instalar programa de impresión</h2>
            <button type="button" className="cola-btn" onClick={alCerrar}>Cerrar</button>
          </div>
        )}
        <p className="cola-ayuda">
          Se instala una vez en la PC donde están conectadas la etiquetera y la ticketera. El navegador no puede ver impresoras USB; este programa sí.
        </p>
        {ultima && (
          <p className="cola-ayuda" data-testid="ultima-version">
            Última: v{ultima.version}{textoFecha(ultima.fecha) ? `, publicada el ${textoFecha(ultima.fecha)}` : ''}
          </p>
        )}
        <div role="tablist" style={{ display: 'flex', gap: 8, margin: '8px 0' }}>
          {(['windows', 'linux'] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={sistema === s} className="cola-btn"
              style={{ fontWeight: sistema === s ? 800 : 400 }} onClick={() => setSistema(s)}>
              {s === 'windows' ? 'Windows' : 'Linux'}
            </button>
          ))}
        </div>
        {sistema === 'windows' && esAdmin && (
          <div style={{ border: '2px solid #0003', borderRadius: 10, padding: 12, margin: '8px 0' }}>
            <label style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
              Nombre de la PC (opcional, ej. Caja, Bebidas)
              <input value={nombrePc} onChange={(e) => setNombrePc(e.target.value)} maxLength={60}
                style={{ display: 'block', width: '100%', marginTop: 4, padding: 8 }} />
            </label>
            <button type="button" className="cola-btn" disabled={descargando} onClick={descargarVinculado}
              style={{ width: '100%', fontSize: 16, fontWeight: 800, padding: '12px 8px' }}>
              {descargando ? 'Preparando...' : 'Descargar el programa ya vinculado (esta PC)'}
            </button>
            <ol style={{ lineHeight: '22px', fontSize: 14, paddingLeft: 20, margin: '8px 0 0' }}>
              <li>Descomprime la carpeta.</li>
              <li>Doble clic, una sola vez, en agente-impresion-windows.exe.</li>
              <li>Listo: queda funcionando en segundo plano, sin ventana, y arranca solo cada vez que prendas la PC. No hay que dejar nada abierto.</li>
            </ol>
            <p className="cola-ayuda" style={{ margin: '6px 0 0' }}>
              Para ver si está funcionando: abre una ventana de comandos en esa carpeta y escribe <code>agente-impresion-windows.exe --estado</code>. Para detenerlo: <code>--detener</code>.
            </p>
            <p className="cola-ayuda" style={{ margin: '6px 0 0' }}>
              Cuidado: la carpeta lleva una llave secreta de esta PC. No la compartas ni la envíes por WhatsApp o correo.
            </p>
            <p className="cola-ayuda" style={{ margin: '6px 0 0' }}>
              Si prefieres el método anterior, usa el código de vinculación de abajo.
            </p>
          </div>
        )}
        {sistema === 'windows' ? (
          <ol style={{ lineHeight: '24px', fontSize: 14, paddingLeft: 20 }}>
            <li>
              Descarga e instala:{' '}
              <a href={URL_DESCARGA_WINDOWS} download style={{ fontWeight: 800 }}>
                Descargar el programa de impresión para Windows
              </a>
            </li>
            <li>
              Ábrelo y pega este código de vinculación (vale 15 minutos y se usa una sola vez):
            <div style={{ margin: '8px 0' }}>
              {codigo ? (
                <code data-testid="codigo-vinculo" style={{ fontSize: 18, fontWeight: 800, userSelect: 'all' }}>{codigo}</code>
              ) : esAdmin ? (
                <button type="button" className="cola-btn" onClick={generar}>Generar código de vinculación</button>
              ) : (
                <em>Pídele al administrador que genere el código.</em>
              )}
            </div>
            </li>
            <li>Elige cuál es la etiquetera y cuál la ticketera.</li>
            <li>
              Listo: el programa pasa solo a segundo plano (sin ventana) y arranca cada vez que prendas la PC. Para verlo: <code>agente-impresion-windows.exe --estado</code>; para detenerlo: <code>--detener</code>.
            </li>
          </ol>
        ) : (
          <ol style={{ lineHeight: '24px', fontSize: 14, paddingLeft: 20 }}>
            <li>
              Descarga el programa:
              <Comando texto={`curl -fL ${origen}${URL_DESCARGA_LINUX} -o ~/caprichos-impresion && chmod +x ~/caprichos-impresion`} />
            </li>
            <li>
              Permiso de la impresora USB (cierra sesión y vuelve a entrar después):
              <Comando texto="sudo usermod -aG lp $USER" />
              Verifica que aparecen la etiquetera y la ticketera (lp0, lp1):
              <Comando texto="ls -l /dev/usb/lp*" />
            </li>
            <li>
              Vincula y elige las impresoras con este código (vale 15 minutos y se usa una sola vez):
            <div style={{ margin: '8px 0' }}>
              {codigo ? (
                <code data-testid="codigo-vinculo" style={{ fontSize: 18, fontWeight: 800, userSelect: 'all' }}>{codigo}</code>
              ) : esAdmin ? (
                <button type="button" className="cola-btn" onClick={generar}>Generar código de vinculación</button>
              ) : (
                <em>Pídele al administrador que genere el código.</em>
              )}
            </div>
              <Comando texto="~/caprichos-impresion configurar" />
            </li>
            <li>
              Listo: queda en segundo plano y arranca solo cada vez que inicies sesión en esa PC (no hay que dejar la terminal abierta). Ver cómo va:
              <Comando texto="~/caprichos-impresion --estado" />
              Detenerlo, ver el registro o quitar el arranque automático:
              <Comando texto="~/caprichos-impresion --detener   # también --ver-logs, --quitar-inicio" />
            </li>
          </ol>
        )}
        {error && <p role="alert" style={{ color: 'var(--cp-rust, #B2500F)' }}>{error}</p>}
      </div>
    </div>
  );
}
