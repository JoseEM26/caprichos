import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Boton } from '../../comun/Boton';
import { Campo } from '../../comun/Campo';
import { Insignia } from '../../comun/Insignia';
import { comprobantesApi } from '../../admin/comprobantes/comprobantesApi';
import type {
  TipoReclamo,
  ConstanciaReclamoPublico,
  ConsultaConstanciaPublica,
} from '../../admin/comprobantes/tipos';
import { PieLegal } from './PieLegal';

export function ReclamosPublicoPage() {
  const [pestana, setPestana] = useState<'registrar' | 'consultar'>('registrar');

  // Formulario de registro
  const [tipo, setTipo] = useState<TipoReclamo>('RECLAMO');
  const [nombre, setNombre] = useState('');
  const [documento, setDocumento] = useState('');
  const [domicilio, setDomicilio] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [pedidoCodigo, setPedidoCodigo] = useState('');
  const [montoReclamado, setMontoReclamado] = useState('');
  const [detalle, setDetalle] = useState('');
  const [aceptaPrivacidad, setAceptaPrivacidad] = useState(false);

  // Errores de validación del formulario
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [constanciaCreada, setConstanciaCreada] = useState<ConstanciaReclamoPublico | null>(null);

  // Consulta de constancia
  const [numeroConsulta, setNumeroConsulta] = useState('');
  const [docConsulta, setDocConsulta] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [errorConsulta, setErrorConsulta] = useState<string | null>(null);
  const [resultadoConsulta, setResultadoConsulta] = useState<ConsultaConstanciaPublica | null>(null);

  const validarFormulario = (): boolean => {
    const nuevosErrores: Record<string, string> = {};

    if (!nombre.trim()) {
      nuevosErrores.nombre = 'El nombre es obligatorio';
    }

    const docLimpio = documento.trim();
    const docRegex = /^[0-9]{8}$|^[A-Za-z0-9]{8,12}$/;
    if (!docLimpio || !docRegex.test(docLimpio)) {
      nuevosErrores.documento = 'El documento debe ser un DNI de 8 dígitos o Carné de Extranjería válido';
    }

    if (!domicilio.trim()) {
      nuevosErrores.domicilio = 'El domicilio es obligatorio';
    }

    const telLimpio = telefono.trim();
    if (!telLimpio || !/^[0-9]{9}$/.test(telLimpio)) {
      nuevosErrores.telefono = 'El teléfono debe tener 9 dígitos';
    }

    if (correo.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())) {
      nuevosErrores.correo = 'El correo electrónico no es válido';
    }

    if (detalle.trim().length < 20) {
      nuevosErrores.detalle = 'El detalle debe tener al menos 20 caracteres';
    }

    if (montoReclamado.trim()) {
      const num = parseFloat(montoReclamado);
      if (isNaN(num) || num < 0) {
        nuevosErrores.montoReclamado = 'El monto no puede ser negativo';
      }
    }

    if (!aceptaPrivacidad) {
      nuevosErrores.privacidad = 'Debe aceptar la política de privacidad para enviar el reclamo';
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEnvio(null);

    if (!validarFormulario()) {
      return;
    }

    setEnviando(true);
    try {
      const resp = await comprobantesApi.crearReclamoPublico({
        tipo,
        nombre: nombre.trim(),
        documento: documento.trim(),
        domicilio: domicilio.trim(),
        telefono: telefono.trim(),
        correo: correo.trim() || undefined,
        pedidoCodigo: pedidoCodigo.trim() || undefined,
        montoReclamado: montoReclamado.trim() ? parseFloat(montoReclamado) : undefined,
        detalle: detalle.trim(),
        aceptaPrivacidad,
      });

      setConstanciaCreada(resp);
      setErrores({});
    } catch (err: any) {
      if (err?.statusCode === 429 || err?.codigo === 'TOO_MANY') {
        setErrorEnvio('Ha superado el límite de 5 solicitudes por hora. Por favor, intente más tarde.');
      } else if (err?.codigo === 'PRIVACIDAD_REQUERIDA') {
        setErrorEnvio('Debe aceptar la política de privacidad para enviar el reclamo');
      } else {
        setErrorEnvio(err?.message || 'Error al registrar el reclamo');
      }
    } finally {
      setEnviando(false);
    }
  };

  const handleDescargarConstancia = () => {
    if (typeof window !== 'undefined' && window.print) {
      window.print();
    }
  };

  const handleResetForm = () => {
    setConstanciaCreada(null);
    setNombre('');
    setDocumento('');
    setDomicilio('');
    setTelefono('');
    setCorreo('');
    setPedidoCodigo('');
    setMontoReclamado('');
    setDetalle('');
    setAceptaPrivacidad(false);
    setErrores({});
    setErrorEnvio(null);
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroConsulta.trim() || !docConsulta.trim()) {
      setErrorConsulta('Ingresa el número de constancia y el documento registrado');
      return;
    }

    setConsultando(true);
    setErrorConsulta(null);
    setResultadoConsulta(null);

    try {
      const res = await comprobantesApi.consultarConstanciaPublica(
        numeroConsulta.trim(),
        docConsulta.trim(),
      );
      setResultadoConsulta(res);
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.codigo === 'RECLAMO_NO_ENCONTRADO') {
        setErrorConsulta('No se encontró ningún reclamo registrado con los datos ingresados.');
      } else {
        setErrorConsulta(err?.message || 'Error al consultar la constancia');
      }
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--cp-cream)',
      }}
    >
      {/* Cabecera pública */}
      <header
        className="no-imprimir"
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--cp-line)',
          backgroundColor: 'var(--cp-white)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Link
          to="/"
          style={{
            fontFamily: 'Montserrat, sans-serif',
            fontWeight: 800,
            fontSize: '18px',
            color: 'var(--cp-navy)',
            textDecoration: 'none',
          }}
        >
          CAPRICHOS
        </Link>
        <Link
          to="/"
          style={{
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0 16px',
            borderRadius: '8px',
            border: '1.5px solid var(--cp-navy)',
            color: 'var(--cp-navy)',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '13px',
          }}
        >
          Volver a la carta
        </Link>
      </header>

      <main style={{ flex: 1, maxWidth: '780px', width: '100%', margin: '0 auto', padding: '32px 16px' }}>
        {/* Encabezado */}
        <div className="no-imprimir" style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '26px', color: 'var(--cp-navy)', marginBottom: '8px' }}>
            Libro de Reclamaciones Virtual
          </h1>
          <p style={{ color: 'var(--cp-soft)', fontSize: '14px', lineHeight: '21px', margin: 0 }}>
            Conforme a lo establecido en el Código de Protección y Defensa del Consumidor (Ley N° 29571) y el Reglamento del Libro de Reclamaciones (D.S. 011-2011-PCM).
          </p>

          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: 'var(--cp-sand)',
              fontSize: '13px',
              lineHeight: '19px',
              color: 'var(--cp-navy)',
            }}
          >
            <b>Reclamo:</b> Disconformidad relacionada a los productos o servicios ofrecidos.
            <br />
            <b>Queja:</b> Malestar o descontento respecto a la atención al público.
            <br />
            <b>Plazo de respuesta:</b> Máximo 15 días hábiles conforme a ley.
          </div>
        </div>

        {/* Pestañas de modo */}
        <div
          className="no-imprimir"
          style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '24px',
            borderBottom: '2px solid var(--cp-line)',
            paddingBottom: '8px',
          }}
        >
          <button
            type="button"
            onClick={() => setPestana('registrar')}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '8px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: pestana === 'registrar' ? 'var(--cp-navy)' : 'transparent',
              color: pestana === 'registrar' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Registrar reclamo o queja
          </button>
          <button
            type="button"
            onClick={() => setPestana('consultar')}
            style={{
              minHeight: '44px',
              padding: '0 18px',
              borderRadius: '8px',
              border: '1.5px solid var(--cp-navy)',
              backgroundColor: pestana === 'consultar' ? 'var(--cp-navy)' : 'transparent',
              color: pestana === 'consultar' ? 'var(--cp-cream)' : 'var(--cp-navy)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Consultar constancia
          </button>
        </div>

        {/* Pestaña 1: Registro */}
        {pestana === 'registrar' && (
          <div>
            {constanciaCreada ? (
              /* Vista de Constancia */
              <div
                id="constancia-impresion"
                style={{
                  backgroundColor: 'var(--cp-white)',
                  borderRadius: '16px',
                  border: '2px solid var(--cp-green)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1px solid var(--cp-line)', paddingBottom: '16px' }}>
                  <div style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--cp-green)', letterSpacing: '0.08em' }}>
                    CONSTANCIA OFICIAL REGISTRADA
                  </div>
                  <h2 style={{ fontSize: '24px', color: 'var(--cp-navy)', margin: '8px 0' }}>
                    Libro de Reclamaciones
                  </h2>
                  <div
                    data-testid="constancia-numero"
                    style={{
                      display: 'inline-block',
                      fontFamily: 'monospace',
                      fontWeight: 800,
                      fontSize: '20px',
                      backgroundColor: 'var(--cp-greenbg)',
                      color: 'var(--cp-green)',
                      padding: '6px 16px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--cp-green)',
                    }}
                  >
                    {constanciaCreada.numero}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                  <div>
                    <b>Tipo:</b> {constanciaCreada.tipo}
                  </div>
                  <div>
                    <b>Fecha de registro:</b> {new Date(constanciaCreada.fechaRegistro).toLocaleDateString('es-PE')}
                  </div>
                  <div>
                    <b>Consumidor:</b> {nombre}
                  </div>
                  <div>
                    <b>Documento:</b> {documento}
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    <b>Plazo máximo legal de atención:</b> {constanciaCreada.fechaLimite} (15 días hábiles)
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: 'var(--cp-cream)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '13px',
                    lineHeight: '19px',
                    color: 'var(--cp-soft)',
                  }}
                >
                  {constanciaCreada.mensaje}
                </div>

                <div className="no-imprimir" style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                  <Boton
                    variante="primario"
                    onClick={handleDescargarConstancia}
                  >
                    Descargar constancia
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={handleResetForm}
                  >
                    Registrar otro reclamo
                  </Boton>
                </div>
              </div>
            ) : (
              /* Formulario */
              <form
                onSubmit={handleEnviar}
                style={{
                  backgroundColor: 'var(--cp-white)',
                  borderRadius: '16px',
                  border: '1px solid var(--cp-line)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Tipo */}
                <div>
                  <label style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                    1. Identificación de la solicitud:
                  </label>
                  <div role="radiogroup" aria-label="Tipo de solicitud" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {(['RECLAMO', 'QUEJA'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={tipo === t}
                        onClick={() => setTipo(t)}
                        style={{
                          flex: 1,
                          minHeight: '44px',
                          borderRadius: '8px',
                          border: '2px solid var(--cp-navy)',
                          backgroundColor: tipo === t ? 'var(--cp-navy)' : 'transparent',
                          color: tipo === t ? 'var(--cp-cream)' : 'var(--cp-navy)',
                          fontWeight: 800,
                          fontSize: '14px',
                          cursor: 'pointer',
                        }}
                      >
                        {t === 'RECLAMO' ? 'Reclamo (Producto o servicio)' : 'Queja (Atención al cliente)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Datos del Consumidor */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px' }}>
                    2. Identificación del consumidor reclamante:
                  </label>

                  <Campo
                    id="campo-reclamo-nombre"
                    etiqueta="Nombres y apellidos completos"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    error={errores.nombre}
                    placeholder="Ej: Juan Pérez Morales"
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <Campo
                      id="campo-reclamo-documento"
                      etiqueta="Documento (DNI de 8 dígitos o carné)"
                      value={documento}
                      onChange={(e) => setDocumento(e.target.value)}
                      error={errores.documento}
                      placeholder="Ej: 12345678"
                      ayuda="DNI de 8 dígitos o carné de extranjería (8-12 carac.)"
                    />

                    <Campo
                      id="campo-reclamo-telefono"
                      etiqueta="Teléfono de contacto (9 dígitos)"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      error={errores.telefono}
                      placeholder="Ej: 987654321"
                      type="tel"
                    />
                  </div>

                  <Campo
                    id="campo-reclamo-domicilio"
                    etiqueta="Domicilio"
                    value={domicilio}
                    onChange={(e) => setDomicilio(e.target.value)}
                    error={errores.domicilio}
                    placeholder="Dirección completa para notificación"
                  />

                  <Campo
                    id="campo-reclamo-correo"
                    etiqueta="Correo electrónico (opcional)"
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    error={errores.correo}
                    placeholder="Ej: correo@ejemplo.com"
                    type="email"
                  />
                </div>

                {/* Detalle del Pedido / Reclamación */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13px' }}>
                    3. Detalle de la reclamación:
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <Campo
                      id="campo-reclamo-pedido"
                      etiqueta="Código de pedido (opcional)"
                      value={pedidoCodigo}
                      onChange={(e) => setPedidoCodigo(e.target.value)}
                      placeholder="Ej: CP-001"
                    />

                    <Campo
                      id="campo-reclamo-monto"
                      etiqueta="Monto reclamado en S/ (opcional)"
                      value={montoReclamado}
                      onChange={(e) => setMontoReclamado(e.target.value)}
                      error={errores.montoReclamado}
                      placeholder="0.00"
                      type="number"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="campo-reclamo-detalle"
                      style={{ display: 'block', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}
                    >
                      Detalle y fundamentos del reclamo o queja
                    </label>
                    <textarea
                      id="campo-reclamo-detalle"
                      rows={5}
                      value={detalle}
                      onChange={(e) => setDetalle(e.target.value)}
                      placeholder="Explica detalladamente los hechos acontecidos y la solución esperada (mínimo 20 caracteres)..."
                      style={{
                        width: '100%',
                        boxSizing: 'border-box',
                        borderRadius: '8px',
                        border: errores.detalle ? '2px solid var(--cp-rust)' : '1.5px solid var(--cp-line)',
                        padding: '10px 12px',
                        fontFamily: 'inherit',
                        fontSize: '14px',
                        resize: 'vertical',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '12px', color: 'var(--cp-soft)' }}>
                      <span>{detalle.trim().length} / 20 caracteres mínimos</span>
                      {errores.detalle && (
                        <span style={{ color: 'var(--cp-rust)', fontWeight: 700 }}>
                          {errores.detalle}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Casilla obligatoria de privacidad */}
                <div style={{ padding: '12px', borderRadius: '8px', backgroundColor: 'var(--cp-cream)', border: errores.privacidad ? '2px solid var(--cp-rust)' : '1px solid var(--cp-line)' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      id="campo-acepta-privacidad"
                      checked={aceptaPrivacidad}
                      onChange={(e) => {
                        setAceptaPrivacidad(e.target.checked);
                        if (errores.privacidad) {
                          setErrores((prev) => ({ ...prev, privacidad: '' }));
                        }
                      }}
                      style={{ width: '20px', height: '20px', marginTop: '2px', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '13px', lineHeight: '18px', color: 'var(--cp-navy)' }}>
                      Declaro ser el titular del servicio y autorizo el tratamiento de mis datos personales según la Ley N° 29733 conforme a la{' '}
                      <Link to="/legal/privacidad" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--cp-orange)', fontWeight: 700 }}>
                        Política de Privacidad
                      </Link>{' '}
                      de Caprichos (Obligatorio).
                    </span>
                  </label>
                  {errores.privacidad && (
                    <div style={{ color: 'var(--cp-rust)', fontWeight: 700, fontSize: '12px', marginTop: '6px' }}>
                      {errores.privacidad}
                    </div>
                  )}
                </div>

                {errorEnvio && (
                  <div
                    role="alert"
                    style={{
                      padding: '10px 14px',
                      borderRadius: '8px',
                      backgroundColor: '#FCEBE6',
                      border: '1.5px solid var(--cp-rust)',
                      color: 'var(--cp-rust)',
                      fontWeight: 700,
                      fontSize: '13px',
                    }}
                  >
                    {errorEnvio}
                  </div>
                )}

                <Boton
                  variante="primario"
                  type="submit"
                  cargando={enviando}
                  style={{ minHeight: '48px', fontSize: '15px' }}
                >
                  Enviar a Libro de Reclamaciones
                </Boton>
              </form>
            )}
          </div>
        )}

        {/* Pestaña 2: Consulta de constancia */}
        {pestana === 'consultar' && (
          <div
            style={{
              backgroundColor: 'var(--cp-white)',
              borderRadius: '16px',
              border: '1px solid var(--cp-line)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <div>
              <h2 style={{ fontSize: '20px', color: 'var(--cp-navy)' }}>
                Consultar Constancia de Reclamo
              </h2>
              <p style={{ color: 'var(--cp-soft)', fontSize: '13px', margin: '4px 0 0' }}>
                Ingresa el número oficial de constancia asignado y el documento del titular registrado.
              </p>
            </div>

            <form onSubmit={handleConsultar} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Campo
                id="campo-consulta-numero"
                etiqueta="Número de constancia"
                value={numeroConsulta}
                onChange={(e) => setNumeroConsulta(e.target.value)}
                placeholder="Ej: LR-2026-000001"
              />

              <Campo
                id="campo-consulta-doc"
                etiqueta="Documento de identidad del titular"
                value={docConsulta}
                onChange={(e) => setDocConsulta(e.target.value)}
                placeholder="DNI o carné registrado"
              />

              {errorConsulta && (
                <div
                  role="alert"
                  style={{
                    padding: '10px',
                    borderRadius: '8px',
                    backgroundColor: '#FCEBE6',
                    border: '1px solid var(--cp-rust)',
                    color: 'var(--cp-rust)',
                    fontWeight: 700,
                    fontSize: '13px',
                  }}
                >
                  {errorConsulta}
                </div>
              )}

              <Boton
                variante="primario"
                type="submit"
                cargando={consultando}
                deshabilitado={!numeroConsulta.trim() || !docConsulta.trim()}
              >
                Consultar constancia
              </Boton>
            </form>

            {/* Resultado de la consulta */}
            {resultadoConsulta && (
              <div
                style={{
                  border: '1.5px solid var(--cp-navy)',
                  borderRadius: '12px',
                  padding: '20px',
                  backgroundColor: 'var(--cp-cream)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 800, fontSize: '16px' }}>
                    {resultadoConsulta.numero}
                  </div>
                  <Insignia
                    variante={
                      resultadoConsulta.estado === 'RESPONDIDO'
                        ? 'exito'
                        : resultadoConsulta.estado === 'EN_REVISION'
                          ? 'aviso'
                          : 'neutro'
                    }
                  >
                    {resultadoConsulta.estado}
                  </Insignia>
                </div>

                <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div><b>Tipo:</b> {resultadoConsulta.tipo}</div>
                  <div><b>Consumidor:</b> {resultadoConsulta.nombre}</div>
                  <div><b>Fecha de registro:</b> {new Date(resultadoConsulta.fechaRegistro).toLocaleDateString('es-PE')}</div>
                  <div><b>Fecha límite legal:</b> {resultadoConsulta.fechaLimite}</div>
                </div>

                <div>
                  <div style={{ fontWeight: 700, fontSize: '13px', marginBottom: '2px' }}>Detalle registrado:</div>
                  <div style={{ padding: '8px 12px', backgroundColor: 'var(--cp-white)', borderRadius: '6px', fontSize: '13px', lineHeight: '18px' }}>
                    {resultadoConsulta.detalle}
                  </div>
                </div>

                {resultadoConsulta.respuesta && (
                  <div style={{ border: '1.5px solid var(--cp-green)', borderRadius: '8px', padding: '12px', backgroundColor: 'var(--cp-greenbg)' }}>
                    <div style={{ fontWeight: 800, fontSize: '13px', color: 'var(--cp-green)', marginBottom: '4px' }}>
                      Respuesta oficial de Caprichos:
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: '19px' }}>
                      {resultadoConsulta.respuesta}
                    </div>
                    {resultadoConsulta.respondidoEn && (
                      <div style={{ fontSize: '11px', color: 'var(--cp-soft)', marginTop: '4px' }}>
                        Fecha de respuesta: {new Date(resultadoConsulta.respondidoEn).toLocaleString('es-PE')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <PieLegal />
    </div>
  );
}
