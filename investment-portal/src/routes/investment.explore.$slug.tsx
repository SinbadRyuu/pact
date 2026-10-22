import { createFileRoute } from "@tanstack/react-router";
import { ContentPage } from "@/components/ContentPage";

export const Route = createFileRoute("/investment/explore/$slug")({
  head: ({ params }) => {
    const topic = params.slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    const title = `${topic} — Explore Investments — VT Impact`;
    return { meta: [{ title }, { name: "description", content: "Explore investment categories with VT Impact." }, { property: "og:title", content: title }, { property: "og:description", content: "Explore investment categories with VT Impact." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] };
  },
  component: () => <ContentPage kind="category" slug={Route.useParams().slug} />,
});
