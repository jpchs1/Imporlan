import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ImportReminders from '/src/admin/pages/orders/ImportReminders.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import { AuthProvider } from '/src/shared/context/AuthContext.jsx';
import { MemoryRouter } from 'react-router-dom';
import Payments from '/src/user/pages/Payments.jsx';
import '/src/index.css';
function Demo() {
  const [orderId, setOrderId] = useState(1);
  return <ToastProvider><main style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
    <h1>Expediente de ejemplo {orderId}</h1><button onClick={() => setOrderId(1)}>Expediente A</button><button onClick={() => setOrderId(2)}>Expediente B</button>
    <ImportReminders orderId={orderId} />
  </main></ToastProvider>;
}
const keys = { token: 'imporlan_token', user: 'imporlan_user' };
createRoot(document.getElementById('root')).render(new URLSearchParams(location.search).get('mode') === 'payments' ? <MemoryRouter initialEntries={['/payments?pagar=fixture-p2']}><AuthProvider storageKeys={keys}><ToastProvider><Payments /></ToastProvider></AuthProvider></MemoryRouter> : <Demo />);
