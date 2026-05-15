"use client";

import { LayoutGrid, Clock } from "lucide-react";

export default function MoliboxWidget() {
  return (
    <div className="p-6" style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}>
      <div className="flex items-center gap-2 mb-5">
        <LayoutGrid size={15} style={{ color: "#001337" }} />
        <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Molibox
        </h2>
        <span
          className="text-[10px] px-1.5 py-0.5 tracking-widest uppercase"
          style={{ backgroundColor: "rgba(0,19,55,0.06)", color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)" }}
        >
          Binnenkort
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Berichten & reacties", desc: "Alle platformreacties van geïnteresseerden in één overzicht" },
          { label: "Weergaven per platform", desc: "Hoeveel mensen de auto's bekeken op Marktplaats, AutoTrack e.a." },
          { label: "Automatische antwoorden", desc: "Veelgestelde vragen automatisch beantwoorden" },
        ].map((item) => (
          <div
            key={item.label}
            className="p-4 flex items-start gap-3"
            style={{ border: "1px dashed rgba(0,19,55,0.12)", backgroundColor: "rgba(0,19,55,0.015)" }}
          >
            <Clock size={14} className="flex-shrink-0 mt-0.5" style={{ color: "rgba(0,19,55,0.2)" }} />
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
                {item.label}
              </p>
              <p className="text-xs" style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
