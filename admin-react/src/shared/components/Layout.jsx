import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { PageMetaContext } from '../lib/page-meta';
import { useFocusTrap, useScrollLock } from '../lib/focus';
import { ImporlanMark, Menu as MenuIcon, X, ChevronRight, ChevronsUpDown, LogOut, CircleUser } from './Icons';
import { IconButton } from './Button';
import { Avatar } from './Avatar';
import { CountBadge } from './StatusBadge';
import { Menu } from './Menu';
import { MobileTabBar } from './MobileTabBar';
import { ConfirmProvider } from './ConfirmDialog';

/* Ícono de un ítem del menú: componente de Icons.jsx o (compatibilidad) un
   path SVG en string. */
function NavIcon({ icon, size = 18, className }) {
  if (!icon) return null;
  if (typeof icon === 'string') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
        <path d={icon} />
      </svg>
    );
  }
  const Icon = icon;
  return <Icon size={size} className={className} />;
}

function NavItem({ item, badge, onClick }) {
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      className={({ isActive }) => cn(
        'group relative flex items-center gap-3 pl-3 pr-2 h-9 rounded-md text-sm font-medium transition-colors duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500',
        isActive ? 'bg-sidebar-active text-white' : 'text-sidebar-ink hover:text-white hover:bg-white/5',
      )}
    >
      {({ isActive }) => (
        <>
          <span className={cn('absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full', isActive ? 'bg-brand-500' : 'bg-transparent')} aria-hidden="true" />
          <NavIcon icon={item.icon} className={cn('shrink-0', isActive ? 'text-white' : 'text-sidebar-muted group-hover:text-white')} />
          <span className="flex-1 truncate">{item.label}</span>
          {badge > 0 && <CountBadge value={badge} tone={item.badgeTone === 'danger' ? 'danger' : 'sidebar'} />}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ title, subtitle, groupedItems, badges, onNavigate, user, profilePath, onLogout, onClose, closeLabel }) {
  const userMenu = [
    profilePath && { label: 'Mi cuenta', icon: CircleUser, to: profilePath, onClick: onNavigate },
    profilePath && { separator: true },
    { label: 'Cerrar sesión', icon: LogOut, onClick: onLogout },
  ];
  return (
    <>
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 text-white shrink-0" aria-hidden="true">
          <ImporlanMark size={22} />
        </span>
        <div className="flex-1 min-w-0 leading-tight">
          <span className="block text-white font-semibold text-[15px] tracking-tight truncate">{title}</span>
          <span className="block text-xs text-sidebar-muted truncate">{subtitle}</span>
        </div>
        {onClose && <IconButton icon={X} aria-label={closeLabel || 'Cerrar menú'} onClick={onClose} className="text-sidebar-ink hover:bg-white/10 hover:text-white border-transparent lg:hidden" />}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin" aria-label="Secciones">
        {groupedItems.map((group, gi) => (
          <div key={group.id} className={cn('py-1', gi > 0 && !group.label && 'mt-1 pt-2 border-t border-sidebar-line')}>
            {group.label && <p className="px-3 pt-3 pb-1.5 text-xs font-medium uppercase tracking-wide text-sidebar-muted">{group.label}</p>}
            <div className="space-y-0.5">
              {group.items.map(item => (
                <NavItem key={item.to} item={item} badge={Number(badges[item.to] || 0)} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-2 border-t border-sidebar-line shrink-0">
        <Menu
          align="start"
          width={220}
          label="Menú de la cuenta"
          items={userMenu}
          trigger={(
            <button type="button" className="w-full flex items-center gap-2.5 rounded-md px-2 h-12 text-left hover:bg-white/5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500">
              <Avatar name={user?.name} src={user?.avatar_url} size="md" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-white truncate leading-5">{user?.name || 'Usuario'}</span>
                <span className="block text-xs text-sidebar-muted truncate leading-4">{user?.email || (user?.role || '').replace(/_/g, ' ')}</span>
              </span>
              <ChevronsUpDown size={16} className="text-sidebar-muted shrink-0" />
            </button>
          )}
        />
      </div>
    </>
  );
}

/**
 * Chrome de los dos paneles: sidebar (240 px, sticky), topbar (56 px, migas
 * reales + acciones), contenido centrado (`--content-max`), menú lateral en
 * móvil con foco atrapado y, si hay pestañas móviles, barra inferior.
 *
 * Props (mismas que antes + opcionales nuevas):
 *   navItems, navGroups, branding { title, subtitle }, profilePath, headerExtra, badges
 *   search     nodo para la topbar (admin: SearchInput ⌘K)
 *   mobileTabs ítems para la barra inferior; si se omite se usan los navItems con `mobileTab`
 *   actions    nodo de acciones de página en la topbar (opcional)
 */
export default function Layout({ navItems = [], navGroups, branding = {}, profilePath, headerExtra = null, badges = {}, search = null, mobileTabs, actions = null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [trail, setTrail] = useState(null);
  const drawerRef = useRef(null);

  const { title = 'Imporlan', subtitle = 'Panel' } = branding;

  const handleLogout = () => { logout(); navigate('/login'); };

  const current = useMemo(() => {
    const hit = navItems.find(n => location.pathname === n.to || location.pathname.startsWith(n.to + '/') || location.pathname.startsWith(n.to));
    if (hit) return hit;
    if (profilePath && location.pathname.startsWith(profilePath)) return { to: profilePath, label: 'Mi cuenta' };
    return { to: location.pathname, label: 'Inicio' };
  }, [navItems, location.pathname, profilePath]);

  // Título de la pestaña: "IMP-00035 · Expedientes · Imporlan Mi panel" (+ pendientes).
  const totalBadges = Object.values(badges).reduce((a, n) => a + (Number(n) || 0), 0);
  const trailLabels = useMemo(() => (trail || []).map(t => (typeof t === 'string' ? t : t?.label)).filter(Boolean), [trail]);
  useEffect(() => {
    const partes = [...[...trailLabels].reverse(), current.label, `${title} ${subtitle}`.trim()];
    document.title = `${totalBadges ? `(${totalBadges}) ` : ''}${partes.join(' · ')}`;
  }, [trailLabels, current.label, title, subtitle, totalBadges]);

  // El body hace scroll: al cambiar de pantalla se vuelve arriba.
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  // Menú móvil: foco atrapado, Escape cierra, el body no hace scroll.
  useFocusTrap(drawerRef, sidebarOpen, { onEscape: () => setSidebarOpen(false) });
  useScrollLock(sidebarOpen);

  const groupedItems = useMemo(() => {
    if (!navGroups || navGroups.length === 0) return [{ id: '_default', label: null, items: navItems }];
    const grouped = navGroups.map(g => ({ ...g, items: navItems.filter(n => n.group === g.id) })).filter(g => g.items.length > 0);
    const sueltos = navItems.filter(n => !navGroups.some(g => g.id === n.group));
    return sueltos.length ? [...grouped, { id: '_otros', label: null, items: sueltos }] : grouped;
  }, [navItems, navGroups]);

  const tabs = useMemo(() => {
    if (Array.isArray(mobileTabs)) return mobileTabs;
    return navItems.filter(n => n.mobileTab).sort((a, b) => Number(a.mobileTab) - Number(b.mobileTab));
  }, [mobileTabs, navItems]);
  const hasTabs = tabs.length > 0;
  useEffect(() => {
    document.documentElement.classList.toggle('has-tabbar', hasTabs);
    return () => document.documentElement.classList.remove('has-tabbar');
  }, [hasTabs]);

  const meta = useMemo(() => ({ trail, setTrail }), [trail, setTrail]);
  const closeDrawer = useCallback(() => setSidebarOpen(false), [setSidebarOpen]);

  const sidebarProps = { title, subtitle, groupedItems, badges, user, profilePath, onLogout: handleLogout };

  return (
    <PageMetaContext.Provider value={meta}>
      <ConfirmProvider>
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:bg-surface focus:text-ink-900 focus:px-3 focus:py-2 focus:rounded-md focus:shadow-pop">
          Ir al contenido
        </a>
        <div className="min-h-dvh bg-canvas lg:pl-(--sidebar-w)">
          {/* Sidebar escritorio */}
          <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-(--sidebar-w) bg-sidebar text-sidebar-ink">
            <SidebarContent {...sidebarProps} />
          </aside>

          {/* Menú móvil (drawer) */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-modal lg:hidden">
              <div className="absolute inset-0 bg-ink-900/60 ov-fade" onClick={closeDrawer} aria-hidden="true" />
              <div
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label="Menú"
                className="relative flex flex-col h-dvh w-[280px] max-w-[85vw] bg-sidebar text-sidebar-ink shadow-modal ov-slide-left outline-none"
              >
                <SidebarContent {...sidebarProps} onNavigate={closeDrawer} onClose={closeDrawer} />
              </div>
            </div>
          )}

          {/* Contenido */}
          <div className="min-h-dvh flex flex-col">
            <header className="sticky top-0 z-nav h-(--topbar-h) bg-surface/90 backdrop-blur border-b border-line px-(--page-gutter) flex items-center gap-3">
              <IconButton icon={MenuIcon} aria-label="Abrir menú" onClick={() => setSidebarOpen(true)} className="lg:hidden -ml-2" />
              <nav aria-label="Migas de pan" className="flex-1 min-w-0">
                <ol className="flex items-center gap-1.5 text-sm min-w-0">
                  <li className="hidden sm:flex items-center gap-1.5 min-w-0 shrink-0">
                    <span className="text-ink-500">{title}</span>
                    <ChevronRight size={14} className="text-ink-400" />
                  </li>
                  <li className={cn('flex items-center gap-1.5 min-w-0', trailLabels.length ? 'hidden sm:flex' : '')}>
                    {trailLabels.length ? (
                      <Link to={current.to} className="text-ink-500 hover:text-ink-900 truncate">{current.label}</Link>
                    ) : (
                      <span aria-current="page" className="font-semibold text-ink-900 truncate">{current.label}</span>
                    )}
                    {trailLabels.length > 0 && <ChevronRight size={14} className="text-ink-400 shrink-0" />}
                  </li>
                  {(trail || []).map((t, i) => {
                    const last = i === trail.length - 1;
                    const label = typeof t === 'string' ? t : t?.label;
                    const to = typeof t === 'string' ? null : t?.to;
                    return (
                      <li key={i} className="flex items-center gap-1.5 min-w-0">
                        {to && !last ? <Link to={to} className="text-ink-500 hover:text-ink-900 truncate">{label}</Link>
                          : <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'font-semibold text-ink-900' : 'text-ink-500')}>{label}</span>}
                        {!last && <ChevronRight size={14} className="text-ink-400 shrink-0" />}
                      </li>
                    );
                  })}
                </ol>
              </nav>
              <div className="flex items-center gap-2 shrink-0">
                {actions}
                {search && <div className="hidden md:block w-64">{search}</div>}
                {headerExtra}
              </div>
            </header>

            <main
              id="contenido"
              tabIndex={-1}
              className="flex-1 w-full max-w-(--content-max) mx-auto px-(--page-gutter) pt-6 lg:pt-8 outline-none"
              style={{ paddingBottom: 'calc(var(--tabbar-space, 0px) + 2rem)' }}
            >
              <Outlet />
            </main>
          </div>
        </div>

        {hasTabs && <MobileTabBar tabs={tabs} badges={badges} onMore={() => setSidebarOpen(true)} moreActive={sidebarOpen} />}
      </ConfirmProvider>
    </PageMetaContext.Provider>
  );
}
