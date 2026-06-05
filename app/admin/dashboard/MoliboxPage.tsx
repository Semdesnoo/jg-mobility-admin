"use client";

import { LayoutGrid, ExternalLink } from "lucide-react";

const MOLIBOX_URL = "https://members.mobilox.nl/#";

export default function MoliboxPage() {
  return (
    <div>
      <div
        className="px-4 md:px-8 py-4 md:py-5 sticky top-0 z-10"
        style={{ backgroundColor: "#ffffff", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
      >
        <h2 className="text-xl font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
          Molibox
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
          Open het Molibox-platform
        </p>
      </div>

      <div className="p-4 md:p-8">
        <div
          className="flex flex-col items-center justify-center text-center py-16 px-6"
          style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)" }}
        >
          <div
            className="flex items-center justify-center mb-5"
            style={{ width: 64, height: 64, backgroundColor: "#001337" }}
          >
            <LayoutGrid size={28} style={{ color: "#ffffff" }} />
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Molibox
          </h3>
          <p className="text-sm mb-7 max-w-md" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)" }}>
            Beheer je advertenties, berichten en platformreacties in het Molibox-ledenportaal.
            Klik op de knop om in te loggen.
          </p>
          <a
            href={MOLIBOX_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-7 py-3.5 text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            Open Molibox <ExternalLink size={15} />
          </a>
          <p className="text-[11px] mt-4" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
            members.mobilox.nl — opent in een nieuw tabblad
          </p>
        </div>
      </div>
    </div>
  );
}
