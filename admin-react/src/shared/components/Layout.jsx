import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ navItems, branding = {} }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { title = 'Imporlan', subtitle = 'Panel', accentColor = 'indigo' } = branding;

  const subtitleColors = {
    indigo: 'text-indigo-400',
    cyan: 'text-cyan-400',
    emerald: 'text-emerald-400',
    violet: 'text-violet-400',
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentPage = navItems.find(n => location.pathname.startsWith(n.to))?.label || 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden animate-fade-in" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-[272px] bg-gradient-to-b from-[#0f172a] via-[#1e293b] to-[#0f172a] transform transition-all duration-300 ease-out lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/30">
            I
          </div>
          <div>
            <span className="text-white font-bold text-[15px] tracking-tight">{title}</span>
            <span className={`${subtitleColors[accentColor] || 'text-indigo-400'} text-xs block -mt-0.5 font-medium`}>{subtitle}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5">
          {navItems.map(({ to, label, icon }, i) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              style={{ animationDelay: `${i * 30}ms` }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group animate-slide-in ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600/90 to-indigo-500/80 text-white shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                }`
              }
            >
              <svg className="w-[18px] h-[18px] shrink-0 transition-transform duration-200 group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="p-3 m-3 rounded-xl bg-white/[0.05] border border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center text-white text-sm font-semibold shadow-md">
              {(user?.name || 'A')[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{user?.name || 'Usuario'}</p>
              <p className="text-[11px] text-slate-500 truncate capitalize">{user?.role || ''}</p>
            </div>
            <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/[0.06]" title="Cerrar sesion">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60 px-4 lg:px-8 py-3.5 flex items-center gap-4 sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-500 hover:text-slate-800 lg:hidden transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex-1">
            <h2 className="text-[15px] font-semibold text-slate-800">{currentPage}</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot"></span>
              Online
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
