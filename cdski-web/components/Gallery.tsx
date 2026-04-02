"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const galleryItems = [
  { src: "/test/images/ski-group-three.jpg", label: "Ski Group Lessons" },
  { src: "/test/images/kids-ski-group.jpg", label: "Kids Learning to Ski" },
  { src: "/test/images/skier-action.jpg", label: "Ski Action" },
  { src: "/test/images/young-skier.jpg", label: "Young Skier" },
  { src: "/test/images/skier-jump.jpg", label: "Freestyle" },
  { src: "/test/images/ski-mountain-duo.jpg", label: "Mountain Adventure" },
  { src: "/test/images/heliski.jpg", label: "Heliski Chile" },
  { src: "/test/images/snowboards-rack.jpg", label: "Snowboard Gear" },
];

export default function Gallery({ dict }: { dict: Dictionary }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section id="gallery" className="py-24 bg-sky-50 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>{dict.gallery.title}</h2>
          <p className="text-lg text-slate-500">{dict.gallery.subtitle}</p>
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
