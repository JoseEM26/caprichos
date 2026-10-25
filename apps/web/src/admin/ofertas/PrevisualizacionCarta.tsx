import { useState, useMemo } from 'react';
import { OfertaItem } from './ofertasApi';
import { TarjetaOferta } from '../../carta/TarjetaOferta';
import { VentanaProductoCarta } from '../../carta/VentanaProductoCarta';
import { CarritoProvider } from '../../carta/CarritoContext';
import { ProductoCarta, CategoriaCarta, GrupoOpcionesCarta } from '../../carta/tipos';

export interface PrevisualizacionCartaProps {
  oferta: Partial<OfertaItem>;
  productosDisponibles?: Array<{
    id: string;
    nombre: string;
    categoriaId?: string;
    categoria?: string;
    precio?: number;
    noSumaBeneficios?: boolean;
    grupos?: any[];
  }>;
  categoriasDisponibles?: Array<{
    id: string;
    nombre: string;
    productos?: any[];
  }>;
  vistaInicial?: 'tarjeta' | 'abierta';
  dispositivoInicial?: 'celular' | 'pc';
}

function calcularVigenciaPreview(oferta: Partial<OfertaItem>): boolean {
  if (oferta.vigenteAhora !== undefined) {
    return Boolean(oferta.vigenteAhora);
  }
  const ahora = new Date();
  // Validar fechas
  const fInicio = oferta.fechaDesde || oferta.fechaInicio;
  const fFin = oferta.fechaHasta || oferta.fechaFin;
  if (fInicio) {
    const dIni = new Date(`${fInicio.slice(0, 10)}T00:00:00`);
    if (ahora < dIni) return false;
  }
  if (fFin) {
    const dFin = new Date(`${fFin.slice(0, 10)}T23:59:59`);
    if (ahora > dFin) return false;
  }
  // Validar días
  const dias = oferta.dias || oferta.diasSemana;
  if (Array.isArray(dias) && dias.length > 0) {
    // 1=lun..7=dom
    const diaHoy = ahora.getDay() === 0 ? 7 : ahora.getDay();
    if (!dias.includes(diaHoy)) {
      return false;
    }
  }
  // Validar horario
  const hInicio = oferta.horaDesde || oferta.horaInicio;
  const hFin = oferta.horaHasta || oferta.horaFin;
  if (hInicio && hFin) {
    const minsHoy = ahora.getHours() * 60 + ahora.getMinutes();
    const [h1, m1] = hInicio.split(':').map(Number);
    const [h2, m2] = hFin.split(':').map(Number);
    const iniMins = (h1 || 0) * 60 + (m1 || 0);
    const finMins = (h2 || 0) * 60 + (m2 || 0);
    if (minsHoy < iniMins || minsHoy > finMins) {
      return false;
    }
  }
  return true;
}

