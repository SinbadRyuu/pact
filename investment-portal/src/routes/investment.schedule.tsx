import { createFileRoute } from "@tanstack/react-router";
import { MemberSchedule } from "@/components/MemberSchedule";

export const Route = createFileRoute("/investment/schedule")({
  head: () => ({ meta: [{ title: "Investment Schedule — VT Impact" }, { name: "description", content: "Weekly VT Investment live calls and topics." }, { property: "og:title", content: "Investment Schedule — VT Impact" }, { property: "og:description", content: "Weekly live calls for VT Investment topics." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => <MemberSchedule audience="client" eyebrow="VT Investment" />,
});
