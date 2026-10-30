import { BrowserRouter } from 'react-router-dom';
import { SesionProvider } from './comun/sesion';
import { RutasApp } from './rutas';
import './estilos/tema.css';

export default function App() {
  return (
    <BrowserRouter>
      <SesionProvider>
        <RutasApp />
      </SesionProvider>
    </BrowserRouter>
  );
}
