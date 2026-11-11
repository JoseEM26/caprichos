import { useId, useState } from 'react';
import { InsigniaVersion, textoFecha, type VersionPublicada } from './versionPrograma';
import './comandos-utiles.css';

/** Nombre real del archivo que descarga el panel (lo fija la API: PROGRAMAS.windows.nombre). */
export const NOMBRE_EXE_WINDOWS = 'agente-impresion-windows.exe';
export const CLAVE_COMANDOS_ABIERTO = 'cp-impresion-comandos-abierto';

const leerAbierto = (): boolean => {
  try {
    return localStorage.getItem(CLAVE_COMANDOS_ABIERTO) !== '0'; // la primera vez se muestra abierta
  } catch {
    return true;
  }
};

/** Comando en bloque monoespaciado + botón Copiar con confirmación visible y anunciada a lectores de pantalla. */
function TarjetaComando({ texto }: { texto: string }) {
  const [estado, setEstado] = useState<'' | 'ok' | 'error'>('');
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setEstado('ok');
    } catch {
      setEstado('error'); // sin permiso de portapapeles: el texto queda seleccionable
    }
    setTimeout(() => setEstado(''), 2000);
  };
  return (
    <div className="cu-cmd">
      <pre className="cu-pre" data-testid="comando-util" tabIndex={0}><code>{texto}</code></pre>
      <button type="button" className="cola-btn cu-copiar" onClick={copiar} aria-label={`Copiar el comando ${texto}`}>
        {estado === 'ok' ? 'Copiado ✔' : 'Copiar'}
      </button>
      <span role="status" className="cu-sr">{estado === 'ok' ? 'Comando copiado' : estado === 'error' ? 'No se pudo copiar; selecciona el texto y cópialo a mano' : ''}</span>
      {estado === 'error' && <span className="cu-error" aria-hidden="true">Selecciona el texto y cópialo</span>}
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="cu-tarjeta" aria-label={titulo}>
      <h4 className="cu-titulo">{titulo}</h4>
      {children}
    </section>
  );
}

/** Sección plegable «Comandos útiles y cómo actualizar» junto a la descarga del programa para Windows. */
export function ComandosUtiles({ ultima, instalada }: { ultima?: VersionPublicada | null; instalada?: string | null }) {
  const [abierto, setAbierto] = useState(leerAbierto);
  const id = useId();
  const alternar = () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    try {
      localStorage.setItem(CLAVE_COMANDOS_ABIERTO, nuevo ? '1' : '0');
    } catch { /* sin almacenamiento: no se recuerda */ }
  };
  const exe = NOMBRE_EXE_WINDOWS;
  return (
    <div className="cu-seccion" data-testid="comandos-utiles">
      <button type="button" className="cola-btn cu-cab" aria-expanded={abierto} aria-controls={id} onClick={alternar}>
        <span>Comandos útiles y cómo actualizar</span>
        <span aria-hidden="true">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && (
        <div id={id} className="cu-cuerpo">
          <p className="cu-aviso" role="note">
            Antes de abrir una versión nueva, ciérrala siempre: dos copias a la vez pueden imprimir doble.
          </p>
          <p className="cola-ayuda" data-testid="comandos-versiones">
            {instalada ? <InsigniaVersion instalada={instalada} ultima={ultima} /> : <>Para ver la versión que tienes instalada usa <code>--version</code>.</>}{' '}
            {ultima ? <span>Última disponible: v{ultima.version}{textoFecha(ultima.fecha) ? ` (${textoFecha(ultima.fecha)})` : ''}.</span> : null}
          </p>
          <Tarjeta titulo="Actualizar la versión (3 pasos)">
            <ol className="cu-pasos">
              <li>Cierra TODAS las copias. En una ventana de comandos en la carpeta del programa escribe:</li>
            </ol>
            <TarjetaComando texto={`${exe} --detener-todo`} />
            <ol className="cu-pasos" start={2}>
              <li>Reemplaza el archivo de la carpeta fija (por ejemplo <code>C:\Caprichos</code>) por el recién descargado.</li>
              <li>Ábrelo UNA vez (doble clic): queda en segundo plano y arranca solo con Windows.</li>
            </ol>
          </Tarjeta>
          <Tarjeta titulo="Ver el estado y la versión">
            <TarjetaComando texto={`${exe} --estado`} />
          </Tarjeta>
          <Tarjeta titulo="¿Cuántas copias hay corriendo?">
            <TarjetaComando texto={`${exe} --copias`} />
          </Tarjeta>
          <Tarjeta titulo="Cerrar todas las copias">
            <TarjetaComando texto={`${exe} --detener-todo`} />
          </Tarjeta>
          <Tarjeta titulo="Ver solo la versión">
            <TarjetaComando texto={`${exe} --version`} />
          </Tarjeta>
          <Tarjeta titulo="Quitar o activar el inicio con Windows">
            <TarjetaComando texto={`${exe} autoinicio desactivar`} />
            <TarjetaComando texto={`${exe} autoinicio activar`} />
          </Tarjeta>
          <Tarjeta titulo="Cómo abrir una ventana de comandos en esa carpeta">
            <ol className="cu-pasos">
              <li>Abre la carpeta del programa (por ejemplo <code>C:\Caprichos</code>).</li>
              <li>Haz clic en la barra de direcciones de arriba, escribe <code>cmd</code> y pulsa Enter.</li>
              <li>Pega ahí el comando que necesites (clic derecho o Ctrl+V) y pulsa Enter.</li>
            </ol>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
