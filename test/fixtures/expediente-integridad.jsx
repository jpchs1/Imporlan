import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import Orders from '/src/admin/pages/Orders.jsx';
import CustomerDetail from '/src/user/pages/expedientes/DetalleExpediente.jsx';
import Ranking from '/src/user/pages/expedientes/RankingEmbarcaciones.jsx';
import Summary from '/src/user/pages/expedientes/ResumenCotizacion.jsx';
import { useExpedienteFiles } from '/src/admin/components/useExpedienteFiles.js';
import { AuthProvider } from '/src/shared/context/AuthContext.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import { ConfirmProvider } from '/src/shared/components/ConfirmDialog.jsx';
import { esLinkVacio } from '/src/shared/lib/link-vacio.js';
import '/src/index.css';
const mode = new URLSearchParams(location.search).get('mode');
const order = window.initialOrder;
function Files() {
  const [id, setId] = useState(35);
  const { files, loading, error, recargar } = useExpedienteFiles(id);
  return <><button onClick={() => setId(36)}>Expediente B</button><button onClick={recargar}>Actualizar archivos</button><p data-file-order>{id}</p><p role="status">{loading ? 'Cargando' : error || 'Listo'}</p><ul>{files.map(f => <li key={f.id}>{f.original_name}</li>)}</ul></>;
}
function Prices() {
  return <><Ranking order={order} links={order.links} dnd={() => ({})} onMoveUp={() => {}} onMoveDown={() => {}} /><Summary link={window.summaryLink || order.links[0]} /></>;
}
window.testEmptyLink = esLinkVacio;
createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={['/orders?id=35']}><AuthProvider><ToastProvider><ConfirmProvider>
    <main className="workspace-demo-main"><div className="workspace-demo-shell">
      {mode === 'files' ? <Files /> : mode === 'prices' ? <Prices /> : mode === 'admin' ? <Orders /> : <CustomerDetail orderId={35} />}
    </div></main>
  </ConfirmProvider></ToastProvider></AuthProvider></MemoryRouter>
);
