import { ALERT_TYPE_LABELS, farmerAlerts } from "@/core/alerts";
import AlertList from "./AlertList";

export default async function FarmerAlertsPage({ params }: PageProps<"/farmer/[id]/alerts">) {
  const id = Number((await params).id);
  const alerts = await farmerAlerts(id);
  return (
    <>
      <h2 className="font-semibold">Alertes du ministère</h2>
      <AlertList farmerId={id} alerts={alerts.map((a) => ({ ...a, typeLabel: ALERT_TYPE_LABELS[a.type] }))} />
    </>
  );
}
