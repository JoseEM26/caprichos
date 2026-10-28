import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TarjetaLecturaVoucher } from '../TarjetaLecturaVoucher';
import { VoucherResumenChat } from '../tipos';

describe('TarjetaLecturaVoucher (Módulo Mensajes)', () => {
  const voucherBase: VoucherResumenChat = {
    id: 'vch-1',
    semaforo: 'CONFIABLE',
    motivos: ['Monto coincide con el total del pedido', 'Titular coincide con Kevin'],
    extraido: {
      legible: true,
      monto: 45.0,
      moneda: 'PEN',
      operacion: '98765432',
      fecha: '2026-10-27',
      hora: '15:20',
      titular: 'Kevin R.',
      destinoNumero: '946388934',
      medioDetectado: 'YAPE',
      confianza: 0.95,
    },
    medio: 'YAPE',
    pedidoTotal: 45.0,
  };

  it('renderiza la tarjeta con semáforo CONFIABLE, motivos y marca "coincide"', () => {
    render(
      <TarjetaLecturaVoucher
        voucher={voucherBase}
        pedido={{ total: 45.0, medio: 'YAPE' }}
        puedeVer={true}
      />,
    );

    expect(screen.getByText('Lectura del voucher')).toBeDefined();
    expect(screen.getByText('Confiable')).toBeDefined();

    // Motivos
    expect(
      screen.getByText(/Monto coincide con el total del pedido/i),
    ).toBeDefined();

    // Datos y comparaciones
    expect(screen.getByText(/S\/ 45.00/i)).toBeDefined();
    expect(screen.getAllByText('(coincide)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('98765432')).toBeDefined();
    expect(screen.getByText('Kevin R.')).toBeDefined();
    expect(screen.getByText('946388934')).toBeDefined();

    // Regla de oro fija obligatoria
    expect(
      screen.getByText(
        'La IA solo lee la foto. Tu decides: Aprobar el pago o Rechazar.',
      ),
    ).toBeDefined();
  });

  it('detecta diferencia en el monto y muestra "no coincide"', () => {
    const voucherMontoDiferente: VoucherResumenChat = {
      ...voucherBase,
      semaforo: 'OBSERVADO',
      motivos: ['Monto menor al pedido: leído S/ 40.00, pedido S/ 45.00'],
      extraido: {
        ...voucherBase.extraido!,
        monto: 40.0,
      },
    };

    render(
      <TarjetaLecturaVoucher
        voucher={voucherMontoDiferente}
        pedido={{ total: 45.0, medio: 'YAPE' }}
        puedeVer={true}
      />,
    );

    expect(screen.getByText('Observado')).toBeDefined();
    expect(screen.getByText('(no coincide)')).toBeDefined();
    expect(screen.getByText(/Monto menor al pedido/i)).toBeDefined();
  });

  it('muestra aviso obligatorio si el semáforo es ILEGIBLE', () => {
    const voucherIlegible: VoucherResumenChat = {
      id: 'vch-2',
      semaforo: 'ILEGIBLE',
      motivos: ['La imagen está borrosa o recortada'],
      extraido: {
        legible: false,
        monto: null,
        operacion: null,
        fecha: null,
        hora: null,
        titular: null,
        destinoNumero: null,
        medioDetectado: null,
        confianza: 0.2,
      },
    };

    render(
      <TarjetaLecturaVoucher
        voucher={voucherIlegible}
        pedido={{ total: 50.0 }}
        puedeVer={true}
      />,
    );

    expect(screen.getByText('Ilegible')).toBeDefined();
    expect(
      screen.getByText(
        'No se lee: sube otra foto o confirma sin comprobante con código del supervisor.',
      ),
    ).toBeDefined();
  });

  it('no renderiza nada si puedeVer es false (control de permiso vouchers/ver)', () => {
    const { container } = render(
      <TarjetaLecturaVoucher
        voucher={voucherBase}
        pedido={{ total: 45.0 }}
        puedeVer={false}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('soporta semáforo RARO y SIN_LECTURA', () => {
    const voucherRaro: VoucherResumenChat = {
      id: 'vch-3',
      semaforo: 'RARO',
      motivos: ['Operación ya utilizada en otro pedido'],
    };

    const { rerender } = render(
      <TarjetaLecturaVoucher voucher={voucherRaro} puedeVer={true} />,
    );
    expect(screen.getByText('Raro')).toBeDefined();

    const voucherSinLectura: VoucherResumenChat = {
      id: 'vch-4',
      semaforo: 'SIN_LECTURA',
      motivos: ['IA apagada o sin servicio'],
    };

    rerender(
      <TarjetaLecturaVoucher voucher={voucherSinLectura} puedeVer={true} />,
    );
    expect(screen.getByText('Sin lectura')).toBeDefined();
  });
});
