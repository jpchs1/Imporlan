"use client";

import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const galleryItems = [
  { color: "from-blue-600/40 to-blue-900/40", label: "Valle Nevado", icon: "M" },
  { color: "from-sky-500/40 to-blue-800/40", label: "El Colorado", icon: "S" },
  { color: "from-indigo-600/40 to-purple-900/40", label: "La Parva", icon: "L" },
  { color: "from-orange-500/40 to-red-800/40", label: "Ski Lessons", icon: "K" },
  { color: "from-cyan-600/40 to-blue-900/40", label: "Snowboard", icon: "B" },
  { color: "from-teal-500/40 to-emerald-800/40", label: "Kids Fun", icon: "N" },
];

export default function Gallery({ dict }: { dict: Dictionary }) {
  return (
    <section id="gallery" className="py-24 bg-[#0a1628] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.gallery.title}</h2>
          <p className="text-lg text-blue-200/60">{dict.gallery.subtitle}</p>
        </AnimatedSection>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {galleryItems.map((item, i) => (
            <AnimatedSection key={i} delay={i * 0.08}>
              <div className={`relative aspect-[4/3] rounded-2xl overflow-hidden group cursor-pointer bg-gradient-to-br ${item.color}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-16 h-16 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4">
                  <span className="text-white font-semibold text-sm">{item.label}</span>
                </div>
                <div className="absolute inset-0 bg-orange-500/0 group-hover:bg-orange-500/10 transition-colors duration-300" />
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
