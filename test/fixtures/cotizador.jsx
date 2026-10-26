import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import QuoteModal from '/src/admin/components/QuoteModal.jsx';
import { ToastProvider } from '/src/shared/components/Toast.jsx';
import { ConfirmProvider } from '/src/shared/components/ConfirmDialog.jsx';
import '/src/index.css';

// Fixture aislada. Ninguna sesión o registro de producción participa aquí.
const params = new URLSearchParams(location.search);
const saved = params.has('saved');
const link = {
  id: 123, year: 2007, make: 'Bayliner', model: '175', location: 'Florida, EE. UU.',
  url: 'https://example.test/boat/123', value_usa_usd: 10000, value_to_negotiate_usd: params.has('missing') ? null : (saved ? 7200 : 4995),
  quote_data: saved ? { usd_clp_rate: 950, valor_lancha_usd: 10000, thc_usd: 249.5 } : null,
  quote_calculated_at: saved ? '2026-10-20T12:00:00' : null,
  quote_published_at: saved ? '2026-10-21T12:00:00' : null,
};

function Demo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <main style={{ padding: 40 }}>
        <h1>Expediente · IMP-DEMO</h1>
        <p style={{ marginTop: 16 }}>Ranking de embarcaciones</p>
        <button onClick={() => setOpen(true)} style={{ marginTop: 20 }}>Cotizar</button>
      </main>
      <QuoteModal open={open} link={link} onClose={() => setOpen(false)} onSaved={() => { window.quoteSaved = true; }} />
    </>
  );
}

createRoot(document.getElementById('root')).render(<ToastProvider><ConfirmProvider><Demo /></ConfirmProvider></ToastProvider>);
