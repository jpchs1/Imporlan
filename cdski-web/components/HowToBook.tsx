"use client";

import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const stepIcons = [
  <svg key="0" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  <svg key="1" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  <svg key="2" className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
];

export default function HowToBook({ dict }: { dict: Dictionary }) {
  return (
    <section id="how-to-book" className="py-24 bg-gradient-to-b from-[#0f2040] to-[#0a1628] relative">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.howToBook.title}</h2>
          <p className="text-lg text-blue-200/60">{dict.howToBook.subtitle}</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-orange-400/0 via-orange-400/30 to-orange-400/0" />
          {dict.howToBook.steps.map((step, i) => (
            <AnimatedSection key={i} delay={i * 0.15} className="text-center relative">
              <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 mb-6">
                {stepIcons[i]}
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {i + 1}
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{step.description}</p>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
