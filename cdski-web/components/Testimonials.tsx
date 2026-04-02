"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const countryFlags: Record<string, string> = {
  Argentina: "🇦🇷", Brasil: "🇧🇷", Brazil: "🇧🇷", Chile: "🇨🇱",
  "Estados Unidos": "🇺🇸", "United States": "🇺🇸",
  Alemania: "🇩🇪", Alemanha: "🇩🇪", Germany: "🇩🇪",
  "Japón": "🇯🇵", "Japão": "🇯🇵", Japan: "🇯🇵",
  Colombia: "🇨🇴", "México": "🇲🇽", Mexico: "🇲🇽",
  "Perú": "🇵🇪", Peru: "🇵🇪",
  Francia: "🇫🇷", "França": "🇫🇷", France: "🇫🇷",
  "Reino Unido": "🇬🇧", "United Kingdom": "🇬🇧",
  Australia: "🇦🇺", "Corea del Sur": "🇰🇷", "South Korea": "🇰🇷",
  "Coreia do Sul": "🇰🇷",
  Italia: "🇮🇹", "Itália": "🇮🇹", Italy: "🇮🇹",
  "España": "🇪🇸", "Espanha": "🇪🇸", Spain: "🇪🇸",
  "Canadá": "🇨🇦", Canada: "🇨🇦",
  "Uruguay": "🇺🇾", "Ecuador": "🇪🇨",
};

export default function Testimonials({ dict }: { dict: Dictionary }) {
  const reviews = dict.testimonials.reviews;
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const perPage = typeof window !== "undefined" && window.innerWidth >= 1024 ? 3 : typeof window !== "undefined" && window.innerWidth >= 768 ? 2 : 1;

  const totalPages = Math.ceil(reviews.length / perPage);

  const next = useCallback(() => {
    setDirection(1);
    setCurrent((c) => (c + 1) % totalPages);
  }, [totalPages]);

  const prev = useCallback(() => {
    setDirection(-1);
    setCurrent((c) => (c - 1 + totalPages) % totalPages);
  }, [totalPages]);

  // Auto-advance every 5s
  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const startIdx = current * perPage;
  const visibleReviews = reviews.slice(startIdx, startIdx + perPage);

  return (
    <section id="testimonials" className="py-24 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1920&q=80&auto=format')`,
        }}
      />
      <div className="absolute inset-0 bg-[#0a1628]/90" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.testimonials.title}</h2>
          <p className="text-lg text-blue-200/60">{dict.testimonials.subtitle}</p>
        </AnimatedSection>

        {/* Carousel */}
        <div className="relative">
          <div className="overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current}
                initial={{ opacity: 0, x: direction > 0 ? 100 : -100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: direction > 0 ? -100 : 100 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {visibleReviews.map((review, i) => (
                  <div
                    key={startIdx + i}
                    className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 h-full flex flex-col"
                  >
                    <div className="flex gap-1 mb-4">
                      {[...Array(review.rating)].map((_, j) => (
                        <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed mb-6 flex-grow italic">
                      &ldquo;{review.text}&rdquo;
                    </p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-sm">
                        {review.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-medium text-sm">{review.name}</div>
                        <div className="text-white/40 text-xs">
                          {countryFlags[review.country] || ""} {review.country}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute -left-2 lg:-left-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all border border-white/10"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute -right-2 lg:-right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-all border border-white/10"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => { setDirection(i > current ? 1 : -1); setCurrent(i); }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === current ? "bg-orange-500 w-8" : "bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
