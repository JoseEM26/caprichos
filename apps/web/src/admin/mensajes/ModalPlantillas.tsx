import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CATEGORIAS_PLANTILLA,
  ETIQUETA_CATEGORIA_PLANTILLA,
  VARIABLES_PLANTILLA,
  resolverPlantilla,
} from '@caprichos/compartido';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import {
  borrarPlantilla,
  crearPlantilla,
  duplicarPlantilla,
  editarPlantilla,
  listarPlantillasGestion,
  ordenarPlantillas,
} from './mensajesApi';
import { categoriaDe } from './PanelPlantillas';
import { ContextoPlantillas, RespuestaRapida } from './mensajesTipos';

const MAX_TEXTO = 1000;
const MAX_TITULO = 60;
const mensajeDe = (e: any, defecto: string) => e?.mensaje || e?.response?.mensaje || e?.message || defecto;

export interface ModalPlantillasProps {
  contexto: ContextoPlantillas;
  /** Avisa que algo cambió para que la bandeja recargue las plantillas del selector. */
  alCambiar: () => void;
  alCerrar: () => void;
}

/**
 * Administrar plantillas (compartidas por todo el equipo): lista con pausar, ordenar, duplicar y borrar, y una pestaña
 * para crear o editar. Una sola ventana con pestañas (nunca un modal sobre otro): el borrar se confirma en la misma fila.
 */
