import Link from "next/link";
import { ALERT_TYPE_LABELS, listAlerts } from "@/core/alerts";
import { Badge, Card } from "@/components/ui";
import { fmt } from "@/lib/format";

export default async function AlertsPage() {
  const alerts = await listAlerts();
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <Card title="Alertes envoyées">
        <p className="text-sm text-neutral-600">Pour envoyer une alerte, filtrez les exploitations sur la <Link className="text-brand-700 underline" href="/gov">carte</Link>.</p>
      </Card>
      {alerts.map((a) => (
        <Card key={a.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{ALERT_TYPE_LABELS[a.type]}</Badge>
            <h2 className="font-semibold">{a.title}</h2>
            <span className="ml-auto text-xs text-neutral-500">{new Date(a.sentAt).toLocaleString("fr-FR")}</span>
          </div>
          <p className="mt-2 text-sm text-neutral-700">{a.body}</p>
          <p className="mt-2 text-xs text-neutral-500">
            {fmt(a.recipients)} destinataires · lue par {fmt(a.readCount)} ({a.recipients ? Math.round((a.readCount / a.recipients) * 100) : 0} %) · filtres : <code>{JSON.stringify(a.audienceFilter)}</code>
          </p>
        </Card>
      ))}
    </div>
  );
}
