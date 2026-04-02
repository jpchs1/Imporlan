"use client";

import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const countryFlags: Record<string, string> = {
  Argentina: "🇦🇷",
  Brasil: "🇧🇷",
  Brazil: "🇧🇷",
  Chile: "🇨🇱",
  "Estados Unidos": "🇺🇸",
  "United States": "🇺🇸",
  Alemania: "🇩🇪",
  Alemanha: "🇩🇪",
  Germany: "🇩🇪",
  "Japón": "🇯🇵",
  "Japão": "🇯🇵",
  Japan: "🇯🇵",
};

export default function Testimonials({ dict }: { dict: Dictionary }) {
  return (
    <section id="testimonials" className="py-24 relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-fixed"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1551524559-8af4e6624178?w=1920&q=80&auto=format')`,
        }}
      />
      <div className="absolute inset-0 bg-[#0a1628]/90" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.testimonials.title}</h2>
          <p className="text-lg text-blue-200/60">{dict.testimonials.subtitle}</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dict.testimonials.reviews.map((review, i) => (
            <AnimatedSection key={i} delay={i * 0.1}>
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-orange-400/20 transition-all h-full flex flex-col">
                <div className="flex gap-1 mb-4">
                  {[...Array(review.rating)].map((_, j) => (
                    <svg key={j} className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-white/70 text-sm leading-relaxed mb-6 flex-grow italic">&ldquo;{review.text}&rdquo;</p>
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
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
