"use client";

import { useState, useEffect, useCallback } from "react";
import { Mail, RefreshCw, Send, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";

type EmailSummary = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

type EmailDetail = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  body: string;
  messageId: string;
};

function fromName(from: string): string {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim() || from;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" });
  } catch {
    return dateStr;
  }
}

export default function GmailWidget() {
  const [connected, setConnected] = useState<boolean | null>(null);
  // Waarom de koppeling niet werkt — "verlopen" verdient een andere tekst dan
  // "nog nooit gekoppeld", anders zoek je in de verkeerde hoek.
  const [reden, setReden] = useState<string | null>(null);
  const [tab, setTab] = useState<"inbox" | "cosignatie">("inbox");
  const [messages, setMessages] = useState<EmailSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    fetch("/api/admin/gmail/status")
      .then((r) => r.json())
      .then((d) => { setConnected(d.connected); setReden(d.reden ?? null); });
  }, []);

  const laadBerichten = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/gmail/messages?type=${tab}`);
    if (res.ok) setMessages(await res.json());
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (connected) laadBerichten();
  }, [connected, laadBerichten]);

  const openEmail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setReplyOpen(false);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setDetailLoading(true);
    setReplyOpen(false);
    const res = await fetch(`/api/admin/gmail/message/${id}`);
    if (res.ok) {
      const d = await res.json();
      setDetail(d);
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
      );
    }
    setDetailLoading(false);
  };

  const verstuurAntwoord = async () => {
    if (!detail || !replyText.trim()) return;
    setReplying(true);
    await fetch("/api/admin/gmail/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        threadId: detail.threadId,
        to: detail.from,
        subject: detail.subject,
        message: replyText,
        messageId: detail.messageId,
      }),
    });
    setReplyText("");
    setReplyOpen(false);
    setReplying(false);
  };

  // Niet gekoppeld
  if (connected === false) {
    return (
      <div
        className="p-6"
        style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", minHeight: "400px" }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Mail size={15} style={{ color: "#001337" }} />
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Gmail
          </h2>
        </div>
        <div className="flex flex-col items-center text-center py-8 gap-4">
          <AlertCircle size={28} style={{ color: "rgba(0,19,55,0.15)" }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
              {reden === "verlopen" ? "Gmail-koppeling verlopen" : "Gmail nog niet gekoppeld"}
            </p>
            <p className="text-xs mb-5" style={{ color: "rgba(0,19,55,0.45)", fontFamily: "var(--font-inter)", lineHeight: 1.65 }}>
              {reden === "verlopen"
                ? "Google heeft het token ingetrokken. Staat je OAuth-scherm nog op “Testing”, dan gebeurt dit elke 7 dagen — zet het op Internal of In production om dat te stoppen."
                : "Koppel info@jgmobility.nl om mails te lezen en te beantwoorden vanuit het dashboard"}
            </p>
          </div>
          <a
            href="/api/admin/gmail/connect"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold tracking-wide transition-all hover:opacity-90"
            style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
          >
            <Mail size={13} /> {reden === "verlopen" ? "Opnieuw koppelen" : "Koppel Gmail"}
          </a>
          <div
            className="text-left w-full mt-2 p-4"
            style={{ backgroundColor: "rgba(0,19,55,0.025)", border: "1px solid rgba(0,19,55,0.08)" }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: "#001337", fontFamily: "var(--font-inter)" }}>
              Eenmalige setup vereist:
            </p>
            {[
              "Ga naar console.cloud.google.com",
              "Maak project aan → Gmail API inschakelen",
              "Credentials → OAuth 2.0 Client ID aanmaken (Web app)",
              "Redirect URI toevoegen: http://localhost:3000/api/admin/gmail/callback",
              "GMAIL_CLIENT_ID en GMAIL_CLIENT_SECRET in .env.local zetten",
              "Dan op 'Koppel Gmail' klikken om te koppelen",
            ].map((stap, i) => (
              <p
                key={i}
                className="text-xs flex gap-2 mb-1"
                style={{ color: "rgba(0,19,55,0.6)", fontFamily: "var(--font-inter)", overflowWrap: "anywhere" }}
              >
                <span style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }}>{i + 1}.</span>
                {stap}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col"
      style={{ backgroundColor: "#ffffff", border: "1px solid rgba(0,19,55,0.07)", boxShadow: "0 1px 3px rgba(0,19,55,0.05)", minHeight: "400px" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}
      >
        <div className="flex items-center gap-2">
          <Mail size={15} style={{ color: "#001337" }} />
          <h2 className="text-sm font-bold" style={{ fontFamily: "var(--font-playfair)", color: "#001337" }}>
            Gmail
          </h2>
          {messages.filter((m) => m.unread).length > 0 && (
            <span
              className="text-[10px] px-1.5 py-0.5"
              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
            >
              {messages.filter((m) => m.unread).length} nieuw
            </span>
          )}
        </div>
        <button
          onClick={laadBerichten}
          disabled={loading}
          aria-label="Vernieuwen"
          className="flex items-center justify-center -mr-2 p-2 transition-all hover:opacity-60"
        >
          <RefreshCw
            size={12}
            className={loading ? "animate-spin" : ""}
            style={{ color: "rgba(0,19,55,0.35)" }}
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex" style={{ borderBottom: "1px solid rgba(0,19,55,0.07)" }}>
        {(["inbox", "cosignatie"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-3 text-xs font-semibold tracking-wide uppercase transition-all"
            style={{
              fontFamily: "var(--font-inter)",
              color: tab === t ? "#001337" : "rgba(0,19,55,0.4)",
              borderBottom: tab === t ? "2px solid #001337" : "2px solid transparent",
            }}
          >
            {t === "inbox" ? "Inbox" : "Cosignaties"}
          </button>
        ))}
      </div>

      {/* Berichten */}
      <div className="flex-1 overflow-y-auto" style={{ maxHeight: "480px" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div
              className="w-6 h-6 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }}
            />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-14">
            <p className="text-sm" style={{ color: "rgba(0,19,55,0.3)", fontFamily: "var(--font-inter)" }}>
              Geen berichten
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id}>
              <button
                onClick={() => openEmail(msg.id)}
                className="w-full px-5 py-3.5 text-left transition-all hover:bg-gray-50 flex items-start gap-3"
                style={{ borderBottom: "1px solid rgba(0,19,55,0.05)" }}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{
                    backgroundColor: msg.unread ? "#001337" : "transparent",
                    border: msg.unread ? "none" : "1px solid rgba(0,19,55,0.15)",
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className="text-xs truncate"
                      style={{
                        color: "#001337",
                        fontFamily: "var(--font-inter)",
                        fontWeight: msg.unread ? 700 : 500,
                      }}
                    >
                      {fromName(msg.from)}
                    </span>
                    <span
                      className="text-[10px] flex-shrink-0"
                      style={{ color: "rgba(0,19,55,0.35)", fontFamily: "var(--font-inter)" }}
                    >
                      {formatDate(msg.date)}
                    </span>
                  </div>
                  <p
                    className="text-xs truncate mb-0.5"
                    style={{
                      color: msg.unread ? "#001337" : "rgba(0,19,55,0.65)",
                      fontFamily: "var(--font-inter)",
                      fontWeight: msg.unread ? 600 : 400,
                    }}
                  >
                    {msg.subject || "(geen onderwerp)"}
                  </p>
                  <p className="text-xs truncate" style={{ color: "rgba(0,19,55,0.4)", fontFamily: "var(--font-inter)" }}>
                    {msg.snippet}
                  </p>
                </div>
                {expandedId === msg.id ? (
                  <ChevronUp size={12} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
                ) : (
                  <ChevronDown size={12} style={{ color: "rgba(0,19,55,0.3)", flexShrink: 0 }} />
                )}
              </button>

              {/* Uitgebreide e-mail */}
              {expandedId === msg.id && (
                <div
                  className="px-5 py-4"
                  style={{ backgroundColor: "rgba(0,19,55,0.02)", borderBottom: "1px solid rgba(0,19,55,0.08)" }}
                >
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div
                        className="w-5 h-5 rounded-full border-2 animate-spin"
                        style={{ borderColor: "rgba(0,19,55,0.1)", borderTopColor: "#001337" }}
                      />
                    </div>
                  ) : detail ? (
                    <>
                      <div className="mb-3 pb-3" style={{ borderBottom: "1px solid rgba(0,19,55,0.08)" }}>
                        <p className="text-xs" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", overflowWrap: "anywhere" }}>
                          Van: <span style={{ color: "#001337" }}>{detail.from}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "rgba(0,19,55,0.5)", fontFamily: "var(--font-inter)", overflowWrap: "anywhere" }}>
                          Datum: <span style={{ color: "#001337" }}>{detail.date}</span>
                        </p>
                      </div>
                      <div
                        className="text-xs mb-4 overflow-auto"
                        style={{
                          color: "#001337",
                          fontFamily: "var(--font-inter)",
                          lineHeight: 1.6,
                          maxHeight: "220px",
                          overflowWrap: "anywhere",
                          wordBreak: "break-word",
                        }}
                        dangerouslySetInnerHTML={{ __html: detail.body || "(leeg)" }}
                      />
                      {!replyOpen ? (
                        <button
                          onClick={() => setReplyOpen(true)}
                          className="flex items-center gap-1.5 py-1.5 text-xs font-semibold transition-all hover:opacity-70"
                          style={{ color: "#001337", fontFamily: "var(--font-inter)" }}
                        >
                          <Send size={11} /> Beantwoorden
                        </button>
                      ) : (
                        <div>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            rows={4}
                            placeholder="Typ je antwoord..."
                            className="w-full px-3 py-2.5 text-xs outline-none resize-none mb-2"
                            style={{
                              backgroundColor: "#ffffff",
                              border: "1px solid rgba(0,19,55,0.15)",
                              color: "#001337",
                              fontFamily: "var(--font-inter)",
                              lineHeight: 1.6,
                            }}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={verstuurAntwoord}
                              disabled={replying || !replyText.trim()}
                              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-40"
                              style={{ backgroundColor: "#001337", color: "#ffffff", fontFamily: "var(--font-inter)" }}
                            >
                              <Send size={10} />
                              {replying ? "Verzenden..." : "Versturen"}
                            </button>
                            <button
                              onClick={() => setReplyOpen(false)}
                              className="px-4 py-2.5 text-xs font-semibold transition-all hover:opacity-70"
                              style={{ border: "1px solid rgba(0,19,55,0.15)", color: "#001337", fontFamily: "var(--font-inter)" }}
                            >
                              Annuleren
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
