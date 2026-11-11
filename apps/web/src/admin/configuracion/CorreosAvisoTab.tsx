import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ErrorApi } from '../../comun/api';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { Insignia } from '../../comun/Insignia';
import { Pestanas } from '../../comun/ModalConPestanas';
import { createPortal } from 'react-dom';
import { useDialogoAccesible } from '../../comun/useDialogoAccesible';
import { CampoConfig } from './CampoConfig';
import { CampoAyuda } from './AyudaCampo';
import '../../comun/modal-pestanas.css';
import './correos-aviso.css';

interface TipoAviso { id: string; nombre: string; ayuda: string }
interface CorreoExtra { id: string; correo: string; etiqueta: string | null; activo: boolean; tipos: string[] }
interface PersonaUsuario { nombre: string; rol: string; correo: string | null; tipos: string[]; soloSiDeTurno: boolean }
interface Datos {
  maximo: number;
  correoConfigurado: boolean;
  tipos: TipoAviso[];
  correos: CorreoExtra[];
  personasPorUsuario: PersonaUsuario[];
}

export const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Parámetros de esta pestaña: [clave, mínimo, máximo, defecto]. */
export const PARAMETROS_CORREOS = {
  aviso_pc_impresion_minutos_tras_abrir: [5, 120, 20],
  aviso_pc_impresion_recordatorio_min: [15, 240, 60],
  aviso_chat_sin_responder_min: [5, 120, 15],
} as const;
type ClaveNumerica = keyof typeof PARAMETROS_CORREOS;
type ClaveSwitch = 'aviso_pc_impresion_activo' | 'aviso_chat_sin_responder_activo';

const msg = (e: unknown, defecto: string) => (e instanceof ErrorApi ? e.message : defecto);

/** Configuración › Correos de aviso (solo ADMIN): correos extra, quién recibe por su usuario y cuándo se avisa. */
export function CorreosAvisoTab() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    try {
      setDatos(await api.get<Datos>('/admin/correos-aviso'));
      setError(null);
    } catch (e) {
      setError(msg(e, 'No se pudo cargar la lista de correos.'));
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  if (error && !datos) {
    return (
      <div role="alert" className="cav-aviso cav-aviso-error">
        {error} <Boton variante="secundario" tamano="pequeno" onClick={() => void cargar()}>Reintentar</Boton>
      </div>
    );
  }
  if (!datos) return <p role="status" className="cav-vacio">Cargando…</p>;

  return (
    <div className="cav">
      {!datos.correoConfigurado && (
        <div role="status" className="cav-aviso" data-testid="correo-no-configurado">
          El envío de correos no está configurado en este ambiente. Puedes dejar todo listo aquí, pero por ahora los avisos no llegan a ninguna bandeja.
        </div>
      )}
      <Pestanas
        etiqueta="Correos de aviso"
        pestanas={[
          { id: 'extra', etiqueta: 'Correos extra', insignia: datos.correos.length, contenido: <ListaExtra datos={datos} alCambiar={cargar} /> },
          { id: 'usuarios', etiqueta: 'Por su usuario', insignia: datos.personasPorUsuario.length, contenido: <PorUsuario personas={datos.personasPorUsuario} /> },
          { id: 'cuando', etiqueta: 'Cuándo se avisa', contenido: <CuandoSeAvisa /> },
        ]}
      />
    </div>
  );
}

