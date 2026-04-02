"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

function FAQItem({ q, a, open, toggle }: { q: string; a: string; open: boolean; toggle: () => void }) {
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden hover:border-orange-300 transition-colors bg-slate-50">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between p-6 text-left"
      >
        <span className="text-slate-800 font-medium pr-4">{q}</span>
        <motion.svg
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 text-orange-400 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-6 pb-6 text-slate-600 text-sm leading-relaxed">{a}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQ({ dict }: { dict: Dictionary }) {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24 bg-white relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>{dict.faq.title}</h2>
          <p className="text-lg text-slate-500">{dict.faq.subtitle}</p>
        </AnimatedSection>

        <div className="space-y-3">
          {dict.faq.questions.map((item, i) => (
            <AnimatedSection key={i} delay={i * 0.05}>
              <FAQItem
                q={item.q}
                a={item.a}
                open={openIdx === i}
                toggle={() => setOpenIdx(openIdx === i ? null : i)}
              />
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
