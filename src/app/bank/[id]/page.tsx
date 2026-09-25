import { notFound } from "next/navigation";
import { getBank } from "@/core/partner";
import { getDepartments, getProducts } from "@/core/reference";
import BankPortal from "./BankPortal";

export default async function BankPage({ params }: PageProps<"/bank/[id]">) {
  const bank = await getBank(Number((await params).id));
  if (!bank) notFound();
  const [departments, crops] = await Promise.all([getDepartments(), getProducts("crop")]);
  return <BankPortal bank={bank} departments={departments.map((d) => d.name)} crops={crops.map((c) => ({ code: c.code, name: c.nameFr }))} />;
}
