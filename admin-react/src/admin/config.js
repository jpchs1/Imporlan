import {
  Home, Users, ShoppingCart, Layers, CreditCard, FolderOpen, Megaphone,
  ClipboardCheck, Ship, Store, MessageCircle, Settings, ShieldCheck,
} from '../shared/components/Icons';

export const STORAGE_KEYS = { token: 'token', user: 'user' };

export const BRANDING = {
  title: 'Imporlan',
  subtitle: 'Admin',
};

// Quién ve cada pantalla (el backend igual valida cada acción).
const ALL = ['admin', 'support', 'agent'];
const STAFF = ['admin', 'support'];
const ADMIN = ['admin'];

export const NAV_ITEMS = [
  { to: '/dashboard', roles: STAFF, label: 'Inicio', icon: Home },
  { to: '/users', roles: STAFF, label: 'Usuarios', icon: Users },
  { to: '/purchases', roles: STAFF, label: 'Compras', icon: ShoppingCart },
  { to: '/plans', roles: ADMIN, label: 'Planes', icon: Layers },
  { to: '/payments', roles: STAFF, label: 'Pagos', icon: CreditCard },
  { to: '/orders', roles: ALL, label: 'Expedientes', icon: FolderOpen },
  { to: '/leads', roles: STAFF, label: 'Leads simulador', icon: Megaphone },
  { to: '/inspections', roles: ALL, label: 'Inspecciones', icon: ClipboardCheck },
  { to: '/tracking', roles: ALL, label: 'Seguimiento', icon: Ship },
  { to: '/marketplace', roles: STAFF, label: 'Marketplace', icon: Store },
  // Chat: sin agentes. El operador en EE. UU. no se comunica con clientes (JP, 21-oct-2026).
  { to: '/chat', roles: STAFF, label: 'Chat', icon: MessageCircle, badgeTone: 'danger' },
  { to: '/config', roles: STAFF, label: 'Configuración', icon: Settings },
  { to: '/security', roles: ADMIN, label: 'Seguridad', icon: ShieldCheck },
];

/** Pantallas visibles para un rol. */
export function navItemsFor(role) {
  return NAV_ITEMS.filter(n => !n.roles || n.roles.includes(role || 'admin'));
}

/** Pantalla de inicio según el rol (un agente trabaja en Expedientes). */
export function homePathFor(role) {
  return navItemsFor(role)[0]?.to || '/orders';
}
