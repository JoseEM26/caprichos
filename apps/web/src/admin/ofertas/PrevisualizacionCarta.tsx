import { useState, useMemo } from 'react';
import { OfertaItem } from './ofertasApi';
import { TarjetaOferta } from '../../carta/TarjetaOferta';
import { VentanaProductoCarta } from '../../carta/VentanaProductoCarta';
import { CarritoProvider } from '../../carta/CarritoContext';
import { RaizCartaPrevia } from '../../carta/RaizCarta';
import { ConmutadorDispositivo, MarcoDispositivo } from '../../comun/MarcoDispositivo';
import { ProductoCarta, CategoriaCarta, GrupoOpcionesCarta } from '../../carta/tipos';
import { partesParaVistaPrevia } from './partesVistaPrevia';
import type { ProductoEditor } from './partesComboModelo';

export interface PrevisualizacionCartaProps {
  oferta: Partial<OfertaItem>;
  productosDisponibles?: Array<{
    id: string;
    nombre: string;
    categoriaId?: string;
    categoria?: string;
    precio?: number;
    fotoUrl?: string | null;
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

  // Partes con la misma forma que la carta recibe (opciones de cada parte, bebidas): el combo abre el mismo asistente
  const partesCombo = useMemo(
    () => (oferta.tipo === 'COMBO' ? partesParaVistaPrevia(oferta.combosParte || oferta.combosPartes || [], productosDisponibles as ProductoEditor[], categoriasDisponibles) : (oferta.combosParte || oferta.combosPartes || [])),
    [oferta, productosDisponibles, categoriasDisponibles],
  );
  const esComboConPartes = oferta.tipo === 'COMBO' && partesCombo.length > 0;

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
      alcanceCategoriaIds: oferta.alcanceCategoriaIds || [],
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
      combosParte: partesCombo,
      combosPartes: partesCombo,
      llevaPaga: oferta.llevaPaga || null,
    };
  }, [oferta, aplicaHoy, partesCombo]);

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
          tamanoValorId: p.tamanoValorId ?? null,
        }))
      : [{ id: 'tam-1', nombre: 'Regular', precio: precioBase }];

    const gruposSimulados: GrupoOpcionesCarta[] = [];

    if (!esComboConPartes) {
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
  }, [oferta, esComboConPartes]);

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
        <div className="mdv-barra" style={{ justifyContent: 'space-between' }}>
          <ConmutadorDispositivo celular={esCelular} onCambiar={(c) => setDispositivo(c ? 'celular' : 'pc')} />
          <div className="mdv-conmutador" role="group" aria-label="Vista">
            <button type="button" className="mdv-btn" aria-pressed={vista === 'tarjeta'} data-testid="btn-vista-tarjeta" onClick={() => setVista('tarjeta')}>
              Tarjeta en la lista
            </button>
            <button type="button" className="mdv-btn" aria-pressed={vista === 'abierta'} data-testid="btn-vista-abierta" onClick={() => setVista('abierta')}>
              Al abrirla (personalizar)
            </button>
          </div>
        </div>

        <MarcoDispositivo celular={esCelular}>
          <RaizCartaPrevia rejilla={vista === 'tarjeta'}>
            {() => vista === 'tarjeta' ? (
              <TarjetaOferta oferta={ofertaNormalizada} productos={productosCarta} categorias={categoriasCarta} esMovilPreview={esCelular} />
            ) : (
              <VentanaProductoCarta producto={productoSimulado} esBebida={false} onCerrar={() => setVista('tarjeta')} soloLectura={true} esMovilPreview={esCelular} oferta={esComboConPartes ? ofertaNormalizada : null} />
            )}
          </RaizCartaPrevia>
        </MarcoDispositivo>
      </div>
    </CarritoProvider>
  );
}
