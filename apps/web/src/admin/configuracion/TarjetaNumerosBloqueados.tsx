import { useCallback, useEffect, useState } from 'react';
import { api, ErrorApi } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';

interface FilaBloqueada {
  id: string;
  celular: string;
  motivo: string | null;
  bloqueadoPor: string | null;
  bloqueadoEn: string;
}

/** 9 dígitos que empiezan con 9, con o sin +51, espacios o guiones. '' si no es un celular válido. */
export function celularValido(texto: string): string {
  const d = texto.replace(/\D/g, '');
  const c = d.length === 11 && d.startsWith('51') ? d.slice(2) : d;
  return /^9\d{8}$/.test(c) ? c : '';
}

/** Cualquier número a bloquear: celular peruano (con o sin +51), otro número con su código de país, o un identificador de WhatsApp. */
export function destinoValido(texto: string): string {
  const t = texto.trim();
  if (/^wa-user:/i.test(t) || t.includes('.')) {
    const id = t.toLowerCase().replace(/\s+/g, '');
    return /^[a-z0-9:._-]{3,40}$/.test(id) ? id : '';
  }
  const d = t.replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 11 && d.startsWith('519')) return d.slice(2);
  return /^\d{6,20}$/.test(d) ? d : '';
}

const fmt = (c: string) => (/^9\d{8}$/.test(c) ? `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6)}` : c);
const fecha = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' }).format(d);
};

const campo = { minHeight: 44, padding: '0 12px', borderRadius: 8, border: '1.5px solid #E3D6C6', fontSize: 14, color: '#0B2C3E', background: '#FFFFFF', boxSizing: 'border-box' as const };
const boton = (fondo: string, color = '#FFFFFF') => ({ minHeight: 44, padding: '0 16px', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: fondo, color });

/**
 * Configuración › WhatsApp: «Números del negocio (no se les envía nada)» y la lista manual «Números bloqueados».
 * El número principal del negocio ya está protegido solo; aquí se agregan otros (p. ej. un segundo celular del local).
 */
