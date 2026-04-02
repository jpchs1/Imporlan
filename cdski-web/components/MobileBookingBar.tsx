"use client";

import { useState, useEffect } from "react";
import type { Dictionary } from "@/lib/dictionaries";

export default function MobileBookingBar({ dict }: { dict: Dictionary }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0a1628]/95 backdrop-blur-xl border-t border-white/10 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <a
        href="#contact"
        className="block w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3.5 rounded-full text-center transition-all text-sm"
      >
        {dict.bookingSticky}
      </a>
    </div>
  );
}
