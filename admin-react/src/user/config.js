import {
  Home, FolderOpen, CreditCard, MessageCircle, FileText, ClipboardCheck, Ship,
  Link2, Layers, Store, Bell, LifeBuoy, CircleUser, Waves,
} from '../shared/components/Icons';

export const STORAGE_KEYS = { token: 'imporlan_token', user: 'imporlan_user' };

export const BRANDING = {
  title: 'Imporlan',
  subtitle: 'Mi panel',
};

export const NAV_GROUPS = [
  { id: 'principal', label: null },
  { id: 'importacion', label: 'Tu importación' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'cuenta', label: 'Cuenta' },
  { id: 'deckeva', label: null },
];

/**
 * Menú del cliente. `to` se mantiene (los correos enlazan a #/expedientes,
 * #/payments, …). `mobileTab` = posición en la barra inferior de móvil
 * (4 pestañas + "Más"). `badgeTone: 'danger'` solo para mensajes sin leer.
 * `/imports` y `/deckeva` siguen siendo rutas; "Mis Importaciones" ya no está
 * en el menú (es el filtro "En importación" de Expedientes).
 */
export const NAV_ITEMS = [
  // Principal
  { to: '/dashboard', label: 'Inicio', group: 'principal', icon: Home, mobileTab: 1 },
  { to: '/expedientes', label: 'Expedientes', group: 'principal', icon: FolderOpen, mobileTab: 2 },
  { to: '/payments', label: 'Pagos', group: 'principal', icon: CreditCard, mobileTab: 3 },
  { to: '/messages', label: 'Mensajes', group: 'principal', icon: MessageCircle, mobileTab: 4, badgeTone: 'danger' },

  // Tu importación
  { to: '/documents', label: 'Documentos', group: 'importacion', icon: FileText },
  { to: '/inspections', label: 'Inspecciones', group: 'importacion', icon: ClipboardCheck },
  { to: '/tracking', label: 'Seguimiento', group: 'importacion', icon: Ship },

  // Servicios
  { to: '/quotation', label: 'Cotizar links', group: 'servicios', icon: Link2 },
  { to: '/plans', label: 'Planes', group: 'servicios', icon: Layers },
  { to: '/marketplace', label: 'Marketplace', group: 'servicios', icon: Store },

  // Cuenta
  { to: '/alerts', label: 'Alertas', group: 'cuenta', icon: Bell },
  { to: '/support', label: 'Ayuda', group: 'cuenta', icon: LifeBuoy },
  { to: '/profile', label: 'Mi cuenta', group: 'cuenta', icon: CircleUser },

  // Deckeva: otra empresa del mismo dueño (pisos de goma EVA). Último ítem.
  { to: '/deckeva', label: 'Pisos Deckeva', group: 'deckeva', icon: Waves },
];

/** Pestañas de la barra inferior en móvil (las 4 primeras + "Más"). */
export const MOBILE_TABS = NAV_ITEMS.filter(n => n.mobileTab).sort((a, b) => a.mobileTab - b.mobileTab);
