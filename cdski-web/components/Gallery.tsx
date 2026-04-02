"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const galleryItems = [
  {
    src: "https://images.unsplash.com/photo-1565992441121-4367c2967103?w=800&q=80&auto=format",
    label: "Valle Nevado",
  },
  {
    src: "https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=800&q=80&auto=format",
    label: "Ski Lessons",
  },
  {
    src: "https://images.unsplash.com/photo-1551524559-8af4e6624178?w=800&q=80&auto=format",
    label: "Andes Mountains",
  },
  {
    src: "https://images.unsplash.com/photo-1486673748761-a8d18475c757?w=800&q=80&auto=format",
    label: "Snowboard Fun",
  },
  {
    src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80&auto=format",
    label: "Panoramic Views",
  },
  {
    src: "https://images.unsplash.com/photo-1454942901704-3c44c11b2ad1?w=800&q=80&auto=format",
    label: "Kids & Families",
  },
  {
    src: "https://images.unsplash.com/photo-1483728642387-6c3bdd6c93e5?w=800&q=80&auto=format",
    label: "Fresh Powder",
  },
  {
    src: "https://images.unsplash.com/photo-1517483000871-1dbf64a6e1c6?w=800&q=80&auto=format",
    label: "Ski Group",
  },
];

export default function Gallery({ dict }: { dict: Dictionary }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section id="gallery" className="py-24 bg-[#0a1628] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.gallery.title}</h2>
          <p className="text-lg text-blue-200/60">{dict.gallery.subtitle}</p>
        </AnimatedSection>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {galleryItems.map((item, i) => {
            const isLarge = i === 0 || i === 5;
            return (
              <AnimatedSection
                key={i}
                delay={i * 0.06}
                className={isLarge ? "col-span-2 row-span-2" : ""}
              >
                <div
                  onClick={() => setSelected(i)}
                  className={`relative overflow-hidden rounded-2xl group cursor-pointer ${
                    isLarge ? "aspect-square" : "aspect-[4/3]"
                  }`}
                >
                  <img
                    src={item.src}
                    alt={item.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                  <div className="absolute bottom-4 left-4 right-4">
                    <span className="text-white font-semibold text-sm drop-shadow-lg">{item.label}</span>
                  </div>
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-orange-400/40 rounded-2xl transition-colors" />
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selected !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.img
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              src={galleryItems[selected].src.replace("w=800", "w=1400")}
              alt={galleryItems[selected].label}
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl"
            />
            <button
              onClick={() => setSelected(null)}
              className="absolute top-6 right-6 text-white/70 hover:text-white bg-white/10 backdrop-blur-sm rounded-full p-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="absolute bottom-6 text-white/60 text-sm">
              {galleryItems[selected].label}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
