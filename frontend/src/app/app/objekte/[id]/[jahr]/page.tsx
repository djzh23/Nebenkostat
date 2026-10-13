import { notFound } from "next/navigation";
import { settlementYear } from "@/lib/domain/settlement";
import { PropertyView } from "../../../_components/property-view";

export default async function PropertyPage({ params }: { params: Promise<{ id: string; jahr: string }> }) {
  const { id, jahr } = await params;
  const year = Number(jahr);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();

  const current = settlementYear();
  const otherYears = [current + 1, current, current - 1, current - 2].filter((candidate) => candidate !== year);

  return <PropertyView propertyId={id} year={year} otherYears={otherYears} />;
}
