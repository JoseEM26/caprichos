import { Component, type ReactNode } from 'react';
import { EstadoError } from './EstadoError';

interface LimiteErrorProps {
  children: ReactNode;
}

interface LimiteErrorState {
  tieneError: boolean;
}

/**
 * Si la pantalla revienta al pintar, muestra el EstadoError existente («Ocurrió un problema»)
 * con «Reintentar» en vez de dejar la página en blanco.
 */
export class LimiteError extends Component<LimiteErrorProps, LimiteErrorState> {
  state: LimiteErrorState = { tieneError: false };

  static getDerivedStateFromError(): LimiteErrorState {
    return { tieneError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Error de pantalla capturado por LimiteError:', error);
  }

  render() {
    if (this.state.tieneError) {
      return (
        <EstadoError
          mensaje="No se pudo mostrar esta pantalla. Pulsa «Reintentar» o recarga la página."
          alReintentar={() => this.setState({ tieneError: false })}
        />
      );
    }
    return this.props.children;
  }
}
