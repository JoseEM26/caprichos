import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RetratoAvatar } from '../RetratoAvatar';

describe('RetratoAvatar sin imagen', () => {
  it('si la imagen falla muestra el círculo con postre, no un ícono roto', () => {
    render(<RetratoAvatar url="/no-existe.png" tamano={80} />);
    fireEvent.error(screen.getByTestId('retrato-avatar'));
    expect(screen.queryByTestId('retrato-avatar')).toBeNull();
    expect(screen.getByTestId('retrato-avatar-vacio')).toBeTruthy();
  });
  it('sin url tampoco deja una imagen vacía', () => {
    render(<RetratoAvatar url="" tamano={80} />);
    expect(screen.getByTestId('retrato-avatar-vacio')).toBeTruthy();
  });
});
