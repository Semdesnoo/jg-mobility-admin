import { AiTakenProvider } from "./dashboard/AiTaken";

/**
 * Omhulsel voor het hele beheerpaneel.
 *
 * Bestaat alleen om de takenlaag hier te kunnen ophangen. Op deze plek blijft die
 * staan als je binnen het beheer van pagina naar pagina gaat, terwijl alles wat
 * eronder hangt opnieuw wordt opgebouwd. Een lopende AI-opdracht overleeft zo het
 * wisselen van scherm.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AiTakenProvider>{children}</AiTakenProvider>;
}
