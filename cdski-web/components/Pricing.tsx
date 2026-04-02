"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedSection from "./AnimatedSection";
import type { Dictionary } from "@/lib/dictionaries";

// ─── Pricing Data (CLP per person per session) — +20% applied ───
const USD_RATE = 950; // CLP per 1 USD (approximate)

const PRICES = {
  group: { half: 78000, full: 154200 },   // was 65k/128.5k → +20%
  private: { half: 123200, full: 226200 }, // was 102.7k/188.5k → +20%
  equipment: 65000, // flat per person, includes ski/snowboard + boots + poles + helmet
  liftTicketAdult: 29000,
  liftTicketChild: 22000,
  childDiscount: 0.15,
};

// Real schedules from CDSKI
const SCHEDULES = {
  half: "11:00 - 14:00",
  full: "11:00 - 13:30 + 14:30 - 16:30",
};

function fmtCLP(n: number) {
  return "$" + Math.round(n).toLocaleString("es-CL");
}

function fmtUSD(n: number) {
  return "US$" + Math.round(n / USD_RATE).toLocaleString("en-US");
}

type Cfg = {
  activity: "ski" | "snowboard";
  lessonType: "group" | "private";
  duration: "half" | "full";
  schedule: "morning" | "afternoon" | "block1" | "block2" | "block3";
  adults: number;
  children: number;
  days: number;
  equipment: boolean;
  liftTicket: boolean;
  transfer: boolean;
};

const TRANSFER_PRICE = 35000; // per person

