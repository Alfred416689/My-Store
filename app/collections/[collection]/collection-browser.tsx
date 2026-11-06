"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Collection = "everyday" | "curated";

type Product = {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  condition: string;
  sizes: string[];
  image: string;
  badge?: string;
  stock: number;
  featured?: boolean;
  description?: string;
};

type ProductDetails = Product & {
  gallery: string[];
  description: string;
};

type CartItem = {
  productId: number;
  name: string;
  price: number;
  image: string;
  size: string;
  quantity: number;
};

const info: Record<
  Collection,
  { heading: string; subtitle: string; description: string; eyebrow: string }
> = {
  everyday: {
    heading: "EVERYDAY FINDS",
    subtitle: "Great style. Better prices.",
    description:
      "Thoughtful thrift for your everyday rotation. Discover individual pieces at accessible prices, with style and character built in.",
    eyebrow: "THE DAILY EDIT / S2G",
  },
  curated: {
    heading: "THE CURATED COLLECTION",
    subtitle: "Rare finds. Distinctive style.",
    description:
      "A considered edit of distinctive second-hand fashion. Each piece is selected for its character, condition, and point of view.",
    eyebrow: "SELECTED WITH INTENT / S2G",
  },
};

function ProductImage({
  src,
  alt,
  sizes,
}: {
  src: string;
  alt: string;
  sizes: string;
}) {
  const [unavailable, setUnavailable] = useState(!src);
  if (unavailable) {
    return (
      <div
        role="img"
        aria-label={`${alt} image unavailable`}
        className="flex aspect-[4/5] items-center justify-center bg-[#292821] font-display text-3xl tracking-[0.12em] text-[#c4b8a4]"
      >
        S2G
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      quality={80}
      className="object-cover transition duration-500 group-hover:scale-[1.035]"
      onError={() => setUnavailable(true)}
    />
  );
}

function formatPrice(price: number) {
  return `₹${price.toLocaleString("en-IN")}`;
}

export default function CollectionBrowser({ collection }: { collection: Collection }) {
  const collectionInfo = info[collection];
  const isCurated = collection === "curated";
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("featured");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [loadMoreError, setLoadMoreError] = useState("");
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productDetails, setProductDetails] = useState<ProductDetails | null>(null);
  const [productDetailsError, setProductDetailsError] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");
  const [savingToCart, setSavingToCart] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setError("");
      setLoadMoreError("");
      setProducts([]);
      setNextPage(null);
      try {
        const params = new URLSearchParams({
          collection,
          page: "1",
          limit: "12",
          sort,
        });
        if (search.trim()) params.set("search", search.trim());
        if (category !== "All") params.set("category", category);
        const response = await fetch(`/api/products?${params}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          products?: Product[];
          categories?: string[];
          pagination?: { nextPage: number | null };
          error?: string;
        };
        if (
          !response.ok ||
          !Array.isArray(result.products) ||
          !Array.isArray(result.categories) ||
          !result.pagination
        ) {
          throw new Error(result.error || "This collection could not be loaded.");
        }
        setProducts(result.products);
        setCategories(result.categories);
        setNextPage(result.pagination.nextPage);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "This collection could not be loaded. Please try again.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    const timer = window.setTimeout(() => void loadProducts(), search ? 220 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, collection, reloadToken, search, sort]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadCart() {
      try {
        const response = await fetch("/api/cart", { signal: controller.signal });
        const result = (await response.json()) as { items?: CartItem[]; error?: string };
        if (!response.ok || !Array.isArray(result.items)) {
          throw new Error(result.error || "The shopping bag could not be loaded.");
        }
        setCart(result.items);
        setCartError("");
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setCartError(
          loadError instanceof Error
            ? loadError.message
            : "The shopping bag could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setCartLoading(false);
      }
    }
    void loadCart();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    const controller = new AbortController();
    async function loadDetails() {
      try {
        const response = await fetch(`/api/products/${selectedProduct!.id}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          product?: ProductDetails;
          error?: string;
        };
        if (!response.ok || !result.product) {
          throw new Error(result.error || "Product details could not be loaded.");
        }
        setProductDetails(result.product);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setProductDetailsError(
          loadError instanceof Error ? loadError.message : "Product details could not be loaded.",
        );
      }
    }
    void loadDetails();
    return () => controller.abort();
  }, [selectedProduct]);

  const productCount = useMemo(() => products.length, [products]);

  const loadMore = useCallback(async () => {
    if (nextPage === null || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError("");
    try {
      const params = new URLSearchParams({
        collection,
        page: String(nextPage),
        limit: "12",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());
      if (category !== "All") params.set("category", category);
      const response = await fetch(`/api/products?${params}`);
      const result = (await response.json()) as {
        products?: Product[];
        pagination?: { nextPage: number | null };
        error?: string;
      };
      if (!response.ok || !Array.isArray(result.products) || !result.pagination) {
        throw new Error(result.error || "More products could not be loaded.");
      }
      setProducts((current) => [...current, ...result.products!]);
      setNextPage(result.pagination.nextPage);
    } catch (loadError) {
      setLoadMoreError(
        loadError instanceof Error
          ? loadError.message
          : "More products could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  }, [category, collection, loadingMore, nextPage, search, sort]);

  const addToBag = async () => {
    if (!selectedProduct || !selectedSize || savingToCart || cartLoading) return;
    const quantity = cart
      .filter((item) => item.productId === selectedProduct.id)
      .reduce((total, item) => total + item.quantity, 0);
    if (quantity >= selectedProduct.stock) {
      setCartError("The available stock for this piece is already in your bag.");
      return;
    }
    const existing = cart.find(
      (item) => item.productId === selectedProduct.id && item.size === selectedSize,
    );
    const nextCart = existing
      ? cart.map((item) =>
          item.productId === selectedProduct.id && item.size === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      : [
          ...cart,
          {
            productId: selectedProduct.id,
            name: selectedProduct.name,
            price: selectedProduct.price,
            image: selectedProduct.image,
            size: selectedSize,
            quantity: 1,
          },
        ];

    setSavingToCart(true);
    setNotice("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: nextCart.map(({ productId, size, quantity: itemQuantity }) => ({
            productId,
            size,
            quantity: itemQuantity,
          })),
        }),
      });
      const result = (await response.json()) as {
        items?: CartItem[];
        error?: string;
      };
      if (!response.ok || !Array.isArray(result.items)) {
        throw new Error(result.error || "The shopping bag could not be saved.");
      }
      setCart(result.items);
      setCartError("");
      setNotice(`${selectedProduct.name} added to your bag.`);
    } catch (saveError) {
      setCartError(
        saveError instanceof Error ? saveError.message : "The shopping bag could not be saved.",
      );
    } finally {
      setSavingToCart(false);
    }
  };

  const shellClass = isCurated ? "bg-[#111111] text-[#F5F2EC]" : "bg-[#F5F2EC] text-[#171715]";
  const mutedTextClass = isCurated ? "text-[#D9D6CF]" : "text-[#5d5a52]";
  const controlClass = isCurated
    ? "border-white/15 bg-[#1a1a1a] text-[#F5F2EC]"
    : "border-[#171715]/20 bg-white/70 text-[#171715]";

  return (
    <MotionConfig reducedMotion="user">
      <main className={`min-h-screen overflow-hidden ${shellClass}`}>
        <header className={`border-b ${isCurated ? "border-white/10" : "border-[#171715]/10"}`}>
          <div className="track-limiter flex min-h-16 items-center justify-between gap-4 py-3">
            <Link href="/" className="font-display text-2xl tracking-[0.14em]" aria-label="S2G home">
              S2G
            </Link>
            <Link
              href="/#top"
              className={`min-h-11 inline-flex items-center gap-2 text-[0.62rem] font-bold uppercase tracking-[0.15em] ${mutedTextClass}`}
            >
              <span aria-hidden="true">←</span> Back to S2G
            </Link>
          </div>
        </header>

        <section className={`relative overflow-hidden border-b ${isCurated ? "border-white/10 bg-[#171715]" : "border-[#171715]/10 bg-[#ebe7df]"}`}>
          {isCurated && (
            <div className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full bg-[#786a53]/10 blur-3xl" />
          )}
          <div className="track-limiter relative py-14 sm:py-20">
            <p className={`section-label ${isCurated ? "text-[#c4b8a4]" : "!text-[#5d5a52]"}`}>
              {collectionInfo.eyebrow}
            </p>
            <h1 className="mt-4 max-w-5xl font-display text-[clamp(3.2rem,10vw,7.5rem)] leading-[0.85] tracking-[0.04em]">
              {collectionInfo.heading}
            </h1>
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className={`text-lg font-medium ${mutedTextClass}`}>
                  {collectionInfo.subtitle}
                </p>
                <p className={`mt-3 max-w-2xl text-sm leading-6 ${mutedTextClass}`}>
                  {collectionInfo.description}
                </p>
              </div>
              <p className={`text-[0.62rem] font-semibold uppercase tracking-[0.17em] ${mutedTextClass}`}>
                {loading ? "Finding your next piece" : `${productCount} pieces shown`}
              </p>
            </div>
          </div>
        </section>

        <section className="track-limiter py-8 sm:py-12">
          <div className="grid gap-3 sm:grid-cols-[1.5fr_0.75fr_0.75fr]">
            <label className="block">
              <span className="sr-only">Search this collection</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search pieces"
                className={`min-h-12 w-full rounded-full border px-5 text-sm outline-none transition focus-visible:border-[#a98d66] ${controlClass}`}
              />
            </label>
            <label className="block">
              <span className="sr-only">Filter by category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className={`min-h-12 w-full rounded-full border px-5 text-sm outline-none [color-scheme:dark] ${controlClass}`}
              >
                <option value="All">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Sort products</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className={`min-h-12 w-full rounded-full border px-5 text-sm outline-none [color-scheme:dark] ${controlClass}`}
              >
                <option value="featured">Featured</option>
                <option value="newest">Newest arrivals</option>
                <option value="low">Price: Low to high</option>
                <option value="high">Price: High to low</option>
              </select>
            </label>
          </div>
        </section>

        <section className="track-limiter pb-16 sm:pb-24" aria-label={`${collectionInfo.heading} products`}>
          {loading ? (
            <div role="status" aria-label="Loading products" className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="animate-pulse">
                  <div className={`aspect-[4/5] ${isCurated ? "bg-white/5" : "bg-[#171715]/10"}`} />
                  <div className={`mt-3 h-3 w-1/3 rounded ${isCurated ? "bg-white/10" : "bg-[#171715]/10"}`} />
                  <div className={`mt-2 h-5 w-2/3 rounded ${isCurated ? "bg-white/10" : "bg-[#171715]/10"}`} />
                </div>
              ))}
              <span className="sr-only">Loading collection products</span>
            </div>
          ) : error ? (
            <div role="alert" className={`rounded-2xl border p-8 text-center ${isCurated ? "border-[#8c3f38]/40 bg-[#8c3f38]/10 text-[#F5D6D1]" : "border-[#8c3f38]/30 bg-[#8c3f38]/5 text-[#6d3a3a]"}`}>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="mt-5 min-h-11 rounded-full border border-current px-5 text-[0.62rem] font-bold uppercase tracking-[0.16em]"
              >
                Try again
              </button>
            </div>
          ) : products.length === 0 ? (
            <div className={`rounded-2xl border border-dashed p-12 text-center ${isCurated ? "border-white/20" : "border-[#171715]/20"}`}>
              <p className="font-display text-3xl tracking-[0.06em]">NO PIECES FOUND</p>
              <p className={`mt-3 text-sm ${mutedTextClass}`}>
                Try a different search or category, or check back for new arrivals.
              </p>
            </div>
          ) : (
            <motion.div layout className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-5 sm:gap-y-10 lg:grid-cols-4">
              {products.map((product, index) => (
                <motion.article
                  key={product.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.18) }}
                  className="group min-w-0"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setProductDetails(null);
                      setProductDetailsError("");
                      setSelectedSize("");
                      setSelectedProduct(product);
                    }}
                    aria-label={`Quick view ${product.name}`}
                    className="relative block aspect-[4/5] w-full overflow-hidden bg-[#292821] text-left"
                  >
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      sizes="(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 23vw"
                    />
                    {product.badge && (
                      <span className={`absolute left-2 top-2 px-2.5 py-1 text-[0.52rem] font-bold uppercase tracking-[0.14em] sm:left-3 sm:top-3 ${isCurated ? "border border-white/25 bg-black/45 text-white" : "bg-[#F5F2EC]/90 text-[#171715]"}`}>
                        {product.badge}
                      </span>
                    )}
                    {product.compareAtPrice && product.compareAtPrice > product.price && (
                      <span className="absolute bottom-2 left-2 bg-[#6d3a3a] px-2.5 py-1 text-[0.52rem] font-bold uppercase tracking-[0.14em] text-white sm:bottom-3 sm:left-3">
                        Reduced
                      </span>
                    )}
                    {product.featured && (
                      <span className="absolute right-2 top-2 bg-[#a98d66] px-2.5 py-1 text-[0.52rem] font-bold uppercase tracking-[0.14em] text-[#111111] sm:right-3 sm:top-3">
                        Selected
                      </span>
                    )}
                  </button>
                  <div className="pt-3 sm:pt-4">
                    <p className={`truncate text-[0.55rem] font-semibold uppercase tracking-[0.18em] ${mutedTextClass}`}>
                      {product.category}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setProductDetails(null);
                        setProductDetailsError("");
                        setSelectedSize("");
                        setSelectedProduct(product);
                      }}
                      className="mt-1 block max-w-full truncate text-left text-sm font-semibold sm:text-base"
                    >
                      {product.name}
                    </button>
                    <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-sm font-bold">{formatPrice(product.price)}</span>
                      {product.compareAtPrice && product.compareAtPrice > product.price && (
                        <span className={`text-xs line-through ${mutedTextClass}`}>
                          {formatPrice(product.compareAtPrice)}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
            </motion.div>
          )}

          {loadMoreError && (
            <p role="alert" className="mt-6 text-center text-sm text-[#b77d73]">{loadMoreError}</p>
          )}
          {nextPage !== null && !loading && !error && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className={`min-h-12 rounded-full border px-7 text-[0.62rem] font-bold uppercase tracking-[0.18em] transition disabled:opacity-60 ${isCurated ? "border-white/25 hover:bg-white hover:text-[#111111]" : "border-[#171715]/30 hover:bg-[#171715] hover:text-[#F5F2EC]"}`}
              >
                {loadingMore ? "Loading more…" : "Load more pieces"}
              </button>
            </div>
          )}
        </section>

        <footer className={`border-t py-7 ${isCurated ? "border-white/10" : "border-[#171715]/10"}`}>
          <div className="track-limiter flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-display tracking-[0.14em]">S2G / CURATED THRIFT</span>
            <Link href="/" className={`min-h-11 inline-flex items-center ${mutedTextClass}`}>
              Explore both collections
            </Link>
          </div>
        </footer>

        {cartError && (
          <div role="alert" className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-lg rounded-xl border border-[#8c3f38]/50 bg-[#291b1a] px-4 py-3 text-sm text-[#F5D6D1] shadow-xl">
            {cartError}
          </div>
        )}
        {notice && (
          <div role="status" className="fixed bottom-4 left-4 right-4 z-[70] mx-auto max-w-lg rounded-xl border border-emerald-500/30 bg-[#17241d] px-4 py-3 text-sm text-emerald-100 shadow-xl">
            {notice}
            <button type="button" onClick={() => setNotice("")} className="ml-3 underline">Dismiss</button>
          </div>
        )}

        <AnimatePresence>
          {selectedProduct && (
            <motion.div
              className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedProduct(null);
              }}
            >
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-labelledby="product-dialog-title"
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                className={`relative grid max-h-[92dvh] w-full max-w-4xl grid-cols-1 overflow-y-auto rounded-t-2xl sm:grid-cols-2 sm:rounded-2xl ${isCurated ? "bg-[#F5F2EC] text-[#111111]" : "bg-white text-[#171715]"}`}
              >
                <button
                  type="button"
                  aria-label="Close product details"
                  onClick={() => setSelectedProduct(null)}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-lg text-white"
                >
                  ×
                </button>
                <div className="relative min-h-[300px] bg-[#292821] sm:min-h-[560px]">
                  <Image
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-8">
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#6b665d]">
                    {selectedProduct.category} · {selectedProduct.condition}
                  </p>
                  <h2 id="product-dialog-title" className="mt-3 font-display text-3xl tracking-[0.05em] sm:text-4xl">
                    {selectedProduct.name}
                  </h2>
                  <div className="mt-4 flex items-baseline gap-3">
                    <span className="font-display text-2xl">{formatPrice(selectedProduct.price)}</span>
                    {selectedProduct.compareAtPrice && selectedProduct.compareAtPrice > selectedProduct.price && (
                      <span className="text-sm text-[#6b665d] line-through">
                        {formatPrice(selectedProduct.compareAtPrice)}
                      </span>
                    )}
                  </div>
                  {productDetailsError ? (
                    <p role="alert" className="mt-5 text-sm text-[#6d3a3a]">{productDetailsError}</p>
                  ) : (
                    <p className="mt-5 text-sm leading-6 text-[#393832]">
                      {productDetails?.description ?? "Loading product details…"}
                    </p>
                  )}
                  <div className="mt-6">
                    <p className="text-[0.58rem] font-bold uppercase tracking-[0.18em]">Choose a size</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedProduct.sizes.map((size) => (
                        <button
                          key={size}
                          type="button"
                          aria-pressed={selectedSize === size}
                          onClick={() => setSelectedSize(size)}
                          className={`min-h-11 min-w-11 rounded-full border px-3 text-sm ${selectedSize === size ? "border-[#111111] bg-[#111111] text-white" : "border-[#111111]/20"}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedProduct.stock < 1 && (
                    <p className="mt-4 text-sm text-[#6d3a3a]">This piece is currently sold out.</p>
                  )}
                  <div className="mt-7 flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => void addToBag()}
                      disabled={!selectedSize || selectedProduct.stock < 1 || cartLoading || savingToCart}
                      className="min-h-12 rounded-full bg-[#111111] px-5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-[#F5F2EC] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingToCart ? "Adding to bag…" : "Add to bag"}
                    </button>
                    <p className="text-center text-xs text-[#6b665d]">
                      {cartLoading
                        ? "Checking your shopping bag…"
                        : `Shopping bag · ${cart.reduce((total, item) => total + item.quantity, 0)} pieces`}
                    </p>
                  </div>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </MotionConfig>
  );
}
