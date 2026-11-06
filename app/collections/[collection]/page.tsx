import { Suspense } from "react";
import { notFound } from "next/navigation";
import CollectionBrowser from "@/app/collections/[collection]/collection-browser";

const collectionSlugs = new Set(["everyday", "curated"]);

export default function CollectionPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#111111] px-5 py-20 text-center text-[#F5F2EC]">
          <p role="status" className="section-label">Opening collection</p>
        </main>
      }
    >
      {params.then(({ collection }) => (
        <CollectionContent collection={collection} />
      ))}
    </Suspense>
  );
}

function CollectionContent({ collection }: { collection: string }) {
  if (!collectionSlugs.has(collection)) notFound();

  return (
    <CollectionBrowser
      collection={collection as "everyday" | "curated"}
    />
  );
}
