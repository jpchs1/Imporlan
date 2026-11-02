import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ImportReminders from '/src/admin/pages/orders/ImportReminders.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import { AuthProvider } from '/src/shared/context/AuthContext.jsx';
import { MemoryRouter } from 'react-router-dom';
import Payments from '/src/user/pages/Payments.jsx';
import PaymentCredits from '/src/shared/components/PaymentCredits.jsx';
import '/src/index.css';
function Demo() {
  const [orderId, setOrderId] = useState(1);
  return <ToastProvider><main style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
    <h1>Expediente de ejemplo {orderId}</h1><button onClick={() => setOrderId(1)}>Expediente A</button><button onClick={() => setOrderId(2)}>Expediente B</button>
    <ImportReminders orderId={orderId} />
  </main></ToastProvider>;
}
const keys = { token: 'imporlan_token', user: 'imporlan_user' };
const params = new URLSearchParams(location.search);
const creditRequest = {id:'fixture-credit',title:'Pago 2 de prueba',amount_clp:10000,status:'pending',user_email:'client@example.test'};
createRoot(document.getElementById('root')).render(params.get('mode') === 'credits' ? <ToastProvider><main style={{maxWidth:700,margin:'24px auto',padding:16}}><PaymentCredits request={creditRequest} admin /></main></ToastProvider> : params.get('mode') === 'payments' ? <MemoryRouter initialEntries={[`/payments?${params.get('proof') ? 'comprobante' : 'pagar'}=${params.get('request') || 'fixture-p2'}`]}><AuthProvider storageKeys={keys}><ToastProvider><Payments /></ToastProvider></AuthProvider></MemoryRouter> : <Demo />);
