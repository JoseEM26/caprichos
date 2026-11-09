import { FormEvent, useEffect, useState } from 'react';
import { Boton } from '../../comun/Boton';
import './asistencia.css';
import { ETIQUETA_TIPO, marcarConClave, TipoMarca } from './asistenciaApi';

/**
 * Página pública /asistencia/marcar: marca sin celular con el usuario (documento) y la contraseña de Caprichos.
 * No abre sesión. La marca queda pendiente de revisión del administrador (sin QR ni GPS).
 */
export function MarcarConClavePage() {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  // '' = que el sistema elija la siguiente marca lógica (entrada, salida a break, regreso o salida)
  const [tipo, setTipo] = useState<TipoMarca | ''>('');
  const [enviando, setEnviando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const antes = document.title;
    document.title = 'Marcar asistencia';
    return () => { document.title = antes; };
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setOk(null);
    setError(null);
    try {
      const r = await marcarConClave({ usuario: usuario.trim(), contrasena, ...(tipo ? { tipo } : {}) });
      setOk(r.mensaje);
      setContrasena('');
      setTipo('');
    } catch (err) {
      setError((err as any)?.message || 'No se pudo registrar la marca. Revisa tus datos e inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="ma-publica" style={{ maxWidth: 440, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>Marcar asistencia</h1>
      <p className="as-ayuda" style={{ margin: 0 }}>
        Para cuando no puedes usar el QR del celular. Escribe tu usuario y contraseña de Caprichos. Tu marca queda pendiente de revisión del administrador.
      </p>
      <form onSubmit={(e) => void enviar(e)} style={{ display: 'grid', gap: 12 }}>
        <label className="as-campo">Usuario (tu documento)
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" inputMode="text" required maxLength={20} />
        </label>
        <label className="as-campo">Contraseña
          <input type="password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="as-campo">¿Qué vas a marcar?
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoMarca | '')}>
            <option value="">La que me toca (automático)</option>
            {(Object.keys(ETIQUETA_TIPO) as TipoMarca[]).map((t) => <option key={t} value={t}>{ETIQUETA_TIPO[t]}</option>)}
          </select>
        </label>
        <Boton type="submit" tamano="grande" disabled={enviando || !usuario.trim() || !contrasena}>
          {enviando ? 'Registrando…' : 'Marcar'}
        </Boton>
      </form>
      {ok && <div role="status" className="as-aviso as-aviso--ok">{ok}</div>}
      {error && <div role="alert" className="as-aviso as-aviso--error">{error}</div>}
    </main>
  );
}
