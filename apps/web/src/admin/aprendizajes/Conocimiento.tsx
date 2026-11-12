import { useCallback, useEffect, useId, useState } from 'react';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { EstadoError } from '../../comun/EstadoError';
import { normalizarBusqueda } from '../../comun/normalizarBusqueda';
import { aprendizajesApi, fechaCorta, mensajeError, TIPO_TEXTO, type Conocimiento as Item } from './aprendizajesApi';
import { MotivoConfirmar } from './MotivoConfirmar';

export function Conocimiento({ puedeAprobar }: { puedeAprobar: boolean }) {
  const idBusq = useId();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [retirando, setRetirando] = useState<Item | null>(null);

  const cargar = useCallback(() => {
    setError(null);
    return aprendizajesApi.conocimiento().then((r) => setItems(r.items), (e) => setError(mensajeError(e)));
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const nq = normalizarBusqueda(q);
  const visibles = (items ?? []).filter((i) => !nq || normalizarBusqueda(`${i.pregunta} ${i.respuesta} ${i.intencion} ${i.frases.join(' ')}`).includes(nq));

  return (
    <div className="ap-seccion">
      <p className="ap-aviso" role="note">Esto se suma a lo que responde la IA de dudas; precios, stock y horarios siempre salen del sistema.</p>
      <label htmlFor={idBusq} className="ap-etiqueta">Buscar</label>
      <input id={idBusq} type="search" className="ap-campo" value={q} placeholder="Escribe una palabra" onChange={(e) => setQ(e.target.value)} />
      {error ? <EstadoError mensaje={error} alReintentar={cargar} />
        : !items ? <Cargando mensaje="Cargando lo que sabe el bot" />
        : visibles.length === 0 ? <EstadoVacio titulo={items.length ? 'Nada coincide con tu búsqueda' : 'Aún no hay nada aprendido'} descripcion={items.length ? undefined : 'Lo que apruebes en «Por revisar» aparecerá aquí.'} />
        : (
          <ul className="ap-lista">
            {visibles.map((i) => (
              <li key={i.id} className="ap-tarjeta">
                <div className="ap-cab">
                  <span className={`ap-tipo ap-tipo--${i.tipo.toLowerCase()}`}>{TIPO_TEXTO[i.tipo]}</span>
                  <span className="ap-meta">{i.intencion} · versión {i.version} · aprobado por {i.aprobadoPor} el {fechaCorta(i.aprobadoEn)}</span>
                </div>
                <p className="ap-pregunta">{i.pregunta}</p>
                {i.tipo !== 'DERIVAR' && <p className="ap-respuesta">{i.respuesta}</p>}
                {i.frases.length > 0 && <p className="ap-meta">Frases: {i.frases.join(' · ')}</p>}
                {puedeAprobar && <div className="ap-acciones"><Boton type="button" variante="secundario" onClick={() => setRetirando(i)}>Retirar</Boton></div>}
              </li>
            ))}
          </ul>
        )}
      <MotivoConfirmar abierto={!!retirando} titulo="¿Retirar este conocimiento?" mensaje="El bot dejará de usarlo." textoSi="Sí, retirar"
        alCerrar={() => setRetirando(null)}
        alEnviar={async (m) => { await aprendizajesApi.retirar(retirando!.id, m); await cargar(); }} />
    </div>
  );
}
