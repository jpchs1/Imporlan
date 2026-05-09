import { useState, useMemo } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const COUNTRY_MAP = {
  CL: { flag: '🇨🇱', name: 'Chile' },
  PE: { flag: '🇵🇪', name: 'Peru' },
  CO: { flag: '🇨🇴', name: 'Colombia' },
  MX: { flag: '🇲🇽', name: 'Mexico' },
  AR: { flag: '🇦🇷', name: 'Argentina' },
  BR: { flag: '🇧🇷', name: 'Brasil' },
  EC: { flag: '🇪🇨', name: 'Ecuador' },
  UY: { flag: '🇺🇾', name: 'Uruguay' },
  PY: { flag: '🇵🇾', name: 'Paraguay' },
  BO: { flag: '🇧🇴', name: 'Bolivia' },
  VE: { flag: '🇻🇪', name: 'Venezuela' },
  US: { flag: '🇺🇸', name: 'USA' },
  ES: { flag: '🇪🇸', name: 'Espana' },
};

const TZ_TO_COUNTRY = {
  'America/Santiago': 'CL',
  'America/Punta_Arenas': 'CL',
  'Pacific/Easter': 'CL',
  'America/Lima': 'PE',
  'America/Bogota': 'CO',
  'America/Mexico_City': 'MX',
  'America/Tijuana': 'MX',
  'America/Cancun': 'MX',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Cordoba': 'AR',
  'America/Sao_Paulo': 'BR',
  'America/Fortaleza': 'BR',
  'America/Manaus': 'BR',
  'America/Guayaquil': 'EC',
  'America/Montevideo': 'UY',
  'America/Asuncion': 'PY',
  'America/La_Paz': 'BO',
  'America/Caracas': 'VE',
  'Europe/Madrid': 'ES',
  'America/New_York': 'US',
  'America/Los_Angeles': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Phoenix': 'US',
  'America/Anchorage': 'US',
  'Pacific/Honolulu': 'US',
};

function detectCountry(user) {
  // Priority 1: explicit user.country
  const explicit = (user?.country || user?.country_code || '').toUpperCase();
  if (explicit && COUNTRY_MAP[explicit]) {
    return { code: explicit, ...COUNTRY_MAP[explicit] };
  }

  // Priority 2: cached
  try {
    const cached = localStorage.getItem('imporlan_country');
    if (cached && COUNTRY_MAP[cached]) return { code: cached, ...COUNTRY_MAP[cached] };
  } catch { /* ignore */ }

  let detected = null;

  // Priority 3: navigator.language (es-CL, en-US, etc.)
  if (typeof navigator !== 'undefined' && navigator.language) {
    const m = navigator.language.match(/-([A-Z]{2})$/i);
    if (m) {
      const c = m[1].toUpperCase();
      if (COUNTRY_MAP[c]) detected = c;
    }
  }

  // Priority 4: timezone
  if (!detected) {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const c = TZ_TO_COUNTRY[tz];
      if (c && COUNTRY_MAP[c]) detected = c;
    } catch { /* ignore */ }
  }

  if (!detected) detected = 'CL';

  try { localStorage.setItem('imporlan_country', detected); } catch { /* ignore */ }
  return { code: detected, ...COUNTRY_MAP[detected] };
}

const ACCENT_BG = {
  indigo: 'bg-indigo-500/15 text-indigo-300',
  cyan: 'bg-cyan-500/15 text-cyan-300',
  emerald: 'bg-emerald-500/15 text-emerald-300',
  violet: 'bg-violet-500/15 text-violet-300',
  amber: 'bg-amber-500/15 text-amber-300',
  rose: 'bg-rose-500/15 text-rose-300',
  teal: 'bg-teal-500/15 text-teal-300',
};

const ACCENT_ACTIVE_BG = {
  indigo: 'bg-gradient-to-r from-indigo-600/95 to-indigo-500/80 shadow-lg shadow-indigo-600/20',
  cyan: 'bg-gradient-to-r from-cyan-600/95 to-blue-500/80 shadow-lg shadow-cyan-600/20',
  emerald: 'bg-gradient-to-r from-emerald-600/95 to-teal-500/80 shadow-lg shadow-emerald-600/20',
  violet: 'bg-gradient-to-r from-violet-600/95 to-purple-500/80 shadow-lg shadow-violet-600/20',
  amber: 'bg-gradient-to-r from-amber-600/95 to-orange-500/80 shadow-lg shadow-amber-600/20',
  rose: 'bg-gradient-to-r from-rose-600/95 to-pink-500/80 shadow-lg shadow-rose-600/20',
  teal: 'bg-gradient-to-r from-teal-600/95 to-cyan-500/80 shadow-lg shadow-teal-600/20',
};