function calc(c: Cfg) {
  const basePrice = PRICES[c.lessonType][c.duration];
  const childPrice = basePrice * (1 - PRICES.childDiscount);
  const totalPeople = c.adults + c.children;

  const lessonsPerDay = basePrice * c.adults + childPrice * c.children;

  const eqPerDay = c.equipment
    ? PRICES.equipment * totalPeople
    : 0;

  const transferPerDay = c.transfer && totalPeople >= 4
    ? TRANSFER_PRICE * totalPeople
    : 0;

  const subtotalPerDay = lessonsPerDay + eqPerDay + transferPerDay;
  const total = subtotalPerDay * c.days;

  return { lessonsPerDay, eqPerDay, transferPerDay, subtotalPerDay, total };
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
  price,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  price?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-xl px-5 py-3 border border-white/10">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-sm">{label}</span>
          {price && (
            <span className="text-orange-400/70 text-xs font-medium">{price}</span>
          )}
        </div>
        <p className="text-white/30 text-xs mt-0.5">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ml-3 ${
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
  currency,
  lang,
  onClose,
}: {
  dict: Dictionary;
  cfg: Cfg;
  totals: ReturnType<typeof calc>;
  currency: "CLP" | "USD";
  lang: string;
  onClose: () => void;
}) {
  const t = dict.pricing.bookingModal;
  const fmt = currency === "USD" ? fmtUSD : fmtCLP;
  const [form, setForm] = useState({ name: "", email: "", phone: "", date: "", comments: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");

  function getScheduleLabel() {
    return cfg.duration === "full" ? SCHEDULES.full : SCHEDULES.half;
  }

  function buildSummaryText() {
    const actLabel = dict.pricing.calculator.activityOptions[cfg.activity];
    const typeLabel = dict.pricing.calculator.lessonTypeOptions[cfg.lessonType];
    const durLabel = dict.pricing.calculator.durationOptions[cfg.duration];
    const lines = [
      `--- CDSKI Booking Request ---`,
      `Activity: ${actLabel}`,
      `Type: ${typeLabel}`,
      `Duration: ${durLabel}`,
      `Schedule: ${getScheduleLabel()}`,
      `Adults: ${cfg.adults}`,
      `Children: ${cfg.children}`,
      `Days: ${cfg.days}`,
      `Equipment: ${cfg.equipment ? "Yes" : "No"}`,
      cfg.transfer && (cfg.adults + cfg.children) >= 4 ? `Transfer: Yes` : "",
      ``,
      `Subtotal/day: ${fmtCLP(totals.subtotalPerDay)} CLP (${fmtUSD(totals.subtotalPerDay)})`,
      `TOTAL: ${fmtCLP(totals.total)} CLP (${fmtUSD(totals.total)})`,
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
      const summary = buildSummaryText();
      const res = await fetch("https://clasesdeski.cl/test/api/booking.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          date: form.date,
          comments: form.comments,
          summary,
          total: `${fmtCLP(totals.total)} (${fmtUSD(totals.total)})`,
          lang,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
    } catch {
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
                  <div className="text-right">
                    <span className="text-orange-400 text-xl font-bold">{fmtCLP(totals.total)}</span>
                    <span className="text-orange-300/60 text-sm ml-2">({fmtUSD(totals.total)})</span>
                  </div>
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
    schedule: "block1",
    adults: 2,
    children: 0,
    days: 1,
    equipment: false,
    liftTicket: false,
    transfer: false,
  });
  const [currency, setCurrency] = useState<"CLP" | "USD">("CLP");
  const [showModal, setShowModal] = useState(false);

  const fmt = currency === "USD" ? fmtUSD : fmtCLP;
  const totalPeople = cfg.adults + cfg.children;
  const totals = totalPeople > 0 ? calc(cfg) : { lessonsPerDay: 0, eqPerDay: 0, transferPerDay: 0, subtotalPerDay: 0, total: 0 };

  function getScheduleDisplay() {
    return cfg.duration === "full" ? SCHEDULES.full : SCHEDULES.half;
  }

  function buildWhatsAppMsg() {
    const actLabel = t.calculator.activityOptions[cfg.activity];
    const typeLabel = t.calculator.lessonTypeOptions[cfg.lessonType];
    const durLabel = t.calculator.durationOptions[cfg.duration];
    const msg = [
      `Hola! Quiero reservar clases con CDSKI:`,
      `- ${actLabel} / ${typeLabel} / ${durLabel}`,
      `- Horario: ${getScheduleDisplay()}`,
      `- ${cfg.adults} adulto(s), ${cfg.children} niño(s)`,
      `- ${cfg.days} día(s)`,
      `- Equipo: ${cfg.equipment ? "Sí" : "No"}`,
      cfg.transfer && totalPeople >= 4 ? `- Traslado: Sí` : "",
      `- Total estimado: ${fmtCLP(totals.total)} CLP (${fmtUSD(totals.total)})`,
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
                    { value: "ski", label: t.calculator.activityOptions.ski },
                    { value: "snowboard", label: t.calculator.activityOptions.snowboard },
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
                  onChange={(v) => {
                    const lt = v as "group" | "private";
                    setCfg({ ...cfg, lessonType: lt, schedule: lt === "group" ? "block1" : "morning" });
                  }}
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
                  onChange={(v) => {
                    const dur = v as "half" | "full";
                    setCfg({ ...cfg, duration: dur, ...(dur === "full" ? { schedule: "morning" } : {}) });
                  }}
                  options={[
                    { value: "half", label: t.calculator.durationOptions.half },
                    { value: "full", label: t.calculator.durationOptions.full },
                  ]}
                />
              </div>

              {/* Schedule */}
              <div>
                <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                  {t.calculator.schedule}
                </label>
                <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10 flex items-center gap-3">
                  <svg className="w-5 h-5 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <span className="text-white text-sm font-medium">{getScheduleDisplay()}</span>
                    {cfg.duration === "full" && (
                      <p className="text-orange-400/60 text-xs mt-0.5">{t.calculator.beginnerTip}</p>
                    )}
                  </div>
                </div>
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
                  price={`${fmtCLP(PRICES.equipment)}/pp`}
                  checked={cfg.equipment}
                  onChange={(v) => setCfg({ ...cfg, equipment: v })}
                />
                <p className="text-white/25 text-[11px] leading-relaxed px-1">
                  {t.calculator.equipmentNote}
                </p>
                {/* Transfer — only for 4+ people */}
                {totalPeople >= 4 && (
                  <SwitchToggle
                    label={t.calculator.transfer}
                    desc={t.calculator.transferDesc}
                    price={`${fmtCLP(TRANSFER_PRICE)}/pp`}
                    checked={cfg.transfer}
                    onChange={(v) => setCfg({ ...cfg, transfer: v })}
                  />
                )}

                <div className="bg-white/5 rounded-xl px-5 py-3 border border-white/10">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white/50 text-xs">{t.calculator.liftTicketNote}</span>
                  </div>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* ── Summary Panel ── */}
          <AnimatedSection delay={0.2} className="lg:col-span-2">
            <div className="bg-gradient-to-b from-white/[0.07] to-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden sticky top-24">
              <div className="bg-orange-500/10 border-b border-orange-500/20 px-6 py-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{t.summary.title}</h3>
                {/* Currency toggle */}
                <div className="flex bg-white/10 rounded-lg p-0.5">
                  <button
                    onClick={() => setCurrency("CLP")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      currency === "CLP" ? "bg-orange-500 text-white" : "text-white/50"
                    }`}
                  >
                    CLP
                  </button>
                  <button
                    onClick={() => setCurrency("USD")}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                      currency === "USD" ? "bg-orange-500 text-white" : "text-white/50"
                    }`}
                  >
                    USD
                  </button>
                </div>
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

                {/* Schedule info */}
                <div className="flex items-center gap-2 text-white/40 text-xs">
                  <svg className="w-3.5 h-3.5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{getScheduleDisplay()}</span>
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

                  {cfg.transfer && totalPeople >= 4 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60">{t.summary.transfer}</span>
                      <span className="text-white">{fmt(totals.transferPerDay)} {t.summary.perDay}</span>
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
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-300 font-medium">{t.summary.total}</span>
                    <span className="text-2xl font-bold text-white">{fmt(totals.total)}</span>
                  </div>
                  {currency === "CLP" && (
                    <div className="text-right text-white/30 text-xs mt-1">
                      ≈ {fmtUSD(totals.total)}
                    </div>
                  )}
                  {currency === "USD" && (
                    <div className="text-right text-white/30 text-xs mt-1">
                      ≈ {fmtCLP(totals.total)} CLP
                    </div>
                  )}
                </div>

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
            currency={currency}
            lang={lang}
            onClose={() => setShowModal(false)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}