export function ModalPlantillas({ contexto, alCambiar, alCerrar }: ModalPlantillasProps) {
  const [lista, setLista] = useState<RespuestaRapida[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<'lista' | 'form'>('lista');
  const [editando, setEditando] = useState<RespuestaRapida | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setLista(await listarPlantillasGestion());
      setError(null);
    } catch (e) {
      setError(mensajeDe(e, 'No se pudieron cargar las plantillas'));
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ejecutar = async (accion: () => Promise<unknown>, falla: string) => {
    setOcupado(true);
    setError(null);
    try {
      await accion();
      await cargar();
      alCambiar();
    } catch (e) {
      setError(mensajeDe(e, falla));
    } finally {
      setOcupado(false);
    }
  };

  const mover = (i: number, d: -1 | 1) => {
    if (!lista) return;
    const j = i + d;
    if (j < 0 || j >= lista.length) return;
    const ids = lista.map((p) => p.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void ejecutar(() => ordenarPlantillas(ids), 'No se pudo cambiar el orden');
  };

  const abrirForm = (p: RespuestaRapida | null) => {
    setEditando(p);
    setPestana('form');
  };

  const contenidoLista = (
    <div>
      <div className="msg-plm-barra">
        <button type="button" className="msg-plm-btn msg-plm-principal" onClick={() => abrirForm(null)}>
          Nueva plantilla
        </button>
      </div>
      {error && (
        <div role="alert" className="msg-error">
          {error}
        </div>
      )}
      {lista === null && !error && <p role="status">Cargando…</p>}
      {lista !== null && lista.length === 0 && <p role="status">Aún no hay plantillas. Crea la primera con «Nueva plantilla».</p>}
      <ul className="msg-plm-lista" aria-label="Plantillas">
        {(lista ?? []).map((p, i) => (
          <li key={p.id} className={p.activo === false ? 'msg-plm-fila msg-plm-pausada' : 'msg-plm-fila'}>
            <div className="msg-plm-datos">
              <span className="msg-plm-titulo">{p.titulo}</span>
              <span className="msg-plm-cat">{ETIQUETA_CATEGORIA_PLANTILLA[categoriaDe(p) as keyof typeof ETIQUETA_CATEGORIA_PLANTILLA]}</span>
              {p.activo === false && <span className="msg-plm-estado">En pausa</span>}
              <span className="msg-plm-texto">{p.texto}</span>
            </div>
            {borrando === p.id ? (
              <div className="msg-plm-acciones" role="group" aria-label={`Borrar ${p.titulo}`}>
                <span className="msg-plm-pregunta">¿Borrar «{p.titulo}»?</span>
                <button
                  type="button"
                  className="msg-plm-btn msg-plm-peligro"
                  disabled={ocupado}
                  onClick={() => {
                    setBorrando(null);
                    void ejecutar(() => borrarPlantilla(p.id), 'No se pudo borrar');
                  }}
                >
                  Sí, borrar
                </button>
                <button type="button" className="msg-plm-btn" onClick={() => setBorrando(null)}>
                  No
                </button>
              </div>
            ) : (
              <div className="msg-plm-acciones">
                <button type="button" className="msg-plm-btn" aria-label={`Subir ${p.titulo}`} disabled={ocupado || i === 0} onClick={() => mover(i, -1)}>
                  ↑
                </button>
                <button type="button" className="msg-plm-btn" aria-label={`Bajar ${p.titulo}`} disabled={ocupado || i === (lista?.length ?? 0) - 1} onClick={() => mover(i, 1)}>
                  ↓
                </button>
                <button type="button" className="msg-plm-btn" aria-label={`Editar ${p.titulo}`} onClick={() => abrirForm(p)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="msg-plm-btn"
                  aria-label={`${p.activo === false ? 'Activar' : 'Pausar'} ${p.titulo}`}
                  disabled={ocupado}
                  onClick={() => void ejecutar(() => editarPlantilla(p.id, { activo: p.activo === false }), 'No se pudo cambiar el estado')}
                >
                  {p.activo === false ? 'Activar' : 'Pausar'}
                </button>
                <button type="button" className="msg-plm-btn" aria-label={`Duplicar ${p.titulo}`} disabled={ocupado} onClick={() => void ejecutar(() => duplicarPlantilla(p.id), 'No se pudo duplicar')}>
                  Duplicar
                </button>
                <button type="button" className="msg-plm-btn" aria-label={`Borrar ${p.titulo}`} disabled={ocupado} onClick={() => setBorrando(p.id)}>
                  Borrar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <ModalConPestanas
      titulo="Administrar plantillas"
      subtitulo="Respuestas rápidas para todo el equipo. No necesitan aprobación de Meta."
      ancho={760}
      pestanas={[
        { id: 'lista', etiqueta: 'Plantillas', insignia: lista ? lista.length : null, contenido: contenidoLista },
        {
          id: 'form',
          etiqueta: editando ? 'Editar' : 'Nueva',
          persistente: false,
          contenido: (
            <FormularioPlantilla
              key={editando?.id ?? 'nueva'}
              plantilla={editando}
              contexto={contexto}
              alGuardado={() => {
                setEditando(null);
                setPestana('lista');
                void cargar();
                alCambiar();
              }}
              alCancelar={() => {
                setEditando(null);
                setPestana('lista');
              }}
            />
          ),
        },
      ]}
      pestanaActiva={pestana}
      alCambiarPestana={(id) => {
        setPestana(id as 'lista' | 'form');
      }}
      alCerrar={alCerrar}
      pie={
        <button type="button" className="msg-plm-btn" onClick={alCerrar}>
          Cerrar
        </button>
      }
    />
  );
}

function FormularioPlantilla({
  plantilla,
  contexto,
  alGuardado,
  alCancelar,
}: {
  plantilla: RespuestaRapida | null;
  contexto: ContextoPlantillas;
  alGuardado: () => void;
  alCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState(plantilla?.titulo ?? '');
  const [texto, setTexto] = useState(plantilla?.texto ?? '');
  const [categoria, setCategoria] = useState(plantilla ? categoriaDe(plantilla) : 'OTROS');
  const [activo, setActivo] = useState(plantilla?.activo !== false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const cajaRef = useRef<HTMLTextAreaElement>(null);

  const insertarVariable = (clave: string) => {
    const c = cajaRef.current;
    const a = c?.selectionStart ?? texto.length;
    const b = c?.selectionEnd ?? a;
    const marca = `{{${clave}}}`;
    setTexto(texto.slice(0, a) + marca + texto.slice(b));
    setTimeout(() => {
      c?.focus();
      c?.setSelectionRange(a + marca.length, a + marca.length);
    }, 0);
  };

  const vista = resolverPlantilla(texto, { ...contexto, nombre: 'Ana' });

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (titulo.trim().length < 2) return setError('Escribe un título de al menos 2 letras');
    if (!texto.trim()) return setError('Escribe el texto de la plantilla');
    if (texto.length > MAX_TEXTO) return setError(`El texto admite hasta ${MAX_TEXTO} letras`);
    setGuardando(true);
    setError(null);
    try {
      const datos = { titulo: titulo.trim(), texto, categoria, activo };
      if (plantilla) await editarPlantilla(plantilla.id, datos);
      else await crearPlantilla(datos);
      alGuardado();
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la plantilla'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={guardar} className="msg-plm-form">
      <label htmlFor="pl-titulo">Título</label>
      <input id="pl-titulo" type="text" maxLength={MAX_TITULO} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Medios de pago" />

      <label htmlFor="pl-categoria">Categoría</label>
      <select id="pl-categoria" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
        {CATEGORIAS_PLANTILLA.map((c) => (
          <option key={c} value={c}>
            {ETIQUETA_CATEGORIA_PLANTILLA[c]}
          </option>
        ))}
      </select>

      <label htmlFor="pl-texto">Texto del mensaje</label>
      <textarea id="pl-texto" ref={cajaRef} rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} />
      <div className={texto.length > MAX_TEXTO ? 'msg-plm-cuenta msg-plm-excede' : 'msg-plm-cuenta'}>
        {texto.length} / {MAX_TEXTO}
      </div>

      <div className="msg-plm-vars" role="group" aria-label="Datos que se completan solos">
        <span>Datos automáticos:</span>
        {VARIABLES_PLANTILLA.map((v) => (
          <button key={v.clave} type="button" className="msg-pl-chip" title={v.ayuda} onClick={() => insertarVariable(v.clave)}>
            {`{{${v.clave}}}`}
          </button>
        ))}
      </div>

      <div className="msg-plm-vista" aria-label="Vista previa">
        <div className="msg-plm-vista-et">Así se vería (con un cliente de ejemplo llamado Ana):</div>
        <div className="msg-plm-vista-texto">{vista.texto || '—'}</div>
        {vista.faltantes.length > 0 && (
          <div className="msg-plm-vista-falta">Sin dato en el sistema: {vista.faltantes.map((f) => `{{${f}}}`).join(', ')}. Quien la use lo completará a mano.</div>
        )}
      </div>

      <label className="msg-plm-check">
        <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} /> Activa (si la pausas, no aparece en el chat)
      </label>

      {error && (
        <div role="alert" className="msg-error">
          {error}
        </div>
      )}
      <div className="msg-plm-barra">
        <button type="submit" className="msg-plm-btn msg-plm-principal" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" className="msg-plm-btn" disabled={guardando} onClick={alCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
