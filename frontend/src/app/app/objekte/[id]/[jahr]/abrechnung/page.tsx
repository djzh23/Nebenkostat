import { notFound } from "next/navigation";
import { SettlementView } from "../../../../_components/settlement-view";

export default async function SettlementPage({ params }: { params: Promise<{ id: string; jahr: string }> }) {
  const { id, jahr } = await params;
  const year = Number(jahr);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();

  return <SettlementView propertyId={id} year={year} />;
}