// ------------------------------------------------------------------ correos extra
function ListaExtra({ datos, alCambiar }: { datos: Datos; alCambiar: () => Promise<void> }) {
  const [editando, setEditando] = useState<CorreoExtra | 'nuevo' | null>(null);
  const [quitar, setQuitar] = useState<CorreoExtra | null>(null);
  const [errorQuitar, setErrorQuitar] = useState<string | null>(null);
  const [quitando, setQuitando] = useState(false);
  const [estado, setEstado] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [probando, setProbando] = useState<string | null>(null);
  const nombreTipo = (id: string) => datos.tipos.find((t) => t.id === id)?.nombre ?? id;

  const probar = async (c: CorreoExtra) => {
    setProbando(c.id);
    setEstado(null);
    try {
      const r = await api.post<{ correoConfigurado: boolean; fallido: boolean }>(`/admin/correos-aviso/${c.id}/prueba`);
      setEstado({
        tipo: r.fallido ? 'error' : 'ok',
        texto: r.fallido
          ? 'No se pudo enviar la prueba. Revisa que el correo esté bien escrito.'
          : r.correoConfigurado
            ? `Prueba enviada a ${c.correo}. Revisa su bandeja en un minuto.`
            : 'El envío de correos no está configurado: la prueba quedó registrada pero no salió a ninguna bandeja.',
      });
    } catch (e) {
      setEstado({ tipo: 'error', texto: msg(e, 'No se pudo enviar la prueba.') });
    } finally {
      setProbando(null);
    }
  };

  const confirmarQuitar = async () => {
    if (!quitar) return;
    setQuitando(true);
    setErrorQuitar(null);
    try {
      await api.delete(`/admin/correos-aviso/${quitar.id}`);
      setQuitar(null);
      await alCambiar();
    } catch (e) {
      setErrorQuitar(msg(e, 'No se pudo quitar el correo.'));
    } finally {
      setQuitando(false);
    }
  };

  const alternar = async (c: CorreoExtra) => {
    setEstado(null);
    try {
      await api.patch(`/admin/correos-aviso/${c.id}`, { activo: !c.activo });
      await alCambiar();
    } catch (e) {
      setEstado({ tipo: 'error', texto: msg(e, 'No se pudo cambiar el estado.') });
    }
  };

  const lleno = datos.correos.length >= datos.maximo;
  return (
    <CampoConfig id="correos-lista">
      <div className="cav-cabecera">
        <p className="cav-texto">
          Estos correos reciben avisos del sistema sin necesidad de crear un usuario. Se suman a las personas que ya los reciben por su usuario.
        </p>
        <Boton onClick={() => setEditando('nuevo')} disabled={lleno} aria-describedby={lleno ? 'cav-lleno' : undefined}>
          Agregar correo
        </Boton>
      </div>
      {lleno && <p id="cav-lleno" className="cav-texto">Llegaste al máximo de {datos.maximo} correos. Quita alguno para agregar otro.</p>}
      {estado && (
        <div role={estado.tipo === 'error' ? 'alert' : 'status'} className={`cav-aviso ${estado.tipo === 'error' ? 'cav-aviso-error' : 'cav-aviso-ok'}`}>
          {estado.texto}
        </div>
      )}
      {datos.correos.length === 0 ? (
        <p className="cav-vacio">Todavía no hay correos extra. Usa «Agregar correo» para sumar a tu contador o a un socio.</p>
      ) : (
        <ul className="cav-lista" aria-label="Correos extra">
          {datos.correos.map((c) => (
            <li key={c.id} className={`cav-fila ${c.activo ? '' : 'cav-inactivo'}`}>
              <div className="cav-fila-datos">
                <strong className="cav-correo">{c.correo}</strong>
                {c.etiqueta && <span className="cav-etiqueta">{c.etiqueta}</span>}
                <Insignia variante={c.activo ? 'exito' : 'neutro'}>{c.activo ? 'Activo' : 'En pausa'}</Insignia>
                <div className="cav-tipos">
                  {c.tipos.length === 0 ? <span className="cav-etiqueta">Sin tipos marcados: no recibe nada</span> : c.tipos.map((t) => <Insignia key={t} variante="acento">{nombreTipo(t)}</Insignia>)}
                </div>
              </div>
              <div className="cav-acciones">
                <Boton variante="secundario" tamano="pequeno" onClick={() => setEditando(c)} aria-label={`Editar ${c.correo}`}>Editar</Boton>
                <Boton variante="secundario" tamano="pequeno" cargando={probando === c.id} onClick={() => void probar(c)} aria-label={`Enviar correo de prueba a ${c.correo}`}>
                  Enviar correo de prueba
                </Boton>
                <Boton variante="secundario" tamano="pequeno" onClick={() => void alternar(c)} aria-label={`${c.activo ? 'Pausar' : 'Activar'} ${c.correo}`}>
                  {c.activo ? 'Pausar' : 'Activar'}
                </Boton>
                <Boton variante="peligro" tamano="pequeno" onClick={() => { setErrorQuitar(null); setQuitar(c); }} aria-label={`Quitar ${c.correo}`}>Quitar</Boton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editando && (
        <ModalCorreo
          inicial={editando === 'nuevo' ? null : editando}
          tipos={datos.tipos}
          alCerrar={() => setEditando(null)}
          alGuardar={async () => { setEditando(null); await alCambiar(); }}
        />
      )}
      <Confirmar
        abierto={!!quitar}
        titulo="¿Quitar este correo?"
        mensaje={quitar ? `${quitar.correo} dejará de recibir avisos.` : ''}
        textoSi="Sí, quitar"
        textoNo="No, dejarlo"
        peligro
        cargando={quitando}
        error={errorQuitar}
        alConfirmar={confirmarQuitar}
        alCancelar={() => setQuitar(null)}
      />
    </CampoConfig>
  );
}

function ModalCorreo({ inicial, tipos, alCerrar, alGuardar }: {
  inicial: CorreoExtra | null; tipos: TipoAviso[]; alCerrar: () => void; alGuardar: () => Promise<void>;
}) {
  const [correo, setCorreo] = useState(inicial?.correo ?? '');
  const [etiqueta, setEtiqueta] = useState(inicial?.etiqueta ?? '');
  const [activo, setActivo] = useState(inicial?.activo ?? true);
  const [marcados, setMarcados] = useState<string[]>(inicial?.tipos ?? []);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const alTeclear = useDialogoAccesible(ref, alCerrar, guardando);

  const correoNorm = correo.trim().toLowerCase();
  const falla = !CORREO_VALIDO.test(correoNorm) ? 'Escribe un correo válido, por ejemplo nombre@dominio.com' : null;
  const alternarTipo = (t: string) => setMarcados((m) => (m.includes(t) ? m.filter((x) => x !== t) : [...m, t]));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntento(true);
    if (falla) return;
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = { correo: correoNorm, etiqueta: etiqueta.trim() || null, activo, tipos: marcados };
      if (inicial) await api.patch(`/admin/correos-aviso/${inicial.id}`, cuerpo);
      else await api.post('/admin/correos-aviso', cuerpo);
      await alGuardar();
    } catch (err) {
      setError(msg(err, 'No se pudo guardar.'));
      setGuardando(false);
    }
  };

  return createPortal(
    <>
      <div className="mcp-fondo" onClick={guardando ? undefined : alCerrar} />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={`${id}-t`} className="mcp-dialogo cav-modal" onKeyDown={alTeclear} tabIndex={-1}>
        <form onSubmit={guardar} noValidate className="cav-modal-form">
          <div className="mcp-cabecera">
            <div className="mcp-titulos"><h2 id={`${id}-t`} className="mcp-titulo">{inicial ? 'Editar correo' : 'Agregar correo'}</h2></div>
            <button type="button" className="mcp-cerrar" onClick={alCerrar} disabled={guardando} aria-label="Cerrar">×</button>
          </div>
          <div className="mcp-cuerpo cav-modal-cuerpo">
            <label className="cav-campo" htmlFor={`${id}-correo`}>
              <span>Correo</span>
              <input id={`${id}-correo`} type="email" autoComplete="off" value={correo} data-foco-inicial="" onChange={(e) => setCorreo(e.target.value)}
                aria-invalid={intento && !!falla} aria-describedby={intento && falla ? `${id}-err` : undefined} placeholder="ejemplo@prueba.test" />
              {intento && falla && <span id={`${id}-err`} role="alert" className="cav-error">{falla}</span>}
            </label>
            <label className="cav-campo" htmlFor={`${id}-et`}>
              <span>Nombre o rol (opcional)</span>
              <input id={`${id}-et`} type="text" maxLength={60} value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} placeholder="Contador, Socio…" />
            </label>
            <fieldset className="cav-tipos-campo">
              <legend>Qué avisos recibe</legend>
              {tipos.map((t) => (
                <label key={t.id} className="cav-check">
                  <input type="checkbox" checked={marcados.includes(t.id)} onChange={() => alternarTipo(t.id)} />
                  <span><strong>{t.nombre}</strong><small>{t.ayuda}</small></span>
                </label>
              ))}
            </fieldset>
            <label className="cav-check">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              <span><strong>Activo</strong><small>Si lo pausas, el correo se guarda pero no recibe nada.</small></span>
            </label>
            {error && <div role="alert" className="cav-aviso cav-aviso-error">{error}</div>}
          </div>
          <div className="mcp-pie">
            <Boton type="button" variante="secundario" onClick={alCerrar} disabled={guardando}>Cancelar</Boton>
            <Boton type="submit" cargando={guardando}>Guardar</Boton>
          </div>
        </form>
      </div>
    </>,
    document.body,
  );
}

// ------------------------------------------------------------------ por su usuario (solo lectura)
function PorUsuario({ personas }: { personas: PersonaUsuario[] }) {
  return (
    <CampoConfig id="correos-personas-usuario">
      <p className="cav-texto">
        Estas personas reciben <strong>todos</strong> los avisos porque en Usuarios tienen marcada la casilla «Recibir avisos del sistema por correo». Les llegan cuando están de turno
        (o a las personas con horario 24/7 si nadie está de turno). Aquí solo se ven; para cambiarlo ve a <Link to="/admin/usuarios">Usuarios</Link>.
      </p>
      {personas.length === 0 ? (
        <p className="cav-vacio">Nadie tiene la casilla marcada todavía.</p>
      ) : (
        <ul className="cav-lista" aria-label="Personas que reciben avisos por su usuario">
          {personas.map((p, i) => (
            <li key={`${p.nombre}-${i}`} className="cav-fila">
              <div className="cav-fila-datos">
                <strong>{p.nombre}</strong>
                <Insignia>{p.rol}</Insignia>
                <span className="cav-etiqueta">{p.correo ?? 'Sin correo registrado: no le llega nada'}</span>
                <span className="cav-etiqueta">Todos los avisos · {p.soloSiDeTurno ? 'cuando está de turno' : 'horario 24/7'}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </CampoConfig>
  );
}

// ------------------------------------------------------------------ cuándo se avisa
function CuandoSeAvisa() {
  const [valores, setValores] = useState<Record<string, unknown>>({});
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      setValores(Object.fromEntries((Array.isArray(lista) ? lista : []).map((p) => [p.clave, p.valor])));
    } catch (e) {
      setError(msg(e, 'No se pudieron leer los ajustes.'));
    } finally {
      setCargado(true);
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  if (!cargado) return <p role="status" className="cav-vacio">Cargando…</p>;

  return (
    <div className="cav-params">
      {error && <div role="alert" className="cav-aviso cav-aviso-error">{error}</div>}
      <Grupo
        titulo="Computadoras de impresión sin conectar"
        descripcion="Después de abrir la caja, se revisa si todas las computadoras de impresión están en línea. Si falta alguna, llega un correo (y un solo recordatorio más)."
      >
        <Interruptor clave="aviso_pc_impresion_activo" cfg="correos-aviso-pc-activo" etiqueta="Avisar de computadoras sin conectar" valor={valores.aviso_pc_impresion_activo} />
        <Numero clave="aviso_pc_impresion_minutos_tras_abrir" cfg="correos-aviso-pc-minutos" etiqueta="Minutos después de abrir la caja" ayuda="Cuánto esperar tras abrir la caja antes de revisar." valor={valores.aviso_pc_impresion_minutos_tras_abrir} />
        <Numero clave="aviso_pc_impresion_recordatorio_min" cfg="correos-aviso-pc-recordatorio" etiqueta="Minutos para el recordatorio" ayuda="Si sigue sin conectarse, se avisa una vez más pasado este tiempo." valor={valores.aviso_pc_impresion_recordatorio_min} />
      </Grupo>
      <Grupo
        titulo="Chat de WhatsApp sin responder"
        descripcion="Si un cliente espera a una persona más tiempo del indicado, llega un correo con un enlace al chat. Solo dentro del horario del local."
      >
        <Interruptor clave="aviso_chat_sin_responder_activo" cfg="correos-aviso-chat-activo" etiqueta="Avisar de chats sin responder" valor={valores.aviso_chat_sin_responder_activo} />
        <Numero clave="aviso_chat_sin_responder_min" cfg="correos-aviso-chat-minutos" etiqueta="Minutos de espera antes de avisar" ayuda="Tiempo que el cliente espera sin que una persona le responda." valor={valores.aviso_chat_sin_responder_min} />
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <section className="cav-grupo">
      <h3>{titulo}</h3>
      <p className="cav-texto">{descripcion}</p>
      {children}
    </section>
  );
}

function Interruptor({ clave, cfg, etiqueta, valor }: { clave: ClaveSwitch; cfg: string; etiqueta: string; valor: unknown }) {
  const [encendido, setEncendido] = useState(!(valor === 'no' || valor === false));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cambiar = async (nuevo: boolean) => {
    setGuardando(true);
    setError(null);
    try {
      await api.put(`/admin/configuracion/${clave}`, { valor: nuevo ? 'si' : 'no' });
      setEncendido(nuevo);
    } catch (e) {
      setError(msg(e, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <CampoConfig id={cfg}>
      <label className="cav-check">
        <input type="checkbox" role="switch" checked={encendido} disabled={guardando} onChange={(e) => void cambiar(e.target.checked)} />
        <span><strong>{etiqueta}</strong><small>{encendido ? 'Encendido' : 'Apagado: no se manda este correo'}</small></span>
      </label>
      {error && <div role="alert" className="cav-error">{error}</div>}
    </CampoConfig>
  );
}

function Numero({ clave, cfg, etiqueta, ayuda, valor }: { clave: ClaveNumerica; cfg: string; etiqueta: string; ayuda: string; valor: unknown }) {
  const [min, max, defecto] = PARAMETROS_CORREOS[clave];
  const inicial = Number.isInteger(Number(valor)) && Number(valor) >= min && Number(valor) <= max ? Number(valor) : defecto;
  const [texto, setTexto] = useState(String(inicial));
  const [guardado, setGuardado] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const n = Number(texto);
  const falla = texto.trim() === '' || !Number.isInteger(n) || n < min || n > max ? `Escribe un número entero entre ${min} y ${max}.` : null;
  const guardar = async () => {
    if (falla) {
      setError(falla);
      return;
    }
    setGuardando(true);
    setError(null);
    setOk(false);
    try {
      await api.put(`/admin/configuracion/${clave}`, { valor: n });
      setGuardado(n);
      setOk(true);
    } catch (e) {
      setError(msg(e, 'No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };
  return (
    <div className="cav-numero-fila">
      <CampoAyuda id={`cav-${clave}`} etiqueta={etiqueta} ayuda={ayuda} unidad="minutos" rango={`${min} a ${max}`} porDefecto={String(defecto)} cfgId={cfg}>
        <input
          type="number" inputMode="numeric" min={min} max={max} step={1} value={texto}
          aria-invalid={!!error} className="cav-numero"
          onChange={(e) => { setTexto(e.target.value); setError(null); setOk(false); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void guardar(); } }}
        />
      </CampoAyuda>
      <Boton variante="secundario" tamano="pequeno" cargando={guardando} disabled={n === guardado && !error} onClick={() => void guardar()} aria-label={`Guardar: ${etiqueta}`}>
        Guardar
      </Boton>
      {error && <div role="alert" className="cav-error">{error}</div>}
      {ok && !error && <div role="status" className="cav-ok">Guardado.</div>}
    </div>
  );
}
