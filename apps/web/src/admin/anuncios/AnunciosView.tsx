import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../comun/api';
import { useSesion } from '../../comun/sesion';
import { Boton } from '../../comun/Boton';
import { Cargando } from '../../comun/Cargando';
import { Confirmar } from '../../comun/Confirmar';
import { EstadoError } from '../../comun/EstadoError';
import { EstadoVacio } from '../../comun/EstadoVacio';
import { Insignia } from '../../comun/Insignia';
import { BarraFiltros, FiltroCombo } from '../../comun/FiltroCombo';
import { ModalAnuncio } from '../../anuncios/ModalAnuncio';
import type { AnuncioPublico } from '../../anuncios/tipos';
import { PLANTILLAS_ANUNCIO } from '../../anuncios/tipos';
import { EditorAnuncio } from './EditorAnuncio';
import { aForm, deForm, FORM_VACIO } from './anunciosApi';
import type { AnuncioAdmin, EstadoAnuncio, FormAnuncio } from './anunciosApi';

const ESTADOS: Record<EstadoAnuncio, { nombre: string; variante: 'neutro' | 'exito' | 'peligro' | 'aviso' | 'acento' }> = {
  PROGRAMADO: { nombre: 'Programado', variante: 'aviso' },
  AL_AIRE: { nombre: 'Al aire', variante: 'exito' },
  VENCIDO: { nombre: 'Vencido', variante: 'neutro' },
  APAGADO: { nombre: 'Apagado', variante: 'peligro' },
};
const PUBLICOS: Record<string, string> = { CARTA: 'Clientes', PERSONAL: 'Personal', AMBOS: 'Ambos' };

const fechaLima = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('es-PE', { timeZone: 'America/Lima', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso)) : '';

