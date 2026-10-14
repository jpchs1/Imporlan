import { NavLink } from 'react-router-dom';
import { cn } from '../lib/utils';
import { Menu as MenuIcon } from './Icons';
import { CountBadge } from './StatusBadge';

/**
 * Barra inferior de 5 pestañas para el panel del cliente en móvil (< lg):
 * 4 secciones + "Más" (abre el menú lateral con el resto). 56 px + safe-area.
 * El Layout la monta solo cuando hay pestañas (`mobileTabs` o `mobileTab` en
 * los navItems); las páginas no la usan directamente.
 */
export function MobileTabBar({ tabs = [], badges = {}, onMore, moreActive = false }) {
  if (!tabs.length) return null;
  return (
    <nav
      aria-label="Navegación principal"
      className="lg:hidden fixed inset-x-0 bottom-0 z-nav bg-surface border-t border-line pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid h-(--tabbar-h)" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const badge = Number(badges[t.to] || 0);
          return (
            <li key={t.to} className="min-w-0">
              <NavLink
                to={t.to}
                className={({ isActive }) => cn(
                  'relative flex h-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150',
                  isActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className="relative">
                      {Icon && (typeof Icon === 'string' ? <span className="h-5 w-5 block" /> : <Icon size={22} strokeWidth={isActive ? 2 : 1.75} />)}
                      {badge > 0 && <CountBadge value={badge} tone={t.badgeTone === 'danger' ? 'danger' : 'brand'} className="absolute -top-1.5 -right-2.5 scale-90" />}
                    </span>
                    <span className="truncate max-w-full px-1 leading-4">{t.tabLabel || t.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={onMore}
            aria-haspopup="dialog"
            aria-expanded={moreActive}
            className={cn('flex h-full w-full flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-150', moreActive ? 'text-brand-700' : 'text-ink-500 hover:text-ink-900')}
          >
            <MenuIcon size={22} />
            <span className="leading-4">Más</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
