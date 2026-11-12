import { Boton } from '../../../comun/Boton';
import { TarjetaAnalisis, textoMinutos, useConsultaAnalisis } from '../comun';
import type { RespuestaSinRespuesta } from './tipos';

/** Chats que esperan a una persona ahora (celular enmascarado). Se actualiza por socket y cada 30 s. */
export function ChatsSinRespuesta() {
  const { datos, estado, recargar } = useConsultaAnalisis<RespuestaSinRespuesta>('/admin/analisis/whatsapp/sin-respuesta', {
    cadaMs: 30_000,
    eventos: ['mensajes:actualizado'],
  });
  const items = datos?.items ?? [];
  return (
    <TarjetaAnalisis
      id="an-wa-espera"
      titulo="Chats sin respuesta ahora"
      subtitulo="El último mensaje es del cliente y espera a una persona. Del que más espera al que menos."
      estado={estado === 'cargando' && !datos ? 'cargando' : estado === 'error' && !datos ? 'error' : items.length ? 'ok' : 'vacio'}
      vacio="Ningún chat espera respuesta. Todo al día."
      alReintentar={recargar}
      acciones={
        <Boton variante="secundario" tamano="pequeno" onClick={recargar}>
          Actualizar
        </Boton>
      }
    >
      {datos?.hayMas && <p className="an-sub">Se muestran los {datos.limite} que más esperan.</p>}
      <ul className="an-lista">
        {items.map((i) => (
          <li key={i.id}>
            <span className="an-lista__texto">
              <strong>{i.celular}</strong>
              <span>
                Espera hace {textoMinutos(i.minutos)} · {i.motivo}
              </span>
            </span>
            <a className="an-enlace" href={i.enlace} aria-label={`Abrir Mensajes para atender ${i.celular}`}>
              Abrir Mensajes
            </a>
          </li>
        ))}
      </ul>
    </TarjetaAnalisis>
  );
}