export function AnunciosView() {
  const { tiene } = useSesion();
  const puedeCrear = tiene('anuncios/crear');
  const puedeEditar = tiene('anuncios/editar');
  const puedeEliminar = tiene('anuncios/eliminar');
  const [items, setItems] = useState<AnuncioAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estado, setEstado] = useState('');
  const [publico, setPublico] = useState('');
  const [editando, setEditando] = useState<{ id: string | null; form: FormAnuncio } | null>(null);
  const [previa, setPrevia] = useState<AnuncioPublico | null>(null);
  const [aEliminar, setAEliminar] = useState<AnuncioAdmin | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setItems(await api.get<AnuncioAdmin[]>('/admin/anuncios'));
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los anuncios');
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const filtrados = useMemo(
    () => (items ?? []).filter((a) => (!estado || a.estado === estado) && (!publico || a.publico === publico)),
    [items, estado, publico],
  );

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setAviso(null);
    try {
      await fn();
      setAviso(ok);
      await cargar();
    } catch (e: any) {
      setAviso(e?.message || 'No se pudo completar la acción');
    }
  };

  const guardar = async (f: FormAnuncio) => {
    if (editando?.id) await api.put(`/admin/anuncios/${editando.id}`, deForm(f));
    else await api.post('/admin/anuncios', deForm(f));
    setEditando(null);
    setAviso('Anuncio guardado');
    await cargar();
  };

  const verPrevia = async (a: AnuncioAdmin) => {
    try {
      setPrevia(await api.get<AnuncioPublico>(`/admin/anuncios/${a.id}/vista-previa`));
    } catch (e: any) {
      setAviso(e?.message || 'No se pudo abrir la vista previa');
    }
  };

  if (error) return <EstadoError mensaje={error} alReintentar={cargar} />;
  if (!items) return <Cargando mensaje="Cargando anuncios" />;

  return (
    <section style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 1100 }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: 'var(--cp-navy)' }}>Anuncios emergentes</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--cp-soft)', fontSize: 14 }}>Ventanas que salen al entrar a la carta o al panel, con fechas, horario y frecuencia.</p>
        </div>
        {puedeCrear && <Boton onClick={() => setEditando({ id: null, form: FORM_VACIO })}>Nuevo anuncio</Boton>}
      </header>

      <BarraFiltros>
        <FiltroCombo etiqueta="Estado" valor={estado} alCambiar={setEstado} valorPorDefecto=""
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...Object.entries(ESTADOS).map(([v, e]) => ({ valor: v, etiqueta: e.nombre, cantidad: items.filter((a) => a.estado === v).length }))]} />
        <FiltroCombo etiqueta="Público" valor={publico} alCambiar={setPublico} valorPorDefecto=""
          opciones={[{ valor: '', etiqueta: 'Todos' }, ...Object.entries(PUBLICOS).map(([v, n]) => ({ valor: v, etiqueta: n }))]} />
      </BarraFiltros>

      {aviso && <div role="status" style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--cp-sand)', color: 'var(--cp-navy)', fontWeight: 700 }}>{aviso}</div>}

      {filtrados.length === 0 ? (
        <EstadoVacio titulo="No hay anuncios" descripcion={items.length ? 'Ningún anuncio coincide con los filtros.' : 'Crea el primero con «Nuevo anuncio».'} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtrados.map((a) => (
            <li key={a.id} style={{ background: 'var(--cp-white)', border: '1.5px solid var(--cp-line)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <strong style={{ color: 'var(--cp-navy)', fontSize: 16, overflowWrap: 'anywhere' }}>{a.titulo}</strong>
                <Insignia variante={ESTADOS[a.estado].variante}>{ESTADOS[a.estado].nombre}</Insignia>
                <Insignia>{PUBLICOS[a.publico]}</Insignia>
                <Insignia>{PLANTILLAS_ANUNCIO.find((p) => p.id === a.plantilla)?.nombre ?? a.plantilla}</Insignia>
              </div>
              <div style={{ fontSize: 13, color: 'var(--cp-soft)' }}>
                {a.desde || a.hasta ? `${fechaLima(a.desde) || 'Ya'} → ${fechaLima(a.hasta) || 'sin fin'}` : 'Sin fechas'}
                {a.franja_desde && ` · ${a.franja_desde} a ${a.franja_hasta}`}
                {a.roles.length > 0 && ` · ${a.roles.join(', ')}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--cp-navy)' }} aria-label="Resultados">
                {a.estadisticas?.vistas ?? 0} vistas · {a.estadisticas?.cierres ?? 0} cierres · {a.estadisticas?.clics ?? 0} clics
                {a.plantilla === 'COMUNICADO_INTERNO' && ` · ${a.estadisticas?.entendidos ?? 0} entendidos`}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {puedeEditar && (
                  <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 700, color: 'var(--cp-navy)', minHeight: 44 }}>
                    <input type="checkbox" checked={a.activo} style={{ width: 22, height: 22 }} onChange={(e) => accion(() => api.post(`/admin/anuncios/${a.id}/activo`, { activo: e.target.checked }), e.target.checked ? 'Anuncio encendido' : 'Anuncio apagado')} />
                    Activo
                  </label>
                )}
                <Boton variante="secundario" tamano="pequeno" onClick={() => verPrevia(a)}>Vista previa</Boton>
                {puedeEditar && <Boton variante="secundario" tamano="pequeno" onClick={() => setEditando({ id: a.id, form: aForm(a) })}>Editar</Boton>}
                {puedeCrear && <Boton variante="secundario" tamano="pequeno" onClick={() => accion(() => api.post(`/admin/anuncios/${a.id}/duplicar`), 'Copia creada (apagada)')}>Duplicar</Boton>}
                {puedeEliminar && <Boton variante="peligro" tamano="pequeno" onClick={() => setAEliminar(a)}>Eliminar</Boton>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <EditorAnuncio valorInicial={editando.form} titulo={editando.id ? 'Editar anuncio' : 'Nuevo anuncio'} alGuardar={guardar} alCerrar={() => setEditando(null)} />
      )}
      {previa && <ModalAnuncio anuncio={previa} alCerrar={() => setPrevia(null)} alClicBoton={() => setPrevia(null)} />}
      <Confirmar
        abierto={!!aEliminar}
        titulo="Eliminar anuncio"
        mensaje={`¿Eliminar «${aEliminar?.titulo ?? ''}»? También se borran sus vistas. Si solo quieres pausarlo, apágalo.`}
        textoSi="Sí, eliminar"
        textoNo="No, conservar"
        peligro
        alConfirmar={async () => {
          const a = aEliminar;
          setAEliminar(null);
          if (a) await accion(() => api.delete(`/admin/anuncios/${a.id}`), 'Anuncio eliminado');
        }}
        alCancelar={() => setAEliminar(null)}
      />
    </section>
  );
}

export default AnunciosView;
