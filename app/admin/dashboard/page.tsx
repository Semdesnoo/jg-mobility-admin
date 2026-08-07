import DashboardHub from "./DashboardHub";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  // De takenlaag hangt in app/admin/layout.tsx, een niveau hoger: daar overleeft
  // een lopende AI-opdracht ook het wisselen van pagina.
  return <DashboardHub />;
}
