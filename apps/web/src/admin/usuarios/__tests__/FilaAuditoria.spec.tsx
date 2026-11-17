import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilaAuditoria } from '../FilaAuditoria';
import type { RegistroAuditoriaItem } from '../tipos';

const registro: RegistroAuditoriaItem = {
  id: '1',
  categoria: 'CAMBIO',
  modulo: 'catalogo',
  accion: 'OCULTAR_PRODUCTO',
  resultado: 'OK',
  entidad: 'producto',
  entidadId: '45',
  antes: { oculto: false },
  despues: { oculto: true },
  motivo: null,
  partyId: '12',
  conPinAdmin: false,
  ip: '127.0.0.1',
  dispositivo: null,
  requestId: null,
  en: '2026-11-16T19:32:00Z',
  hashAnterior: null,
  hash: 'abc123',
  usuarioNombre: 'Ana Paz',
  entidadNombre: 'Torta de chocolate',
  descripcion: 'Desactivó (ocultó) el producto «Torta de chocolate»',
};

describe('FilaAuditoria', () => {
  it('muestra la frase en negrita, quién y cuándo, y nunca el Party ID', () => {
    render(<FilaAuditoria registro={registro} expandido={false} alAlternar={() => {}} />);
    expect(screen.getByText('Desactivó (ocultó) el producto «Torta de chocolate»').tagName).toBe('STRONG');
    expect(screen.getByText(/👤 Ana Paz · .*16 nov.*14:32/)).toBeInTheDocument();
    expect(screen.queryByText(/Party ID/i)).toBeNull();
  });

  it('sin nombre de usuario dice «Usuario desconocido»', () => {
    render(<FilaAuditoria registro={{ ...registro, usuarioNombre: null }} expandido={false} alAlternar={() => {}} />);
    expect(screen.getByText(/Usuario desconocido/)).toBeInTheDocument();
  });

  it('el detalle técnico (huellas, ids, JSON) va colapsado y se abre con el botón', () => {
    const alAlternar = vi.fn();
    const { rerender } = render(<FilaAuditoria registro={registro} expandido={false} alAlternar={alAlternar} />);
    expect(screen.queryByText(/HUELLA ACTUAL/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Detalle técnico' }));
    expect(alAlternar).toHaveBeenCalledTimes(1);
    rerender(<FilaAuditoria registro={registro} expandido={true} alAlternar={alAlternar} />);
    expect(screen.getByText(/HUELLA ACTUAL/)).toBeInTheDocument();
    expect(screen.getByText(/ESTADO ANTES/)).toBeInTheDocument();
  });

  it('sin descripción (respuesta anterior) usa la etiqueta de la acción', () => {
    render(<FilaAuditoria registro={{ ...registro, descripcion: undefined }} expandido={false} alAlternar={() => {}} />);
    expect(screen.getByText('Desactivar producto')).toBeInTheDocument();
  });
});