export function PrevisualizacionCarta({
  oferta,
  productosDisponibles = [],
  categoriasDisponibles = [],
  vistaInicial = 'tarjeta',
  dispositivoInicial = 'pc',
}: PrevisualizacionCartaProps) {
  const [vista, setVista] = useState<'tarjeta' | 'abierta'>(vistaInicial);
  const [dispositivo, setDispositivo] = useState<'celular' | 'pc'>(dispositivoInicial);

  const esCelular = dispositivo === 'celular';
  const aplicaHoy = calcularVigenciaPreview(oferta);

  // Normalizar el objeto OfertaItem para TarjetaOferta
  const ofertaNormalizada: OfertaItem = useMemo(() => {
    return {
      id: oferta.id || 'preview-oferta-id',
      tipo: oferta.tipo || 'COMBO',
      nombre: (oferta.nombre || 'Nombre de la oferta').trim() || 'Nombre de la oferta',
      descripcion: oferta.descripcion || null,
      lleva: oferta.lleva ?? 2,
      paga: oferta.paga ?? 1,
      subtipo: oferta.subtipo || null,
      aplicaA: oferta.aplicaA || 'TODA_LA_CARTA',
      alcanceCategoriaId: oferta.alcanceCategoriaId || null,
      alcanceProductoId: oferta.alcanceProductoId || null,
      categoriaId: oferta.categoriaId || null,
      categoriaNombre: oferta.categoriaNombre || null,
      productoId: oferta.productoId || null,
      productoNombre: oferta.productoNombre || null,
      descuentoTipo: oferta.descuentoTipo || null,
      descuentoValor: oferta.descuentoValor ?? null,
      compraMinima: oferta.compraMinima ?? null,
      dias: oferta.dias || oferta.diasSemana || [],
      diasSemana: oferta.diasSemana || oferta.dias || [],
      horaDesde: oferta.horaDesde || oferta.horaInicio || null,
      horaHasta: oferta.horaHasta || oferta.horaFin || null,
      horaInicio: oferta.horaInicio || oferta.horaDesde || null,
      horaFin: oferta.horaFin || oferta.horaHasta || null,
      fechaDesde: oferta.fechaDesde || oferta.fechaInicio || null,
      fechaHasta: oferta.fechaHasta || oferta.fechaFin || null,
      canales: oferta.canales || ['TODOS'],
      limiteUsos: oferta.limiteUsos ?? null,
      usosActuales: oferta.usosActuales ?? 0,
      noSumaBeneficios: oferta.noSumaBeneficios ?? false,
      orden: oferta.orden ?? 1,
      activo: oferta.activo ?? true,
      creadoEn: oferta.creadoEn || new Date().toISOString(),
      vigenteAhora: aplicaHoy,
      imagenArchivoId: oferta.imagenArchivoId || null,
      imagenUrl: oferta.imagenUrl || null,
      combosPrecio: oferta.combosPrecio || oferta.combosPrecios || [],
      combosPrecios: oferta.combosPrecios || oferta.combosPrecio || [],
      combosParte: oferta.combosParte || oferta.combosPartes || [],
      combosPartes: oferta.combosPartes || oferta.combosParte || [],
      llevaPaga: oferta.llevaPaga || null,
    };
  }, [oferta, aplicaHoy]);

  // Lista de productos reales normalizados para TarjetaOferta
  const productosCarta: ProductoCarta[] = useMemo(() => {
    return productosDisponibles.map((p) => ({
      id: String(p.id),
      nombre: p.nombre,
      descripcion: null,
      fotoUrl: null,
      precio: p.precio || 0,
      tamanos: [],
      grupos: p.grupos || [],
      sabores: [],
      noSumaBeneficios: Boolean(p.noSumaBeneficios),
      disponible: true,
      agotadoHasta: null,
    }));
  }, [productosDisponibles]);

  // Lista de categorías normalizadas
  const categoriasCarta: CategoriaCarta[] = useMemo(() => {
    return categoriasDisponibles.map((c, idx) => ({
      id: String(c.id),
      nombre: c.nombre,
      orden: idx + 1,
      productos: (c.productos || []).map((p: any) => ({
        id: String(p.id),
        nombre: p.nombre,
        descripcion: null,
        fotoUrl: null,
        precio: p.precio || 0,
        tamanos: [],
        grupos: [],
        sabores: [],
        noSumaBeneficios: false,
        disponible: true,
        agotadoHasta: null,
      })),
    }));
  }, [categoriasDisponibles]);

  // Construcción del producto simulado para VentanaProductoCarta ("Al abrirla")
  const productoSimulado: ProductoCarta = useMemo(() => {
    const precios = oferta.combosPrecio || oferta.combosPrecios || [];
    const precioBase = precios.length > 0 && precios[0]?.precio ? Number(precios[0].precio) : (Number(oferta.descuentoValor) || 0);

    const tamanosSimulados = precios.length > 0
      ? precios.map((p, idx) => ({
          id: `tam-${idx + 1}`,
          nombre: p.tamanoNombre || 'Regular',
          precio: Number(p.precio) || 0,
        }))
      : [{ id: 'tam-1', nombre: 'Regular', precio: precioBase }];

    const partes = oferta.combosParte || oferta.combosPartes || [];
    const gruposSimulados: GrupoOpcionesCarta[] = [];

    if (oferta.tipo === 'COMBO' && partes.length > 0) {
      partes.forEach((parte, idxParte) => {
        const nombreParte = parte.nombre?.trim() || `Parte ${idxParte + 1}`;
        const cantidadParte = parte.cantidad || 1;
        const tipoParte = parte.tipoParte || parte.tipo || 'A_ELECCION';

        // Obtener productos candidatos para esta parte
        const categoriasDeParte = parte.categorias || [];
        const idsProds = (parte.productos || []).map((pr: any) => String(typeof pr === 'object' ? pr.productoId || pr.id : pr));

        let opcionesParte = productosDisponibles
          .filter((p) => {
            if (idsProds.length > 0 && idsProds.includes(String(p.id))) return true;
            if (categoriasDeParte.length > 0 && p.categoria && categoriasDeParte.some((c: any) => String(c).toLowerCase() === p.categoria?.toLowerCase())) {
              return true;
            }
            return false;
          })
          .map((p) => ({
            id: `opc-p-${p.id}`,
            nombre: p.nombre,
            precioExtra: 0,
            disponible: true,
          }));

        // Si no hay productos del catálogo vinculados aún, generar opciones simuladas ilustrativas
        if (opcionesParte.length === 0) {
          if (tipoParte === 'FIJO') {
            opcionesParte = [{ id: `opc-fijo-${idxParte}`, nombre: nombreParte, precioExtra: 0, disponible: true }];
          } else {
            opcionesParte = [
              { id: `opc-sim-${idxParte}-1`, nombre: `${nombreParte} Clásico`, precioExtra: 0, disponible: true },
              { id: `opc-sim-${idxParte}-2`, nombre: `${nombreParte} Especial`, precioExtra: 0, disponible: true },
            ];
          }
        }

        // Crear pasos según la cantidad
        for (let i = 1; i <= cantidadParte; i++) {
          const pasoTitulo = cantidadParte > 1 ? `${nombreParte} ${i}` : nombreParte;
          gruposSimulados.push({
            id: `sec-${idxParte}-${i}`,
            // El formato «Paso · Tipo» hace que VentanaProductoCarta lo arme como acordeón de combo
            nombre: `${pasoTitulo} · ${nombreParte}`,
            obligatorio: true,
            minimo: 1,
            maximo: 1,
            opciones: opcionesParte,
          });
        }
      });
    } else {
      // Para promociones 2x1 o descuentos simples, ilustrar con producto representativo o base
      gruposSimulados.push({
        id: 'sec-base',
        nombre: 'Personalización · Opciones',
        obligatorio: false,
        minimo: 0,
        maximo: 2,
        opciones: [
          { id: 'opc-1', nombre: 'Tradicional', precioExtra: 0, disponible: true },
          { id: 'opc-2', nombre: 'Extra sabor', precioExtra: 2, disponible: true },
        ],
      });
    }

    return {
      id: oferta.id || 'preview-prod-id',
      nombre: (oferta.nombre || 'Combo especial').trim() || 'Combo especial',
      descripcion: oferta.descripcion || 'Selecciona las opciones para armar tu pedido.',
      fotoUrl: oferta.imagenUrl || null,
      precio: precioBase,
      tamanos: tamanosSimulados,
      grupos: gruposSimulados,
      sabores: [],
      noSumaBeneficios: false,
      disponible: true,
      agotadoHasta: null,
    };
  }, [oferta, productosDisponibles]);

  return (
    <CarritoProvider>
      <div
        data-testid="previsualizacion-carta"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {/* Barra superior de controles del Preview */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            padding: '8px 12px',
            borderRadius: '12px',
            backgroundColor: 'var(--cp-sand)',
            border: '1px solid var(--cp-line)',
          }}
        >
          {/* Conmutador de vista: Tarjeta vs Al abrirla */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginRight: '4px' }}>
              Vista:
            </span>
            <button
              type="button"
              onClick={() => setVista('tarjeta')}
              aria-pressed={vista === 'tarjeta'}
              data-testid="btn-vista-tarjeta"
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: vista === 'tarjeta' ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: vista === 'tarjeta' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Tarjeta en la lista
            </button>
            <button
              type="button"
              onClick={() => setVista('abierta')}
              aria-pressed={vista === 'abierta'}
              data-testid="btn-vista-abierta"
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: vista === 'abierta' ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: vista === 'abierta' ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Al abrirla (personalizar)
            </button>
          </div>

          {/* Selector de dispositivo: Celular vs PC */}
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--cp-navy)', marginRight: '4px' }}>
              Dispositivo:
            </span>
            <button
              type="button"
              onClick={() => setDispositivo('celular')}
              aria-pressed={esCelular}
              data-testid="btn-disp-celular"
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: esCelular ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: esCelular ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Celular (390px)
            </button>
            <button
              type="button"
              onClick={() => setDispositivo('pc')}
              aria-pressed={!esCelular}
              data-testid="btn-disp-pc"
              style={{
                minHeight: '34px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1.5px solid var(--cp-navy)',
                backgroundColor: !esCelular ? 'var(--cp-navy)' : 'var(--cp-white)',
                color: !esCelular ? 'var(--cp-cream)' : 'var(--cp-navy)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              PC (escritorio)
            </button>
          </div>
        </div>

        {/* Marco de previsualización (simulador de celular o PC) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            padding: '12px 0',
            backgroundColor: 'color-mix(in srgb, var(--cp-sand) 30%, transparent)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}
        >
          <div
            data-testid={`preview-container-${dispositivo}`}
            style={{
              width: esCelular ? '390px' : '100%',
              maxWidth: esCelular ? '390px' : '720px',
              minHeight: esCelular ? '480px' : '360px',
              maxHeight: '620px',
              border: esCelular ? '8px solid var(--cp-navy)' : '2px solid var(--cp-line)',
              borderRadius: esCelular ? '28px' : '16px',
              backgroundColor: 'var(--cp-cream)',
              boxShadow: esCelular
                ? '0 14px 40px rgba(11, 44, 62, 0.25)'
                : '0 6px 20px rgba(11, 44, 62, 0.08)',
              padding: esCelular ? '12px' : '18px',
              boxSizing: 'border-box',
              overflowY: 'auto',
              position: 'relative',
              transform: 'translate3d(0, 0, 0)',
              contain: 'paint',
            }}
          >
            {/* Header decorativo de celular (notch) */}
            {esCelular && (
              <div
                style={{
                  width: '120px',
                  height: '14px',
                  backgroundColor: 'var(--cp-navy)',
                  borderRadius: '0 0 10px 10px',
                  margin: '-12px auto 10px',
                }}
              />
            )}

            {vista === 'tarjeta' ? (
              <div style={{ maxWidth: esCelular ? '100%' : '320px', margin: '0 auto' }}>
                <TarjetaOferta
                  oferta={ofertaNormalizada}
                  productos={productosCarta}
                  categorias={categoriasCarta}
                  esMovilPreview={esCelular}
                />
              </div>
            ) : (
              <div style={{ width: '100%', minHeight: '400px' }}>
                <VentanaProductoCarta
                  producto={productoSimulado}
                  esBebida={false}
                  onCerrar={() => {}}
                  soloLectura={true}
                  esMovilPreview={esCelular}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </CarritoProvider>
  );
}
