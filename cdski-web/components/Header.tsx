"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { Dictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/dictionaries";

const langLabels: Record<string, string> = { es: "ES", en: "EN", pt: "PT" };

export default function Header({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navItems = [
    { href: "#services", label: dict.nav.services },
    { href: "#why-us", label: dict.nav.whyUs },
    { href: "#pricing", label: dict.nav.pricing },
    { href: "#gallery", label: dict.nav.gallery },
    { href: "#testimonials", label: dict.nav.testimonials },
    { href: "#faq", label: dict.nav.faq },
    { href: "#blog", label: dict.nav.blog },
    { href: "#contact", label: dict.nav.contact },
  ];

  const basePath = "";

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a1628]/90 backdrop-blur-xl shadow-2xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <a href="#" className="flex items-center gap-3">
            <img src="/images/logo-cdski.png" alt="Clases de Ski" className="h-12 w-12 rounded-lg" />
            <span className="text-xl font-bold text-white tracking-tight hidden sm:block" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Clases de <span className="text-orange-400">Ski</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 text-lg" title="Chile · Brasil · USA">
              <span>🇨🇱</span><span>🇧🇷</span><span>🇺🇸</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 rounded-full p-1">
              {(["es", "en", "pt"] as const).map((l) => (
                <a
                  key={l}
                  href={`/${l}/`}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-all ${
                    lang === l
                      ? "bg-orange-500 text-white"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {langLabels[l]}
                </a>
              ))}
            </div>

            <a
              href="#contact"
              className="hidden lg:inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2.5 rounded-full text-sm transition-all hover:scale-105"
            >
              {dict.nav.bookNow}
            </a>

            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden text-white p-2"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-[#0a1628]/95 backdrop-blur-xl border-t border-white/10"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={() => setMenuOpen(false)}
                className="mt-2 bg-orange-500 text-white text-center font-semibold py-3 rounded-full"
              >
                {dict.nav.bookNow}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