function NavItem({ item, badge, onClick, animationDelay }) {
  const accent = item.accent || 'indigo';
  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      style={{ animationDelay: `${animationDelay}ms` }}
      className={({ isActive }) =>
        `group relative flex items-center gap-2.5 pl-2.5 pr-2 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-200 animate-slide-in ${
          isActive
            ? `${ACCENT_ACTIVE_BG[accent] || ACCENT_ACTIVE_BG.indigo} text-white`
            : 'text-slate-400 hover:text-white hover:bg-white/[0.05]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* Active indicator pill on the left */}
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r transition-all ${isActive ? 'bg-white/80' : 'bg-transparent group-hover:bg-white/20'}`} />
          {/* Icon */}
          <span className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition ${
            isActive ? 'bg-white/15' : `${ACCENT_BG[accent] || ACCENT_BG.indigo} group-hover:scale-110`
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
          </span>
          <span className="flex-1 truncate">{item.label}</span>
          {badge > 0 && (
            <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center tabular-nums shrink-0 ${
              isActive
                ? 'bg-white/20 text-white ring-1 ring-white/20'
                : 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse-dot'
            }`}>
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ navItems, navGroups, branding = {}, profilePath, headerExtra = null, badges = {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const country = useMemo(() => detectCountry(user), [user]);

  const { title = 'Imporlan', subtitle = 'Panel', accentColor = 'indigo' } = branding;

  const subtitleColors = {
    indigo: 'text-indigo-300',
    cyan: 'text-cyan-300',
    emerald: 'text-emerald-300',
    violet: 'text-violet-300',
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentPage = navItems.find(n => location.pathname.startsWith(n.to))?.label || 'Dashboard';

  // Group nav items if groups are provided
  const groupedItems = useMemo(() => {
    if (!navGroups || navGroups.length === 0) {
      return [{ id: '_default', label: null, items: navItems }];
    }
    return navGroups.map(g => ({
      ...g,
      items: navItems.filter(n => n.group === g.id),
    })).filter(g => g.items.length > 0);
  }, [navItems, navGroups]);

  let itemIndex = 0;

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 lg:w-[256px] bg-gradient-to-b from-[#0a1628] via-[#0f172a] to-[#0a1628] transform transition-all duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col border-r border-white/[0.04]`}>
        {/* Decorative glow on top */}
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="absolute top-16 -right-10 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5 px-4 py-3.5">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-500 rounded-2xl blur opacity-40 transition" />
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              I
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-white font-bold text-[14px] tracking-tight">{title}</span>
              <span className="hidden sm:inline-flex items-center gap-1 px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[8px] font-bold uppercase tracking-wider ring-1 ring-emerald-400/20">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <span className={`${subtitleColors[accentColor] || 'text-cyan-300'} text-[10px] block font-semibold tracking-wide -mt-0.5`}>{subtitle}</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06]"
            aria-label="Cerrar menu"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="relative flex-1 overflow-y-auto py-1 px-2 space-y-2 scrollbar-thin">
          {groupedItems.map(group => (
            <div key={group.id} className="space-y-px">
              {group.label && (
                <div className="px-2 pt-1.5 pb-1 flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{group.label}</span>
                  <div className="flex-1 h-px bg-gradient-to-r from-white/[0.05] to-transparent" />
                </div>
              )}
              {group.items.map(item => {
                const idx = itemIndex++;
                return (
                  <NavItem
                    key={item.to}
                    item={item}
                    badge={Number(badges[item.to] || 0)}
                    animationDelay={idx * 20}
                    onClick={() => setSidebarOpen(false)}
                  />
                );
              })}
            </div>
          ))}
        </nav>

        {/* User card */}
        <div className="relative p-2">
          <div className="rounded-xl bg-gradient-to-br from-white/[0.06] to-white/[0.02] ring-1 ring-white/[0.08] p-2 backdrop-blur">
            <div className="flex items-center gap-2">
              {profilePath ? (
                <button
                  onClick={() => { navigate(profilePath); setSidebarOpen(false); }}
                  className="flex items-center gap-2 flex-1 min-w-0 text-left rounded-md -m-0.5 p-0.5 hover:bg-white/[0.04] transition-colors group"
                  title="Editar perfil"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md overflow-hidden ring-1 ring-white/[0.08] group-hover:ring-white/[0.15] transition">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        (user?.name || 'A')[0].toUpperCase()
                      )}
                    </div>
                    <span className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a1628]" title="Online" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[12px] font-semibold truncate leading-tight flex items-center gap-1.5">
                      <span className="truncate">{user?.name || 'Usuario'}</span>
                      <span className="text-[13px] leading-none shrink-0" title={country.name}>{country.flag}</span>
                    </p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">{user?.email || (user?.role || '').replace(/_/g, ' ')}</p>
                  </div>
                </button>
              ) : (
                <>
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 via-teal-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-md ring-1 ring-white/[0.08]">
                      {(user?.name || 'A')[0].toUpperCase()}
                    </div>
                    <span className="absolute -bottom-px -right-px w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a1628]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-[12px] font-semibold truncate leading-tight">{user?.name || 'Usuario'}</p>
                    <p className="text-[10px] text-slate-400 truncate capitalize leading-tight">{user?.role || ''}</p>
                  </div>
                </>
              )}
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-rose-400 transition-colors p-1.5 rounded-md hover:bg-rose-500/10 shrink-0 ring-1 ring-transparent hover:ring-rose-500/20"
                title="Cerrar sesion"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white/85 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-8 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-slate-500 hover:text-slate-800 lg:hidden transition-colors p-1.5 rounded-lg hover:bg-slate-100"
            aria-label="Abrir menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2 text-[15px]">
            <span className="hidden sm:inline text-slate-400 font-medium">{title}</span>
            <svg className="hidden sm:block w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>
            <h2 className="font-semibold text-slate-800 truncate">{currentPage}</h2>
          </div>
          <div className="flex items-center gap-2">
            {headerExtra}
            <div className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-full ring-1 ring-slate-200/70" title={country.name}>
              <span className="text-base leading-none">{country.flag}</span>
              <span className="font-semibold">{country.name}</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full ring-1 ring-emerald-200/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span className="font-semibold">Online</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
