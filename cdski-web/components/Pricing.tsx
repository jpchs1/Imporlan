"use client";

import { useState } from "react";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

const programs = [
  { id: 1, adult: 66000, child: 59000, keys: { es: "Principiante + Clases Colectivas + Rental", en: "Beginner + Group Lessons + Rental", pt: "Iniciante + Aulas Coletivas + Aluguel" }, detail: { es: "Ticket principiante + clase 2hrs + equipo", en: "Beginner ticket + 2hr lesson + equipment", pt: "Ticket iniciante + aula 2hrs + equipamento" } },
  { id: 2, adult: 65000, child: 54000, keys: { es: "Principiante + Clases Colectivas", en: "Beginner + Group Lessons", pt: "Iniciante + Aulas Coletivas" }, detail: { es: "Ticket principiante + clase 2hrs (sin equipo)", en: "Beginner ticket + 2hr lesson (no equipment)", pt: "Ticket iniciante + aula 2hrs (sem equipamento)" } },
  { id: 3, adult: 70000, child: 53000, keys: { es: "Ticket Día + Rental", en: "Day Ticket + Rental", pt: "Ticket Dia + Aluguel" }, detail: { es: "Acceso todas las pistas + equipo completo", en: "All slopes access + full equipment", pt: "Acesso a todas as pistas + equipamento completo" } },
  { id: 4, adult: 79900, child: 61000, keys: { es: "Ticket Día + Clases Colectivas", en: "Day Ticket + Group Lessons", pt: "Ticket Dia + Aulas Coletivas" }, detail: { es: "Acceso todas las pistas + clase 2hrs", en: "All slopes access + 2hr lesson", pt: "Acesso a todas as pistas + aula 2hrs" } },
];

type PackLang = { es: string; en: string; pt: string };

const packs: { id: string; type: string; name: PackLang; desc: PackLang; now: number; before: number; popular?: boolean }[] = [
  { id: "A", type: "GRUPAL", name: { es: "All Inclusive Grupal", en: "Group All Inclusive", pt: "All Inclusive Grupo" }, desc: { es: "Clases grupales 11:00-13:00 + ticket + equipo", en: "Group lessons 11:00-13:00 + ticket + equipment", pt: "Aulas em grupo 11:00-13:00 + ticket + equipamento" }, now: 138700, before: 164800 },
  { id: "C", type: "PRIVADA", name: { es: "Privada Flexible", en: "Flexible Private", pt: "Particular Flexível" }, desc: { es: "Clases privadas 2hrs a elección + ticket + equipo", en: "Private lessons 2hrs flexible + ticket + equipment", pt: "Aulas particulares 2hrs flexível + ticket + equipamento" }, now: 187500, before: 224800, popular: true },
  { id: "B", type: "PRIVADA + GRUPAL", name: { es: "All Inclusive Full", en: "Full All Inclusive", pt: "All Inclusive Completo" }, desc: { es: "Privadas 9-11 + grupales 11-13 + privadas 15-17 + ticket + equipo", en: "Private 9-11 + group 11-13 + private 15-17 + ticket + equipment", pt: "Particulares 9-11 + grupo 11-13 + particulares 15-17 + ticket + equipamento" }, now: 218200, before: 244700 },
  { id: "D", type: "PRIVADA", name: { es: "All Inclusive Privada", en: "Private All Inclusive", pt: "All Inclusive Particular" }, desc: { es: "Clases privadas 9:00-11:00 + ticket + equipo", en: "Private lessons 9:00-11:00 + ticket + equipment", pt: "Aulas particulares 9:00-11:00 + ticket + equipamento" }, now: 294600, before: 324800 },
  { id: "G", type: "PRIVADA", name: { es: "Half Day Privada", en: "Private Half Day", pt: "Meio Dia Particular" }, desc: { es: "Clases privadas 3hrs (mañana o tarde)", en: "Private lessons 3hrs (morning or afternoon)", pt: "Aulas particulares 3hrs (manhã ou tarde)" }, now: 102700, before: 164500 },
  { id: "F", type: "PRIVADA", name: { es: "Full Day Privada", en: "Private Full Day", pt: "Dia Completo Particular" }, desc: { es: "Clases privadas 11:00-14:00 y 15:00-17:00", en: "Private lessons 11:00-14:00 and 15:00-17:00", pt: "Aulas particulares 11:00-14:00 e 15:00-17:00" }, now: 188500, before: 244600 },
];

