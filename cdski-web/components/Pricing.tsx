"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

// ─── Pricing Data (CLP per person per session) ───
const PRICES = {
  group: { half: 65000, full: 128500 },
  private: { half: 102700, full: 188500 },
  equipmentAdult: 25000,
  equipmentChild: 20000,
  liftTicketAdult: 29000,
  liftTicketChild: 22000,
  childDiscount: 0.15,
};

function fmt(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

type Cfg = {
  activity: "ski" | "snowboard";
  lessonType: "group" | "private";
  duration: "half" | "full";
  adults: number;
  children: number;
  days: number;
  equipment: boolean;
  liftTicket: boolean;
};

function calc(c: Cfg) {
  const basePrice = PRICES[c.lessonType][c.duration];
  const childPrice = basePrice * (1 - PRICES.childDiscount);

  const lessonAdults = basePrice * c.adults;
  const lessonChildren = childPrice * c.children;
  const lessonsPerDay = lessonAdults + lessonChildren;

  const eqPerDay = c.equipment
    ? PRICES.equipmentAdult * c.adults + PRICES.equipmentChild * c.children
    : 0;

  const ticketPerDay = c.liftTicket
    ? PRICES.liftTicketAdult * c.adults + PRICES.liftTicketChild * c.children
    : 0;

  const subtotalPerDay = lessonsPerDay + eqPerDay + ticketPerDay;
  const total = subtotalPerDay * c.days;

  return { lessonsPerDay, eqPerDay, ticketPerDay, subtotalPerDay, total };
}

// ─── Sub-components ───

function Toggle({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex bg-white/5 rounded-xl p-1 border border-white/10">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all ${
            value === opt.value
              ? "bg-orange-500 text-white shadow-lg"
              : "text-white/50 hover:text-white"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 border border-white/10">
      <span className="text-white/70 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-lg bg-white/10 text-white flex items-center justify-center hover:bg-white/20 disabled:opacity-30 transition-all"
        >
          -
        </button>
        <span className="text-white font-bold text-lg w-6 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-lg bg-orange-500/80 text-white flex items-center justify-center hover:bg-orange-500 disabled:opacity-30 transition-all"
        >
          +
        </button>
      </div>
    </div>
  );
}

function SwitchToggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 border border-white/10">
      <div>
        <span className="text-white/70 text-sm">{label}</span>
        <p className="text-white/30 text-xs mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? "bg-orange-500" : "bg-white/10"
        }`}
      >
        <div
          className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform shadow ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

// ─── Booking Modal ───

function BookingModal({
  dict,
  cfg,
  totals,
  lang,
  onClose,
}: {
  dict: Dictionary;
  cfg: Cfg;
  totals: ReturnType<typeof calc>;
  lang: string;
  onClose: () => void;
}) {
  const t = dict.pricing.bookingModal;
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", comments: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  function buildSummaryText() {
    const actLabel = dict.pricing.calculator.activityOptions[cfg.activity];
    const typeLabel = dict.pricing.calculator.lessonTypeOptions[cfg.lessonType];
    const durLabel = dict.pricing.calculator.durationOptions[cfg.duration];
    const lines = [
      `--- CDSKI Booking Request ---`,
      `Activity: ${actLabel}`,
      `Type: ${typeLabel}`,
      `Duration: ${durLabel}`,
      `Adults: ${cfg.adults}`,
      `Children: ${cfg.children}`,
      `Days: ${cfg.days}`,
      `Equipment: ${cfg.equipment ? "Yes" : "No"}`,
      `Lift Ticket: ${cfg.liftTicket ? "Yes" : "No"}`,
      ``,
      `Subtotal/day: ${fmt(totals.subtotalPerDay)}`,
      `TOTAL: ${fmt(totals.total)} CLP`,
      ``,
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone || "N/A"}`,
      `Preferred Date: ${form.date || "N/A"}`,
      `Comments: ${form.comments || "N/A"}`,
    ];
    return lines.join("\n");
  }

  async function handleSubmit() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = t.errors.name;
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      e.email = t.errors.email;
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    setErrors({});
    setStatus("sending");

    try {
      // EmailJS: send to admin
      const emailjs = await import("@emailjs/browser");
      const summary = buildSummaryText();

      await emailjs.send(
        "service_cdski",    // Replace with your EmailJS Service ID
        "template_admin",   // Replace with your EmailJS Admin Template ID
        {
          to_email: "info@clasesdeski.cl",
          from_name: form.name,
          from_email: form.email,
          phone: form.phone,
          preferred_date: form.date,
          comments: form.comments,
          summary,
          total: fmt(totals.total),
        },
        "YOUR_EMAILJS_PUBLIC_KEY" // Replace with your EmailJS Public Key
      );

      // EmailJS: send confirmation to user
      await emailjs.send(
        "service_cdski",       // Same Service ID
        "template_user",       // Replace with your EmailJS User Template ID
        {
          to_email: form.email,
          to_name: form.name,
          summary,
          total: fmt(totals.total),
        },
        "YOUR_EMAILJS_PUBLIC_KEY"
      );

      setStatus("success");
    } catch {
      // Fallback: open mailto
      const subject = encodeURIComponent("CDSKI Booking Request - " + form.name);
      const body = encodeURIComponent(buildSummaryText());
      window.open(
        `mailto:info@clasesdeski.cl?subject=${subject}&body=${body}&cc=${encodeURIComponent(form.email)}`,
        "_blank"
      );
      setStatus("success");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        className="bg-[#0f2040] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 sm:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-xl font-bold text-white">{t.title}</h3>
              <p className="text-white/40 text-sm mt-1">{t.subtitle}</p>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {status === "success" ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="text-lg font-bold text-white mb-2">{t.successTitle}</h4>
              <p className="text-white/50 text-sm mb-6">{t.successMsg}</p>
              <button onClick={onClose} className="bg-orange-500 text-white px-6 py-2.5 rounded-full font-medium">
                {t.close}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-orange-300 text-sm font-medium">Total</span>
                  <span className="text-orange-400 text-xl font-bold">{fmt(totals.total)} CLP</span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder={t.name}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`w-full bg-white/5 border ${errors.name ? "border-red-400/50" : "border-white/10"} rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50`}
                />
                {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <input
                  type="email"
                  placeholder={t.email}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`w-full bg-white/5 border ${errors.email ? "border-red-400/50" : "border-white/10"} rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50`}
                />
                {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="tel"
                  placeholder={t.phone}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50"
                />
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white/70 focus:outline-none focus:border-orange-400/50"
                />
              </div>
              <textarea
                placeholder={t.comments}
                rows={2}
                value={form.comments}
                onChange={(e) => setForm({ ...form, comments: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-orange-400/50 resize-none"
              />

              <button
                onClick={handleSubmit}
                disabled={status === "sending"}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-3.5 rounded-full transition-all"
              >
                {status === "sending" ? t.sending : t.submit}
              </button>

              {status === "error" && (
                <p className="text-red-400 text-sm text-center">{t.errorMsg}</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───

export default function Pricing({ dict, lang }: { dict: Dictionary; lang: "es" | "en" | "pt" }) {
  const t = dict.pricing;
  const [cfg, setCfg] = useState<Cfg>({
    activity: "ski",
    lessonType: "group",
    duration: "half",
    adults: 2,
    children: 0,
    days: 1,
    equipment: true,
    liftTicket: true,
  });
  const [showModal, setShowModal] = useState(false);

  const totalPeople = cfg.adults + cfg.children;
  const totals = totalPeople > 0 ? calc(cfg) : { lessonsPerDay: 0, eqPerDay: 0, ticketPerDay: 0, subtotalPerDay: 0, total: 0 };

  function buildWhatsAppMsg() {
    const actLabel = t.calculator.activityOptions[cfg.activity];
    const typeLabel = t.calculator.lessonTypeOptions[cfg.lessonType];
    const durLabel = t.calculator.durationOptions[cfg.duration];
    const msg = [
      `Hola! Quiero reservar clases con CDSKI:`,
      `- ${actLabel} / ${typeLabel} / ${durLabel}`,
      `- ${cfg.adults} adulto(s), ${cfg.children} niño(s)`,
      `- ${cfg.days} día(s)`,
      `- Equipo: ${cfg.equipment ? "Sí" : "No"}`,
      `- Ticket: ${cfg.liftTicket ? "Sí" : "No"}`,
      `- Total estimado: ${fmt(totals.total)} CLP`,
    ].join("\n");
    return encodeURIComponent(msg);
  }

  return (
    <section id="pricing" className="py-24 bg-[#0a1628] relative">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AnimatedSection className="text-center mb-14">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">{t.title}</h2>
          <p className="text-lg text-blue-200/60 max-w-2xl mx-auto">{t.subtitle}</p>
        </AnimatedSection>

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Calculator Panel ── */}
          <AnimatedSection delay={0.1} className="lg:col-span-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/10 space-y-5">
              {/* Activity */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                  {t.calculator.activity}
                </label>
                <Toggle
                  value={cfg.activity}
                  onChange={(v) => setCfg({ ...cfg, activity: v as "ski" | "snowboard" })}
                  options={[
                    { value: "ski", label: `${t.calculator.activityOptions.ski}` },
                    { value: "snowboard", label: `${t.calculator.activityOptions.snowboard}` },
                  ]}
                />
              </div>

              {/* Lesson Type */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                  {t.calculator.lessonType}
                </label>
                <Toggle
                  value={cfg.lessonType}
                  onChange={(v) => setCfg({ ...cfg, lessonType: v as "group" | "private" })}
                  options={[
                    { value: "group", label: t.calculator.lessonTypeOptions.group },
                    { value: "private", label: t.calculator.lessonTypeOptions.private },
                  ]}
                />
              </div>

              {/* Duration */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                  {t.calculator.duration}
                </label>
                <Toggle
                  value={cfg.duration}
                  onChange={(v) => setCfg({ ...cfg, duration: v as "half" | "full" })}
                  options={[
                    { value: "half", label: t.calculator.durationOptions.half },
                    { value: "full", label: t.calculator.durationOptions.full },
                  ]}
                />
              </div>

              <div className="border-t border-white/5 pt-5 space-y-3">
                <Counter
                  label={t.calculator.adults}
                  value={cfg.adults}
                  onChange={(v) => setCfg({ ...cfg, adults: v })}
                  min={0}
                  max={20}
                />
                <Counter
                  label={t.calculator.children}
                  value={cfg.children}
                  onChange={(v) => setCfg({ ...cfg, children: v })}
                  min={0}
                  max={20}
                />
                <Counter
                  label={t.calculator.days}
                  value={cfg.days}
                  onChange={(v) => setCfg({ ...cfg, days: v })}
                  min={1}
                  max={14}
                />
              </div>

              <div className="border-t border-white/5 pt-5 space-y-3">
                <SwitchToggle
                  label={t.calculator.equipment}
                  desc={t.calculator.equipmentDesc}
                  checked={cfg.equipment}
                  onChange={(v) => setCfg({ ...cfg, equipment: v })}
                />
                <SwitchToggle
                  label={t.calculator.liftTicket}
                  desc={t.calculator.liftTicketDesc}
                  checked={cfg.liftTicket}
                  onChange={(v) => setCfg({ ...cfg, liftTicket: v })}
                />
              </div>
            </div>
          </AnimatedSection>

          {/* ── Summary Panel ── */}
          <AnimatedSection delay={0.2} className="lg:col-span-2">
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden sticky top-24">
              <div className="bg-orange-500/10 border-b border-orange-500/20 px-6 py-4">
                <h3 className="text-lg font-bold text-white">{t.summary.title}</h3>
              </div>

              <div className="p-6 space-y-4">
                {/* Config badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-orange-500/10 text-orange-300 text-xs rounded-full border border-orange-500/20">
                    {t.calculator.activityOptions[cfg.activity]}
                  </span>
                  <span className="px-3 py-1 bg-blue-500/10 text-blue-300 text-xs rounded-full border border-blue-500/20">
                    {t.calculator.lessonTypeOptions[cfg.lessonType]}
                  </span>
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-300 text-xs rounded-full border border-purple-500/20">
                    {t.calculator.durationOptions[cfg.duration]}
                  </span>
                </div>

                <div className="text-white/40 text-xs">
                  {totalPeople} {t.summary.totalPeople} &middot; {cfg.days} {t.summary.totalDays}
                </div>

                {/* Line items */}
                <div className="space-y-3 border-t border-white/5 pt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">{t.summary.lessons}</span>
                    <span className="text-white">{fmt(totals.lessonsPerDay)} {t.summary.perDay}</span>
                  </div>
                  {cfg.equipment && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t.summary.equipment}</span>
                      <span className="text-white">{fmt(totals.eqPerDay)} {t.summary.perDay}</span>
                    </div>
                  )}
                  {cfg.liftTicket && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t.summary.liftTicket}</span>
                      <span className="text-white">{fmt(totals.ticketPerDay)} {t.summary.perDay}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-sm border-t border-white/5 pt-3">
                    <span className="text-white/60">{t.summary.subtotal} {t.summary.perDay}</span>
                    <span className="text-white font-medium">{fmt(totals.subtotalPerDay)}</span>
                  </div>

                  {cfg.days > 1 && (
                    <div className="text-white/30 text-xs text-right">
                      &times; {cfg.days} {t.summary.totalDays}
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 flex justify-between items-center">
                  <span className="text-orange-300 font-medium">{t.summary.total}</span>
                  <span className="text-2xl font-bold text-white">{fmt(totals.total)}</span>
                </div>

                {cfg.lessonType === "group" && (
                  <p className="text-white/30 text-[11px] leading-relaxed">{t.summary.groupNote}</p>
                )}

                {/* Action buttons */}
                <div className="space-y-3 pt-2">
                  <button
                    onClick={() => totalPeople > 0 && setShowModal(true)}
                    disabled={totalPeople === 0}
                    className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-semibold py-3.5 rounded-full transition-all hover:scale-[1.02] text-sm"
                  >
                    {t.summary.requestBooking}
                  </button>

                  <a
                    href={`https://wa.me/56940211459?text=${buildWhatsAppMsg()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3.5 rounded-full transition-all hover:scale-[1.02] text-sm"
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    {t.summary.sendWhatsApp}
                  </a>
                </div>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <BookingModal
            dict={dict}
            cfg={cfg}
            totals={totals}
            lang={lang}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
