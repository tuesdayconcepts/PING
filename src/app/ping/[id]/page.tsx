import { LegacyMapApp } from "@/components/LegacyMapApp";

export default async function PingByIdPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return <LegacyMapApp route={{ kind: "ping", id: params.id }} />;
}