function formatCLP(n: number) {
  return "$" + n.toLocaleString("es-CL");
}

export default function Pricing({ dict, lang }: { dict: Dictionary; lang: "es" | "en" | "pt" }) {
  const [tab, setTab] = useState<"programs" | "packs">("packs");

  return (
    <section id="pricing" className="py-24 bg-[#0a1628] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{dict.pricing.title}</h2>
          <p className="text-lg text-blue-200/60 max-w-2xl mx-auto">{dict.pricing.subtitle}</p>
        </AnimatedSection>

        <AnimatedSection delay={0.1} className="flex justify-center mb-10">
          <div className="inline-flex bg-white/5 rounded-full p-1 border border-white/10">
            <button
              onClick={() => setTab("packs")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${tab === "packs" ? "bg-orange-500 text-white" : "text-white/60 hover:text-white"}`}
            >
              {dict.pricing.packs.title}
            </button>
            <button
              onClick={() => setTab("programs")}
              className={`px-6 py-2.5 rounded-full text-sm font-medium transition-all ${tab === "programs" ? "bg-orange-500 text-white" : "text-white/60 hover:text-white"}`}
            >
              {dict.pricing.programs.title}
            </button>
          </div>
        </AnimatedSection>

        {tab === "packs" && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packs.map((pack, i) => (
              <AnimatedSection key={pack.id} delay={i * 0.08}>
                <div className={`relative rounded-2xl p-8 border transition-all h-full flex flex-col ${pack.popular ? "bg-gradient-to-b from-orange-500/10 to-orange-600/5 border-orange-400/30 ring-1 ring-orange-400/20" : "bg-white/5 border-white/10 hover:border-white/20"}`}>
                  {pack.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                      {dict.pricing.popular}
                    </div>
                  )}
                  <div className="text-xs font-medium text-orange-400/80 uppercase tracking-wider mb-2">{pack.type}</div>
                  <h3 className="text-xl font-bold text-white mb-2">{pack.name[lang]}</h3>
                  <p className="text-white/50 text-sm mb-6 flex-grow">{pack.desc[lang]}</p>
                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-white">{formatCLP(pack.now)}</span>
                      <span className="text-xs text-white/40">CLP</span>
                    </div>
                    <div className="text-sm text-white/30 line-through">{formatCLP(pack.before)}</div>
                    <div className="text-xs text-green-400 mt-1">
                      -{Math.round(((pack.before - pack.now) / pack.before) * 100)}% OFF
                    </div>
                  </div>
                  <a
                    href="#contact"
                    className={`text-center py-3 rounded-full font-semibold text-sm transition-all ${pack.popular ? "bg-orange-500 hover:bg-orange-600 text-white" : "bg-white/10 hover:bg-white/20 text-white"}`}
                  >
                    {dict.pricing.book}
                  </a>
                </div>
              </AnimatedSection>
            ))}
          </div>
        )}

        {tab === "programs" && (
          <AnimatedSection>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="py-4 px-4 text-sm font-medium text-white/50">{dict.pricing.tableHeaders.program}</th>
                    <th className="py-4 px-4 text-sm font-medium text-white/50">{dict.pricing.tableHeaders.description}</th>
                    <th className="py-4 px-4 text-sm font-medium text-white/50 text-right">{dict.pricing.tableHeaders.adult}</th>
                    <th className="py-4 px-4 text-sm font-medium text-white/50 text-right">{dict.pricing.tableHeaders.child}</th>
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 px-4 text-white font-medium text-sm">{p.keys[lang]}</td>
                      <td className="py-4 px-4 text-white/50 text-sm">{p.detail[lang]}</td>
                      <td className="py-4 px-4 text-white font-semibold text-right">{formatCLP(p.adult)}</td>
                      <td className="py-4 px-4 text-white/70 text-right">{formatCLP(p.child)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-white/30 text-xs mt-4">{dict.pricing.duration} · {dict.pricing.note}</p>
          </AnimatedSection>
        )}
      </div>
    </section>
  );
}
