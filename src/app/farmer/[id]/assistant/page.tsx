import { getFarmer } from "@/core/farmers";
import Chat from "./Chat";

export default async function AssistantPage({ params }: PageProps<"/farmer/[id]/assistant">) {
  const farmer = (await getFarmer(Number((await params).id)))!;
  return <Chat farmerId={farmer.id} firstName={farmer.name.split(" ")[0]} defaultLanguage={farmer.language} />;
}
