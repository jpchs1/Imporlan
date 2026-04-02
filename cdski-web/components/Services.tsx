"use client";

import { motion } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const serviceImages = [
  "/images/ski-group-three.jpg",
  "/images/young-skier.jpg",
  "/images/ski-mountain-duo.jpg",
  "/images/kids-ski-group.jpg",
  "/images/heliski.jpg",
  "/images/snowboards-rack.jpg",
];

const serviceIcons = [
  <svg key="0" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  <svg key="1" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  <svg key="2" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
  <svg key="3" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  <svg key="4" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  <svg key="5" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
];

const badgeColors = [
  "bg-sky-100 text-sky-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-red-100 text-red-700",
  "bg-indigo-100 text-indigo-700",
];

const badgeLabels: Record<string, string[]> = {
  es: ["Todos los niveles", "Personalizado", "Guía experto", "Familiar", "Extremo", "Team Building"],
  en: ["All levels", "Personalized", "Expert guide", "Family", "Extreme", "Team Building"],
  pt: ["Todos os níveis", "Personalizado", "Guia experto", "Familiar", "Extremo", "Team Building"],
};

const serviceKeys = ["groupSki", "privateSnowboard", "guidedExperience", "kids", "heliski", "corporate"] as const;

export default function Services({ dict, lang }: { dict: Dictionary; lang: string }) {
  return (
    <section id="services" className="py-24 bg-gradient-to-b from-white to-sky-50/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-100/40 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 rounded-full px-4 py-1.5 text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-orange-500 rounded-full" />
            Valle Nevado · El Colorado · La Parva
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            {dict.services.title}
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">{dict.services.subtitle}</p>
        </AnimatedSection>

        {/* Featured services — first 2 large */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {serviceKeys.slice(0, 2).map((key, i) => {
            const service = dict.services[key];
            return (
              <AnimatedSection key={key} delay={i * 0.15}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="group relative bg-white rounded-3xl overflow-hidden border border-slate-200/80 hover:border-orange-300 hover:shadow-2xl transition-all duration-500 h-full shadow-lg"
                >
                  <div className="relative h-56 sm:h-64 overflow-hidden">
                    <img
                      src={serviceImages[i]}
                      alt={service.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/30 to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badgeColors[i]}`}>
                        {serviceIcons[i]}
                        {(badgeLabels[lang] || badgeLabels.es)[i]}
                      </span>
                    </div>
                    <div className="absolute bottom-5 left-6 right-6">
                      <h3 className="text-2xl font-bold text-white drop-shadow-lg mb-2" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        {service.title}
                      </h3>
                      <p className="text-white/80 text-sm line-clamp-2">{service.description}</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-3">
                      {service.features.map((f: string, j: number) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-slate-600">
                          <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                            <svg className="w-3 h-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                          {f}
                        </div>
                      ))}
                    </div>
                    <a href="#pricing" className="mt-5 inline-flex items-center gap-2 text-orange-500 hover:text-orange-600 font-semibold text-sm transition-colors group/link">
                      {dict.nav.bookNow}
                      <svg className="w-4 h-4 transition-transform group-hover/link:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </a>
                  </div>
                </motion.div>
              </AnimatedSection>
            );
          })}
        </div>

        {/* Other services — 4 smaller cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {serviceKeys.slice(2).map((key, idx) => {
            const i = idx + 2;
            const service = dict.services[key];
            return (
              <AnimatedSection key={key} delay={i * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200/80 hover:border-orange-300 hover:shadow-xl transition-all duration-500 h-full shadow-md"
                >
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={serviceImages[i]}
                      alt={service.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${badgeColors[i]}`}>
                        {(badgeLabels[lang] || badgeLabels.es)[i]}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-4 right-4">
                      <h3 className="text-lg font-bold text-white drop-shadow-lg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                        {service.title}
                      </h3>
                    </div>
                  </div>
                  <div className="p-5">
                    <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-3">{service.description}</p>
                    <ul className="space-y-1.5">
                      {service.features.slice(0, 3).map((f: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-xs text-slate-500">
                          <svg className="w-3.5 h-3.5 text-orange-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
