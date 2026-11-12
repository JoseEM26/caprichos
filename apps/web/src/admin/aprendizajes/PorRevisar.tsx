import { useCallback, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { Paginacion } from '../../comun/Paginacion';
import { aprendizajesApi, fechaCorta, mensajeError, TIPO_TEXTO, type EstadoAprendizaje, type Propuesta } from './aprendizajesApi';
import { EditarAprobarModal } from './EditarAprobarModal';
import { MotivoConfirmar } from './MotivoConfirmar';

const LIMITE = 20;
const ESTADOS: { id: EstadoAprendizaje; texto: string }[] = [
  { id: 'PENDIENTE', texto: 'Pendientes' }, { id: 'APROBADO', texto: 'Aprobados' }, { id: 'DESCARTADO', texto: 'Descartados' },
];

export function PorRevisar({ puedeAprobar, alCambiar }: { puedeAprobar: boolean; alCambiar: () => void }) {
  const [estado, setEstado] = useState<EstadoAprendizaje>('PENDIENTE');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<{ items: Propuesta[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Propuesta | null>(null);
  const [descartando, setDescartando] = useState<Propuesta | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    return aprendizajesApi.listar(estado, pagina, LIMITE).then(setDatos, (e) => setError(mensajeError(e)));
  }, [estado, pagina]);
  useEffect(() => { setDatos(null); cargar(); }, [cargar]);

  const refrescar = async () => { await cargar(); alCambiar(); };

  return (
    <div className="ap-seccion">
      <div className="ap-chips-fila" role="group" aria-label="Filtrar por estado">
        {ESTADOS.map((e) => (
          <button key={e.id} type="button" className="ap-filtro" aria-pressed={estado === e.id} onClick={() => { setEstado(e.id); setPagina(1); }}>{e.texto}</button>
        ))}
      </div>
      {error ? <EstadoError mensaje={error} alReintentar={cargar} />
        : !datos ? <Cargando mensaje="Cargando propuestas" />
        : datos.items.length === 0 ? (
          <EstadoVacio titulo={estado === 'PENDIENTE' ? 'Esta noche no hubo casos nuevos' : 'No hay nada aquí'}
            descripcion={estado === 'PENDIENTE' ? 'Cuando el bot aprenda algo de los chats atendidos por una persona, aparecerá aquí.' : 'Todavía no hay propuestas en este estado.'} />
        ) : (
          <>
            <ul className="ap-lista">
              {datos.items.map((p) => (
                <li key={p.id} className="ap-tarjeta">
                  <div className="ap-cab">
                    <span className={`ap-tipo ap-tipo--${p.tipo.toLowerCase()}`}>{TIPO_TEXTO[p.tipo]}</span>
                    <span className="ap-meta">{p.intencion} · visto {p.repeticiones} {p.repeticiones === 1 ? 'vez' : 'veces'} · noche {fechaCorta(p.noche)}</span>
                  </div>
                  <p className="ap-pregunta">{p.pregunta}</p>
                  {p.tipo !== 'DERIVAR' && <p className="ap-respuesta">{p.respuesta}</p>}
                  {p.tipo === 'DERIVAR' && <p className="ap-meta">El bot pasará siempre a una persona este tipo de consulta.</p>}
                  {p.frases.length > 0 && <p className="ap-meta">Frases: {p.frases.join(' · ')}</p>}
                  {p.estado !== 'PENDIENTE' && (
                    <p className="ap-meta">{p.estado === 'APROBADO' ? 'Aprobado' : 'Descartado'} por {p.decididoPor ?? '—'} el {fechaCorta(p.decididoEn)}{p.motivo ? `: ${p.motivo}` : ''}</p>
                  )}
                  <details className="ap-casos">
                    <summary>Ver casos ({p.evidencia.length})</summary>
                    <ul>{p.evidencia.map((ev) => <li key={ev.conversacionId}>{ev.extracto}</li>)}</ul>
                  </details>
                  {puedeAprobar && p.estado === 'PENDIENTE' && (
                    <div className="ap-acciones">
                      <Boton type="button" onClick={() => setEditando(p)}>Editar y aprobar</Boton>
                      <Boton type="button" variante="secundario" onClick={() => setDescartando(p)}>Descartar</Boton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Paginacion paginaActual={pagina} totalPaginas={Math.max(1, Math.ceil(datos.total / LIMITE))} alCambiarPagina={setPagina} totalRegistros={datos.total} tamanoPagina={LIMITE} />
          </>
        )}
      {editando && (
        <EditarAprobarModal propuesta={editando} alCerrar={() => setEditando(null)}
          alAprobar={async (c) => { await aprendizajesApi.aprobar(editando.id, c); await refrescar(); }} />
      )}
      <MotivoConfirmar abierto={!!descartando} titulo="¿Descartar esta propuesta?" mensaje="El bot no la aprenderá." textoSi="Sí, descartar"
        alCerrar={() => setDescartando(null)}
        alEnviar={async (m) => { await aprendizajesApi.descartar(descartando!.id, m); await refrescar(); }} />
    </div>
  );
}
