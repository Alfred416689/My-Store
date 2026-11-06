"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type ProductCollection = "everyday" | "curated";

type PreviewProduct = {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  image: string;
  badge?: string;
};

type PreviewState = {
  products: PreviewProduct[];
  error: string;
};

const collectionInfo: Record<
  ProductCollection,
  { title: string; subtitle: string; description: string }
> = {
  everyday: {
    title: "EVERYDAY FINDS",
    subtitle: "Great style. Better prices.",
    description:
      "Discover stylish thrift pieces at accessible prices. Find everyday fashion without compromising on personal style.",
  },
  curated: {
    title: "THE CURATED COLLECTION",
    subtitle: "Rare finds. Distinctive style.",
    description:
      "Explore carefully selected thrift pieces featuring distinctive styles, special finds, and premium-quality fashion.",
  },
};

function ProductPrice({ product }: { product: PreviewProduct }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-semibold">₹{product.price.toLocaleString("en-IN")}</span>
      {product.compareAtPrice && product.compareAtPrice > product.price && (
        <>
          <span className="text-xs text-[#D9D6CF]/60 line-through">
            ₹{product.compareAtPrice.toLocaleString("en-IN")}
          </span>
          <span className="text-[0.55rem] font-bold uppercase tracking-[0.16em] text-[#c99c80]">
            Reduced
          </span>
        </>
      )}
    </div>
  );
}

function EverydayPreview({
  products,
  error,
}: PreviewState) {
  return (
    <section className="bg-[#F5F2EC] py-16 text-[#171715] md:py-24">
      <div className="track-limiter">
        <div className="mb-9 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="section-label !text-[#59574f]">S2G / The daily edit</p>
            <h2 className="mt-3 font-display text-5xl tracking-[0.07em] sm:text-6xl">
              {collectionInfo.everyday.title}
            </h2>
            <p className="mt-2 text-sm font-semibold tracking-wide text-[#59574f]">
              {collectionInfo.everyday.subtitle}
            </p>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#59574f]">
            {collectionInfo.everyday.description}
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl border border-[#8c3f38]/25 bg-[#8c3f38]/5 p-6 text-sm text-[#6d3a3a]">
            {error}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#171715]/20 p-8 text-center text-sm text-[#59574f]">
            Everyday Finds are being refreshed. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {products.map((product) => (
              <Link
                key={product.id}
                href="/collections/everyday"
                className="group min-w-0"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-[#e6e2d9]">
                  <Image
                    src={product.image}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 23vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  {product.badge && (
                    <span className="absolute left-2 top-2 bg-[#F5F2EC]/90 px-2.5 py-1 text-[0.52rem] font-bold uppercase tracking-[0.13em] sm:left-3 sm:top-3">
                      {product.badge}
                    </span>
                  )}
                </div>
                <div className="pt-3 sm:pt-4">
                  <p className="text-[0.55rem] font-bold uppercase tracking-[0.18em] text-[#77746d]">
                    {product.category}
                  </p>
                  <h3 className="mt-1 truncate text-sm font-semibold sm:text-base">
                    {product.name}
                  </h3>
                  <div className="mt-2 text-sm">
                    <ProductPrice product={product} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-9 flex justify-center">
          <Link
            href="/collections/everyday"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#171715]/35 px-7 text-[0.62rem] font-bold uppercase tracking-[0.18em] transition hover:bg-[#171715] hover:text-[#F5F2EC]"
          >
            View all Everyday Finds
          </Link>
        </div>
      </div>
    </section>
  );
}

function CuratedPreview({ products, error }: PreviewState) {
  const [feature, ...others] = products;

  return (
    <section className="border-y border-white/10 bg-[#171715] py-16 md:py-24">
      <div className="track-limiter">
        <div className="mb-9 grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="section-label text-[#c4b8a4]">S2G / Selected with intent</p>
            <h2 className="mt-3 max-w-3xl font-display text-5xl leading-[0.92] tracking-[0.07em] sm:text-6xl">
              {collectionInfo.curated.title}
            </h2>
            <p className="mt-3 text-sm font-medium tracking-wide text-[#c4b8a4]">
              {collectionInfo.curated.subtitle}
            </p>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#D9D6CF]">
            {collectionInfo.curated.description}
          </p>
        </div>

        {error ? (
          <p role="alert" className="rounded-2xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 p-6 text-sm text-[#F5D6D1]">
            {error}
          </p>
        ) : products.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-[#D9D6CF]">
            New selected pieces are on their way. Check back soon.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.35fr_0.65fr] md:gap-7">
            {feature && (
              <Link href="/collections/curated" className="group relative min-h-[440px] overflow-hidden bg-[#292821] sm:min-h-[560px]">
                <Image
                  src={feature.image}
                  alt={feature.name}
                  fill
                  priority={false}
                  sizes="(max-width: 768px) 100vw, 60vw"
                  className="object-cover transition duration-700 group-hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-[#e2d7c6]">
                    {feature.category} · Editor&apos;s selection
                  </p>
                  <h3 className="mt-2 font-display text-4xl tracking-[0.06em] sm:text-5xl">
                    {feature.name}
                  </h3>
                  <div className="mt-3 text-sm text-white">
                    <ProductPrice product={feature} />
                  </div>
                </div>
              </Link>
            )}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-5">
              {others.slice(0, 2).map((product, index) => (
                <Link
                  key={product.id}
                  href="/collections/curated"
                  className="group min-w-0"
                >
                  <div className={`relative overflow-hidden bg-[#292821] ${index === 0 ? "aspect-[4/3] md:aspect-[1.13/1]" : "aspect-[4/3] md:aspect-[1.13/1]"}`}>
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 768px) 48vw, 30vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.04]"
                    />
                    {product.badge && (
                      <span className="absolute left-2 top-2 border border-white/30 bg-black/35 px-2.5 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.16em] sm:left-3 sm:top-3">
                        {product.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-[0.55rem] font-semibold uppercase tracking-[0.18em] text-[#c4b8a4]">
                    {product.category}
                  </p>
                  <h3 className="mt-1 truncate text-sm font-medium sm:text-base">
                    {product.name}
                  </h3>
                  <div className="mt-2 text-sm">
                    <ProductPrice product={product} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-9 flex justify-center">
          <Link
            href="/collections/curated"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#c4b8a4]/50 px-7 text-[0.62rem] font-bold uppercase tracking-[0.18em] transition hover:border-[#F5F2EC] hover:bg-[#F5F2EC] hover:text-[#111111]"
          >
            View all curated pieces
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function CollectionPreviews() {
  const [previews, setPreviews] = useState<Record<ProductCollection, PreviewState>>({
    everyday: { products: [], error: "" },
    curated: { products: [], error: "" },
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadCollection(collection: ProductCollection) {
      try {
        const params = new URLSearchParams({
          collection,
          page: "1",
          limit: "4",
          sort: "featured",
        });
        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          products?: PreviewProduct[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.products)) {
          throw new Error(result.error || "This collection could not be loaded.");
        }
        setPreviews((current) => ({
          ...current,
          [collection]: { products: result.products!, error: "" },
        }));
      } catch (error) {
        if (controller.signal.aborted) return;
        setPreviews((current) => ({
          ...current,
          [collection]: {
            products: [],
            error: error instanceof Error ? error.message : "This collection could not be loaded.",
          },
        }));
      }
    }

    void loadCollection("everyday");
    void loadCollection("curated");
    return () => controller.abort();
  }, []);

  return (
    <>
      <EverydayPreview {...previews.everyday} />
      <CuratedPreview {...previews.curated} />
    </>
  );
}
