import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import App from './App.jsx'

// Enlaces del panel viejo que siguen en correos ya enviados (…/panel/#myproducts,
// #payment-requests, #chat): sin esto caían en Inicio. Se traducen antes de
// montar el router, sin recargar.
const RUTAS_VIEJAS = {
  myproducts: '/expedientes', expedientes: '/expedientes', 'payment-requests': '/payments', payments: '/payments',
  pagos: '/payments', chat: '/messages', messages: '/messages', mensajes: '/messages', quotation: '/quotation',
  documents: '/documents', documentos: '/documents', inspections: '/inspections', alerts: '/alerts',
}
const viejo = window.location.hash.match(/^#([a-z-]+)(.*)$/i)
if (viejo && RUTAS_VIEJAS[viejo[1].toLowerCase()]) {
  window.history.replaceState(null, '', window.location.pathname + window.location.search + '#' + RUTAS_VIEJAS[viejo[1].toLowerCase()] + (viejo[2].startsWith('?') ? viejo[2] : ''))
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
