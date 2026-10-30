import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../../comun/api';
import { Confirmar } from '../../comun/Confirmar';
import { Boton } from '../../comun/Boton';
import { Icono } from '../../comun/Icono';

interface CodigoRespuesta {
  codigo: string;
  segundosRestantes: number;
  bloqueados?: Bloqueado[];
}

interface Bloqueado {
  partyId: string;
  nombre: string;
  segundosRestantes: number;
}

export function CodigoSupervisorView() {
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([]);
  const [aDesbloquear, setADesbloquear] = useState<Bloqueado | null>(null);
  const handleDesbloquear = async () => {
    if (!aDesbloquear) return;
    try {
      await api.post('/admin/supervisor/desbloquear', { operadorPartyId: aDesbloquear.partyId });
      setADesbloquear(null);
      await cargarCodigo();
    } catch (err: any) {
      setError(err?.message || 'No se pudo desbloquear');
      setADesbloquear(null);
    }
  };

  const [codigo, setCodigo] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number>(30);
  const [sinConfigurar, setSinConfigurar] = useState<boolean>(false);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Modales de confirmación
  const [modalGenerar, setModalGenerar] = useState<boolean>(false);
  const [modalRotar, setModalRotar] = useState<boolean>(false);
  const [procesandoAccion, setProcesandoAccion] = useState<boolean>(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copiadoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargarCodigo = useCallback(async () => {
    try {
      setError(null);
      const res = await api.get<CodigoRespuesta>('/admin/supervisor/codigo');
      setCodigo(res.codigo);
      setBloqueados(res.bloqueados ?? []);
      setSegundosRestantes(Math.max(1, res.segundosRestantes));
      setSinConfigurar(false);
    } catch (err: any) {
      if (err?.codigo === 'SUPERVISOR_SIN_CONFIGURAR' || err?.response?.codigo === 'SUPERVISOR_SIN_CONFIGURAR' || err?.status === 409) {
        setSinConfigurar(true);
        setCodigo(null);
      } else {
        setError(err?.message || 'Error al obtener el código de supervisor');
      }
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarCodigo();
  }, [cargarCodigo]);

  // Tick del temporizador cada segundo
  useEffect(() => {
    if (sinConfigurar || !codigo) return;

    timerRef.current = setInterval(() => {
      setSegundosRestantes((prev) => {
        if (prev <= 1) {
          cargarCodigo();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sinConfigurar, codigo, cargarCodigo]);

  const handleCopiar = async () => {
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      if (copiadoTimerRef.current) clearTimeout(copiadoTimerRef.current);
      copiadoTimerRef.current = setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Ignorar fallo de portapapeles
    }
  };

  const handleGenerarSecreto = async () => {
    setProcesandoAccion(true);
    try {
      await api.post('/admin/supervisor/generar-secreto', {});
      setModalGenerar(false);
      await cargarCodigo();
    } catch (err: any) {
      setError(err?.message || 'Error al generar el secreto de supervisor');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const handleRotarSecreto = async () => {
    setProcesandoAccion(true);
    try {
      await api.post('/admin/supervisor/rotar-secreto', {});
      setModalRotar(false);
      await cargarCodigo();
    } catch (err: any) {
      setError(err?.message || 'Error al rotar el secreto de supervisor');
    } finally {
      setProcesandoAccion(false);
    }
  };

  const radio = 42;
  const circunferencia = 2 * Math.PI * radio;
  const progreso = (segundosRestantes / 30) * circunferencia;

  return (
    <div
      data-testid="vista-codigo-supervisor"
      style={{
        maxWidth: '680px',
        margin: '0 auto',
        padding: '24px 16px',
        fontFamily: 'Montserrat, sans-serif',
      }}
    >
      {/* Encabezado */}
      <div style={{ marginBottom: '24px', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: 'var(--cp-navy, #1B2541)',
            margin: '0 0 8px 0',
          }}
        >
          Código del supervisor
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--cp-soft, #6E717C)',
            margin: 0,
          }}
        >
          Dicta este código al cajero; cambia cada 30 segundos
        </p>
      </div>

      {/* Alerta de error */}
      {error && (
        <div
          role="alert"
          style={{
            background: 'var(--cp-cream, #F7F5EE)',
            borderLeft: '4px solid var(--cp-wine, #8B1E3F)',
            padding: '12px 16px',
            borderRadius: '6px',
            marginBottom: '20px',
            color: 'var(--cp-wine, #8B1E3F)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

      {/* Estado: Sin configurar */}
      {sinConfigurar ? (
        <div
          data-testid="panel-sin-configurar"
          style={{
            background: 'var(--cp-white, #FFFFFF)',
            border: '1px solid var(--cp-line, #D6D1C4)',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '28px',
              background: 'var(--cp-cream, #F7F5EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              color: 'var(--cp-navy, #1B2541)',
            }}
          >
            <Icono nombre="seguridad" tamano={28} />
          </div>

          <h2
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--cp-navy, #1B2541)',
              margin: '0 0 8px 0',
            }}
          >
            Código rotativo no configurado
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: 'var(--cp-soft, #6E717C)',
              lineHeight: 1.5,
              maxWidth: '460px',
              margin: '0 auto 24px auto',
            }}
          >
            El código rotativo de supervisor aún no está configurado para este local. Genera el secreto criptográfico inicial para habilitar las autorizaciones de caja, pedidos y almacén.
          </p>

          <Boton
            variante="primario"
            onClick={() => setModalGenerar(true)}
            data-testid="btn-generar-secreto"
          >
            Generar secreto
          </Boton>
        </div>
      ) : (
        /* Tarjeta principal del código */
        <div
          data-testid="tarjeta-codigo-activo"
          style={{
            background: 'var(--cp-white, #FFFFFF)',
            border: '1px solid var(--cp-line, #D6D1C4)',
            borderRadius: '16px',
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: '0 4px 16px rgba(27, 37, 65, 0.06)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
          }}
        >
          {/* Reloj con cuenta regresiva circular */}
          <div style={{ position: 'relative', width: '100px', height: '100px' }}>
            <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="50"
                cy="50"
                r={radio}
                stroke="var(--cp-line, #D6D1C4)"
                strokeWidth="7"
                fill="none"
              />
              <circle
                cx="50"
                cy="50"
                r={radio}
                stroke={segundosRestantes <= 5 ? 'var(--cp-wine, #8B1E3F)' : 'var(--cp-navy, #1B2541)'}
                strokeWidth="7"
                fill="none"
                strokeDasharray={circunferencia}
                strokeDashoffset={circunferencia - progreso}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span
                data-testid="segundos-restantes"
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  color: segundosRestantes <= 5 ? 'var(--cp-wine, #8B1E3F)' : 'var(--cp-navy, #1B2541)',
                }}
              >
                {segundosRestantes}s
              </span>
            </div>
          </div>

          {/* Código grande de 6 dígitos */}
          <div style={{ minHeight: '60px', display: 'flex', alignItems: 'center' }}>
            {cargando && !codigo ? (
              <span style={{ fontSize: '16px', color: 'var(--cp-soft, #6E717C)' }}>
                Cargando código...
              </span>
            ) : (
              <div
                data-testid="codigo-grande"
                style={{
                  fontSize: '44px',
                  fontWeight: 800,
                  letterSpacing: '8px',
                  color: 'var(--cp-navy, #1B2541)',
                  fontFamily: 'Montserrat, monospace',
                  userSelect: 'all',
                  padding: '8px 20px',
                  background: 'var(--cp-cream, #F7F5EE)',
                  borderRadius: '12px',
                  border: '1px solid var(--cp-line, #D6D1C4)',
                }}
              >
                {codigo ? `${codigo.slice(0, 3)} ${codigo.slice(3)}` : '------'}
              </div>
            )}
          </div>

          {/* Barra de progreso lineal adicional (útil en móviles) */}
          <div
            style={{
              width: '100%',
              maxWidth: '320px',
              height: '6px',
              background: 'var(--cp-cream, #F7F5EE)',
              borderRadius: '3px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${(segundosRestantes / 30) * 100}%`,
                background: segundosRestantes <= 5 ? 'var(--cp-wine, #8B1E3F)' : 'var(--cp-navy, #1B2541)',
                transition: 'width 0.8s ease, background-color 0.3s ease',
              }}
            />
          </div>

          {/* Botones de acción */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              width: '100%',
              marginTop: '8px',
            }}
          >
            <Boton
              variante="primario"
              onClick={handleCopiar}
              deshabilitado={!codigo}
              data-testid="btn-copiar-codigo"
              style={{ minWidth: '150px' }}
            >
              <Icono nombre={copiado ? 'check' : 'copiar'} tamano={18} style={{ marginRight: '6px' }} />
              {copiado ? 'Copiado' : 'Copiar código'}
            </Boton>

            <Boton
              variante="secundario"
              onClick={() => setModalRotar(true)}
              deshabilitado={cargando}
              data-testid="btn-rotar-secreto"
              style={{ minWidth: '140px' }}
            >
              Rotar secreto
            </Boton>
          </div>
        </div>
      )}

      {bloqueados.length > 0 && (
        <div data-testid="panel-bloqueados" style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--cp-navy, #1B2541)' }}>Usuarios con el código bloqueado</h2>
          {bloqueados.map((b) => (
            <div key={b.partyId} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>{b.nombre} ({b.segundosRestantes} s)</span>
              <Boton variante="secundario" onClick={() => setADesbloquear(b)}>Desbloquear</Boton>
            </div>
          ))}
        </div>
      )}

      <Confirmar
        abierto={!!aDesbloquear}
        titulo="¿Desbloquear el código del supervisor?"
        mensaje={`Se borrarán los intentos fallidos de ${aDesbloquear?.nombre ?? ''}. Queda registrado en auditoría.`}
        textoSi="Sí, desbloquear"
        textoNo="No, cancelar"
        alConfirmar={handleDesbloquear}
        alCancelar={() => setADesbloquear(null)}
      />

      {/* Modal Confirmar: Generar secreto */}
      <Confirmar
        abierto={modalGenerar}
        titulo="¿Generar secreto del supervisor?"
        mensaje="Se generará una clave criptográfica de 20 bytes aleatorios protegida con cifrado AES-256-GCM para este local. Permitirá a los supervisores visualizar y validar códigos rotativos TOTP de 6 dígitos."
        textoSi="Sí, generar secreto"
        textoNo="No, cancelar"
        cargando={procesandoAccion}
        alConfirmar={handleGenerarSecreto}
        alCancelar={() => setModalGenerar(false)}
      />

      {/* Modal Confirmar: Rotar secreto */}
      <Confirmar
        abierto={modalRotar}
        titulo="¿Rotar secreto del supervisor?"
        mensaje="Al rotar el secreto, el código actual y los anteriores quedarán invalidados inmediatamente. Se generará una nueva clave criptográfica para el local. ¿Deseas continuar?"
        textoSi="Sí, rotar secreto"
        textoNo="No, cancelar"
        peligro={true}
        cargando={procesandoAccion}
        alConfirmar={handleRotarSecreto}
        alCancelar={() => setModalRotar(false)}
      />
    </div>
  );
}
