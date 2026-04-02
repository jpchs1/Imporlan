"use client";

import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const serviceImages = [
  "https://images.unsplash.com/photo-1605540436563-5bca919ae766?w=600&q=80&auto=format", // group ski
  "https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?w=600&q=80&auto=format", // snowboard
  "https://images.unsplash.com/photo-1565992441121-4367c2967103?w=600&q=80&auto=format", // guided
  "https://images.unsplash.com/photo-1491002052546-bf38f186af56?w=600&q=80&auto=format", // kids
  "/test/images/heliski.jpg", // heliski - helicopter + skiers in powder
  "https://images.unsplash.com/photo-1609902726285-00668009f004?w=600&q=80&auto=format", // corporate group
];

const serviceKeys = ["groupSki", "privateSnowboard", "guidedExperience", "kids", "heliski", "corporate"] as const;

export default function Services({ dict }: { dict: Dictionary }) {
  return (
    <section id="services" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-800 mb-4" style={{ fontFamily: "'Montserrat', sans-serif" }}>{dict.services.title}</h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">{dict.services.subtitle}</p>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {serviceKeys.map((key, i) => {
            const service = dict.services[key];
            return (
              <AnimatedSection key={key} delay={i * 0.1}>
                <div className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-orange-400/50 hover:shadow-xl transition-all duration-300 h-full shadow-md">
                  {/* Service image */}
                  <div className="relative h-44 overflow-hidden">
                    <img
                      src={serviceImages[i]}
                      alt={service.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />
                    <div className="absolute bottom-4 left-6">
                      <h3 className="text-xl font-bold text-white drop-shadow-lg">{service.title}</h3>
                    </div>
                  </div>
                  {/* Content */}
                  <div className="p-6 pt-3">
                    <p className="text-slate-600 mb-5 text-sm leading-relaxed">{service.description}</p>
                    <ul className="space-y-2">
                      {service.features.map((f: string, j: number) => (
                        <li key={j} className="flex items-center gap-2 text-sm text-slate-500">
                          <svg className="w-4 h-4 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
