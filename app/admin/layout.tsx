import { AiTakenProvider } from "./dashboard/AiTaken";
import { DialoogProvider } from "./dashboard/Dialoog";

/**
 * Omhulsel voor het hele beheerpaneel.
 *
 * Twee lagen die overal beschikbaar moeten zijn en het wisselen van scherm moeten
 * overleven:
 *
 * - de takenlaag, zodat een lopende AI-opdracht doorgaat als je naar een ander tabblad
 *   gaat; alles wat hieronder hangt wordt namelijk opnieuw opgebouwd;
 * - de dialooglaag, die de kale vensters van de browser vervangt. Die tonen een balk met
 *   het adres van de site, een andere letter, en een OK-knop die er hetzelfde uitziet of
 *   je nu iets bevestigt of iets voorgoed weggooit.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AiTakenProvider>
      <DialoogProvider>{children}</DialoogProvider>
    </AiTakenProvider>
  );
}
