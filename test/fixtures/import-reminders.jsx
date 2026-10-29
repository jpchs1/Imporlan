import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ImportReminders from '/src/admin/pages/orders/ImportReminders.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import '/src/index.css';
function Demo() {
  const [orderId, setOrderId] = useState(1);
  return <ToastProvider><main style={{ maxWidth: 960, margin: '32px auto', padding: 16 }}>
    <h1>Expediente de ejemplo {orderId}</h1><button onClick={() => setOrderId(1)}>Expediente A</button><button onClick={() => setOrderId(2)}>Expediente B</button>
    <ImportReminders orderId={orderId} />
  </main></ToastProvider>;
}
createRoot(document.getElementById('root')).render(<Demo />);
