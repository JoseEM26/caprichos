import { useState, useEffect } from 'react';
import { ROLES_SISTEMA } from '@caprichos/compartido';

export default function App() {
  const [salud, setSalud] = useState<string>('Verificando API...');

  useEffect(() => {
    fetch('/salud')
      .then((res) => res.json())
      .then((data) => setSalud(JSON.stringify(data)))
      .catch(() => setSalud('API local no conectada o fuera de línea'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Caprichos — Café Artesanal en Lima</h1>
      <p>Plataforma digital: carta virtual, administración y pantallas de cocina.</p>
      <section style={{ marginTop: '1.5rem', padding: '1rem', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Estado de la Plataforma</h2>
        <p><strong>Estado API:</strong> {salud}</p>
        <p><strong>Roles configurados:</strong> {Object.keys(ROLES_SISTEMA).join(', ')}</p>
      </section>
    </main>
  );
}
