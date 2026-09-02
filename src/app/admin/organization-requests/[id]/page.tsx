import { notFound } from "next/navigation";
import { getOrganizationRegistrationById } from "@/lib/organization/registration-db";
import { OrganizationRequestDetailView } from "../_components/OrganizationRequestDetailView";

export const revalidate = 0;

export default async function AdminOrganizationRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id) notFound();

  const request = await getOrganizationRegistrationById(id);
  if (!request) notFound();

  return <OrganizationRequestDetailView request={request} />;
}
