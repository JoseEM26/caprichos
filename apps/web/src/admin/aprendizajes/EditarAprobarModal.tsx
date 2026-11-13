import { useId, useState } from 'react';
import { ModalConPestanas } from '../../comun/ModalConPestanas';
import { Boton } from '../../comun/Boton';
import { Confirmar } from '../../comun/Confirmar';
import { aprendizajesApi, mensajeError, type Propuesta } from './aprendizajesApi';

/** Edita pregunta, respuesta y frases de una propuesta y la aprueba tras un Sí/No. */
export function EditarAprobarModal({ propuesta, alAprobar, alCerrar }: {
  propuesta: Propuesta;
  alAprobar: (cambios: { pregunta: string; respuesta: string; frases: string[] }) => Promise<void>;
  alCerrar: () => void;
}) {
  const id = useId();
  const [pregunta, setPregunta] = useState(propuesta.pregunta);
  const [respuesta, setRespuesta] = useState(propuesta.respuesta);
  const [frases, setFrases] = useState(propuesta.frases);
  const [nueva, setNueva] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mejorando, setMejorando] = useState(false);
  const [errorMejorar, setErrorMejorar] = useState<string | null>(null);
  const [anterior, setAnterior] = useState<string | null>(null);
  const esDerivar = propuesta.tipo === 'DERIVAR';
  const valido = pregunta.trim().length > 0 && (esDerivar || respuesta.trim().length > 0);

  const sumar = () => {
    const f = nueva.trim();
    if (f && !frases.includes(f)) setFrases([...frases, f]);
    setNueva('');
  };

  const mejorar = async () => {
    setMejorando(true); setErrorMejorar(null);
    try {
      const r = await aprendizajesApi.mejorar({ pregunta, respuesta, intencion: propuesta.intencion, tipo: propuesta.tipo });
      setAnterior(respuesta);
      setRespuesta(r.respuesta);
      if (r.frases?.length) setFrases((fs) => [...fs, ...r.frases!.filter((f, i, a) => !fs.includes(f) && a.indexOf(f) === i)]);
    } catch (e) { setErrorMejorar(mensajeError(e)); } finally { setMejorando(false); }
  };

  const cuerpo = (
    <div className="ap-form">
      <label htmlFor={`${id}-p`} className="ap-etiqueta">Pregunta del cliente</label>
      <input id={`${id}-p`} className="ap-campo" value={pregunta} onChange={(e) => setPregunta(e.target.value)} />
      {!esDerivar && (
        <>
          <label htmlFor={`${id}-r`} className="ap-etiqueta">Respuesta del bot</label>
          <textarea id={`${id}-r`} className="ap-campo" rows={4} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
          <div className="ap-fila">
            <Boton type="button" variante="secundario" aria-label="Mejorar la respuesta con IA" onClick={mejorar} disabled={mejorando || !respuesta.trim()}>
              {mejorando ? 'Mejorando…' : '✨ Mejorar'}
            </Boton>
            {anterior !== null && !mejorando && (
              <Boton type="button" variante="secundario" onClick={() => { setRespuesta(anterior); setAnterior(null); }}>Deshacer</Boton>
            )}
          </div>
          {errorMejorar && <p role="alert" className="ap-error">{errorMejorar}</p>}
        </>
      )}
      <label htmlFor={`${id}-f`} className="ap-etiqueta">Otras formas de preguntar lo mismo</label>
      <ul className="ap-chips" aria-label="Frases">
        {frases.map((f) => (
          <li key={f} className="ap-chip">
            {f}
            <button type="button" aria-label={`Quitar frase ${f}`} onClick={() => setFrases(frases.filter((x) => x !== f))}>×</button>
          </li>
        ))}
      </ul>
      <div className="ap-fila">
        <input id={`${id}-f`} className="ap-campo" value={nueva} placeholder="Escribe una frase" onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } }} />
        <Boton type="button" variante="secundario" onClick={sumar} disabled={!nueva.trim()}>Agregar frase</Boton>
      </div>
    </div>
  );

  return (
    <>
      <ModalConPestanas
        titulo="Editar y aprobar" ancho={640} alCerrar={alCerrar} bloquearCierre={cargando}
        pestanas={[{ id: 'editar', etiqueta: 'Editar', contenido: cuerpo }]}
        pie={
          <>
            <Boton type="button" variante="secundario" onClick={alCerrar}>Cancelar</Boton>
            <Boton type="button" disabled={!valido} onClick={() => setConfirmando(true)}>Aprobar</Boton>
          </>
        }
      />
      <Confirmar
        abierto={confirmando} titulo="¿Aprobar esto?" mensaje="El bot lo usará desde ahora. Podrás retirarlo después." textoSi="Sí, aprobar"
        cargando={cargando} error={error}
        alCancelar={() => setConfirmando(false)}
        alConfirmar={async () => {
          setCargando(true); setError(null);
          try { await alAprobar({ pregunta: pregunta.trim(), respuesta: respuesta.trim(), frases }); alCerrar(); }
          catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
        }}
      />
    </>
  );
}