export function TarjetaNumerosBloqueados({ esAdmin = false }: { esAdmin?: boolean }) {
  const [filas, setFilas] = useState<FilaBloqueada[]>([]);
  const [protegidos, setProtegidos] = useState<string[]>([]);
  const [propios, setPropios] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [confirmar, setConfirmar] = useState<{ tipo: 'bloquear' | 'desbloquear' | 'propios'; celular?: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await api.get<{ filas?: FilaBloqueada[]; propios?: string[] }>('/admin/whatsapp/numeros-bloqueados');
      setFilas(Array.isArray(r?.filas) ? r.filas : []);
      setProtegidos(Array.isArray(r?.propios) ? r.propios : []);
      const params = await api.get<Array<{ clave: string; valor: unknown }>>('/admin/configuracion');
      const p = Array.isArray(params) ? params.find((x) => x.clave === 'whatsapp_numeros_propios') : undefined;
      setPropios(typeof p?.valor === 'string' ? p.valor : '');
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : 'No se pudo cargar la lista de números.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pedirBloquear = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);
    if (!destinoValido(nuevo)) {
      setError('Escribe un número válido: celular de 9 dígitos, u otro número con su código de país.');
      return;
    }
    setError(null);
    setErrorConfirmar(null);
    setConfirmar({ tipo: 'bloquear', celular: destinoValido(nuevo) });
  };

  const pedirPropios = (e: React.FormEvent) => {
    e.preventDefault();
    setExito(null);
    const partes = propios.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
    if (partes.some((x) => !celularValido(x))) {
      setError('Cada número debe ser un celular de 9 dígitos que empiece con 9, separados por coma.');
      return;
    }
    setError(null);
    setErrorConfirmar(null);
    setConfirmar({ tipo: 'propios' });
  };

  const ejecutar = async () => {
    if (!confirmar) return;
    setEnviando(true);
    setErrorConfirmar(null);
    try {
      if (confirmar.tipo === 'bloquear') {
        await api.post('/admin/whatsapp/numeros-bloqueados', { celular: confirmar.celular, motivo: motivo.trim() || undefined });
        setNuevo('');
        setMotivo('');
        setExito('Número bloqueado.');
      } else if (confirmar.tipo === 'desbloquear') {
        await api.post('/admin/whatsapp/numeros-bloqueados/desbloquear', { celular: confirmar.celular });
        setExito('Número desbloqueado.');
      } else {
        const valor = propios.split(/[,;\n]/).map((x) => celularValido(x.trim())).filter(Boolean).join(', ');
        await api.put('/admin/configuracion/whatsapp_numeros_propios', { valor });
        setExito('Números del negocio guardados.');
      }
      setConfirmar(null);
      await cargar();
    } catch (err) {
      setErrorConfirmar(err instanceof ErrorApi ? err.message : 'No se pudo completar la acción.');
    } finally {
      setEnviando(false);
    }
  };

  const titulos = {
    bloquear: `¿Bloquear el número ${confirmar?.celular ? fmt(confirmar.celular) : ''}?`,
    desbloquear: `¿Desbloquear el número ${confirmar?.celular ? fmt(confirmar.celular) : ''}?`,
    propios: '¿Guardar los números del negocio?',
  } as const;

  return (
    <div
      data-testid="tarjeta-numeros-bloqueados"
      style={{ background: '#FFFFFF', border: '1px solid #E3D6C6', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 16, color: '#0B2C3E' }}
    >
      <div>
        <h3 style={{ margin: 0, fontWeight: 800, fontSize: 15 }}>Números del negocio y números bloqueados</h3>
        <p style={{ margin: '3px 0 0', fontSize: 12, color: '#2C4C5D' }}>
          Para que los bots no se contesten entre sí, el sistema nunca escribe al propio número del negocio ni a los números bloqueados, y tampoco responde a sus mensajes.
        </p>
      </div>

      {error && (
        <div role="alert" style={{ color: '#B2500F', fontSize: 13, fontWeight: 700 }}>
          {error}
        </div>
      )}
      {exito && (
        <div role="status" style={{ color: '#2F7A45', fontSize: 13, fontWeight: 700 }}>
          {exito}
        </div>
      )}

      {cargando ? (
        <div style={{ fontSize: 12, color: '#2C4C5D' }}>Cargando...</div>
      ) : (
        <>
          <form noValidate onSubmit={pedirPropios} data-testid="seccion-numeros-propios" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 10, background: '#FBF4EC', border: '1px solid #E3D6C6' }}>
            <strong style={{ fontSize: 14 }}>Números del negocio (no se les envía nada)</strong>
            <span style={{ fontSize: 12, color: '#2C4C5D' }}>
              El número principal del negocio ya está protegido: se toma de «Mi local › WhatsApp», de la verificación de celular y del número que Meta informa en cada mensaje.
              Agrega aquí otros celulares del local (9 dígitos, separados por coma), por ejemplo un segundo teléfono. No se les enviará avisos, encuestas ni mensajes.
            </span>
            {protegidos.length > 0 && (
              <span data-testid="numeros-protegidos" style={{ fontSize: 12, fontWeight: 700 }}>
                Protegidos ahora: {protegidos.map(fmt).join(' · ')}
              </span>
            )}
            <input
              aria-label="Números del negocio"
              placeholder="Ej.: 977 123 456, 999 111 222"
              value={propios}
              disabled={!esAdmin}
              onChange={(e) => {
                setExito(null);
                setPropios(e.target.value);
              }}
              style={campo}
            />
            {esAdmin && (
              <div>
                <button type="submit" style={boton('#0B2C3E')}>
                  Guardar números del negocio
                </button>
              </div>
            )}
          </form>

          <div data-testid="seccion-numeros-bloqueados" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <strong style={{ fontSize: 14 }}>Números bloqueados</strong>
            {filas.length === 0 ? (
              <span style={{ fontSize: 13, color: '#2C4C5D' }}>No hay números bloqueados.</span>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filas.map((f) => (
                  <li key={f.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid #E3D6C6', background: '#FBF4EC' }}>
                    <span style={{ fontWeight: 800 }}>{fmt(f.celular)}</span>
                    <span style={{ fontSize: 12, color: '#2C4C5D', flex: 1, minWidth: 160 }}>
                      {f.motivo ? `${f.motivo} · ` : ''}
                      {f.bloqueadoPor ? `por ${f.bloqueadoPor} · ` : ''}
                      {fecha(f.bloqueadoEn)}
                    </span>
                    {esAdmin && (
                      <button
                        type="button"
                        aria-label={`Desbloquear ${fmt(f.celular)}`}
                        onClick={() => {
                          setErrorConfirmar(null);
                          setConfirmar({ tipo: 'desbloquear', celular: f.celular });
                        }}
                        style={boton('#FFFFFF', '#0B2C3E')}
                      >
                        Desbloquear
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {esAdmin && (
              <form noValidate onSubmit={pedirBloquear} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700 }}>
                  Número a bloquear
                  <input aria-label="Número a bloquear" inputMode="tel" placeholder="Cualquier número" value={nuevo} onChange={(e) => setNuevo(e.target.value)} style={{ ...campo, width: 160 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, flex: 1, minWidth: 160 }}>
                  Motivo (opcional)
                  <input aria-label="Motivo (opcional)" maxLength={120} value={motivo} onChange={(e) => setMotivo(e.target.value)} style={campo} />
                </label>
                <button type="submit" style={boton('#B2500F')}>
                  Bloquear un número
                </button>
              </form>
            )}
          </div>
        </>
      )}

      <Confirmar
        abierto={confirmar !== null}
        titulo={confirmar ? titulos[confirmar.tipo] : ''}
        mensaje={
          confirmar?.tipo === 'bloquear'
            ? 'No se le enviará nada por WhatsApp y se ignorarán sus mensajes (el bot no le responde). Los pedidos de la carta web con ese celular siguen permitidos, sin avisos por WhatsApp.'
            : confirmar?.tipo === 'desbloquear'
              ? 'Volverá a recibir avisos y el bot volverá a responderle.'
              : 'Nada se enviará a estos números ni se responderá a sus mensajes.'
        }
        textoSi={confirmar?.tipo === 'bloquear' ? 'Sí, bloquear' : confirmar?.tipo === 'desbloquear' ? 'Sí, desbloquear' : 'Sí, guardar'}
        textoNo="No, cancelar"
        peligro={confirmar?.tipo === 'bloquear'}
        cargando={enviando}
        error={errorConfirmar}
        focoInicialNo
        alConfirmar={ejecutar}
        alCancelar={() => setConfirmar(null)}
      />
    </div>
  );
}
