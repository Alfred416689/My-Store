"use client";

import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import Image from "next/image";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import CollectionPreviews from "@/app/components/collection-previews";

type Product = {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  collections?: ("everyday" | "curated")[];
  featured?: boolean;
  condition: string;
  sizes: string[];
  image: string;
  gallery?: string[];
  badge?: string;
  stock: number;
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

function getProductSizes(product: Product) {
  return Array.isArray(product.sizes) &&
    product.sizes.every((size) => typeof size === "string")
    ? product.sizes
    : [];
}

function getProductGallery(product: Product) {
  const gallery = Array.isArray(product.gallery)
    ? product.gallery.filter((image) => typeof image === "string" && image.length > 0)
    : [];
  return gallery.length > 0
    ? gallery
    : typeof product.image === "string" && product.image.length > 0
      ? [product.image]
      : [];
}

function ProductImage({
  src,
  alt,
  className,
  sizes = "(max-width: 640px) 100vw, 48vw",
}: {
  src: string;
  alt: string;
  className: string;
  sizes?: string;
}) {
  const [unavailable, setUnavailable] = useState(!src);

  if (unavailable) {
    return (
      <div
        role="img"
        aria-label={`${alt} image unavailable`}
        className={`flex items-center justify-center bg-[#D9D6CF] font-display tracking-[0.1em] text-[#77746d] ${className}`}
      >
        S2G
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={800}
      height={1000}
      sizes={sizes}
      quality={80}
      className={className}
      onError={() => setUnavailable(true)}
    />
  );
}

type CustomerRequest = {
  id: string;
  name: string;
  category: string;
  brand: string;
  size: string;
  colour: string;
  budget: number;
  details: string;
  image: string;
  requestedAt: string;
};

const navItems = [
  { label: "Shop All", href: "#collection" },
  { label: "New Drops", href: "#collection" },
  { label: "Tops", href: "#collection" },
  { label: "Bottoms", href: "#collection" },
  { label: "Customer Demand", href: "/customer-demand" },
  { label: "About S2G", href: "#story" },
];

const announcementMessages = [
  "Curated thrift. Better finds.",
  "Curated finds. New stories.",
  "New drops. Limited pieces.",
];

const categories = [
  { title: "Graphic Tees", image: "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=900&q=80" },
  { title: "Vintage Shirts", image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80" },
  { title: "Denim", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80" },
  { title: "Jackets", image: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80" },
  { title: "Streetwear Finds", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=900&q=80" },
];

function getProductsUrl(
  page: number,
  search: string,
  category: string,
  sortBy: string,
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: "12",
    sort: sortBy,
  });
  const normalizedSearch = search.trim();
  if (normalizedSearch) params.set("search", normalizedSearch);
  if (category !== "All") params.set("category", category);
  return `/api/products?${params}`;
}

export default function Home() {
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] =
    useState<ProductDetails | null>(null);
  const [productDetailsLoading, setProductDetailsLoading] = useState(false);
  const [productDetailsError, setProductDetailsError] = useState("");
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [sortBy, setSortBy] = useState("featured");
  const [products, setProducts] = useState<Product[]>([]);
  const [customerRequests, setCustomerRequests] = useState<CustomerRequest[]>([]);
  const [customerRequestsLoading, setCustomerRequestsLoading] = useState(true);
  const [customerRequestsError, setCustomerRequestsError] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [nextProductPage, setNextProductPage] = useState<number | null>(null);
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartLoading, setCartLoading] = useState(true);
  const [cartError, setCartError] = useState("");
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const cartWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const productSuggestions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    return [...products]
      .sort((left, right) => {
        const leftStartsWithQuery = left.name.toLowerCase().startsWith(query);
        const rightStartsWithQuery = right.name.toLowerCase().startsWith(query);
        return (
          Number(rightStartsWithQuery) - Number(leftStartsWithQuery) ||
          left.name.localeCompare(right.name)
        );
      })
      .slice(0, 5);
  }, [products, search]);
  const showSuggestions = searchFocused && search.trim().length > 0;
  const suggestionsListVisible =
    showSuggestions &&
    !catalogLoading &&
    !catalogError &&
    productSuggestions.length > 0;

  function chooseSuggestion(product: Product) {
    setSearch(product.name);
    setSearchFocused(false);
    setActiveSuggestionIndex(-1);
  }

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setCatalogLoading(true);
      setCatalogError("");
      setLoadMoreError("");
      setProducts([]);
      setNextProductPage(null);
      setLoadingMoreProducts(false);

      try {
        const response = await fetch(
          getProductsUrl(1, search, selectedCategory, sortBy),
          { signal: controller.signal },
        );
        const result = (await response.json()) as {
          products?: Product[];
          pagination?: { nextPage: number | null };
          error?: string;
        };
        if (
          !response.ok ||
          !Array.isArray(result.products) ||
          !result.pagination
        ) {
          throw new Error(result.error || "The product catalog could not be loaded.");
        }
        setProducts(result.products);
        setNextProductPage(result.pagination.nextPage);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCatalogError(
          error instanceof Error
            ? error.message
            : "The product catalog could not be loaded. Check the MongoDB connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) setCatalogLoading(false);
      }
    }

    const timer = window.setTimeout(() => void loadProducts(), search ? 220 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
      loadMoreControllerRef.current?.abort();
    };
  }, [search, selectedCategory, sortBy]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCustomerRequests() {
      try {
        const response = await fetch("/api/customer-requests?limit=3", {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          requests?: CustomerRequest[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.requests)) {
          throw new Error(result.error || "Customer requests could not be loaded.");
        }
        setCustomerRequests(result.requests);
        setCustomerRequestsError("");
      } catch (error) {
        if (controller.signal.aborted) return;
        setCustomerRequestsError(
          error instanceof Error
            ? error.message
            : "Approved customer requests could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setCustomerRequestsLoading(false);
      }
    }

    void loadCustomerRequests();
    return () => controller.abort();
  }, []);

  const selectedProductId = selectedProduct?.id;
  const visibleProductDetails =
    selectedProductDetails?.id === selectedProductId
      ? selectedProductDetails
      : null;

  useEffect(() => {
    if (selectedProductId === undefined) return;

    const controller = new AbortController();

    async function loadProductDetails() {
      try {
        const response = await fetch(`/api/products/${selectedProductId}`, {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          product?: ProductDetails;
          error?: string;
        };
        if (!response.ok || !result.product) {
          throw new Error(result.error || "Product details could not be loaded.");
        }
        setSelectedProductDetails(result.product);
      } catch (error) {
        if (controller.signal.aborted) return;
        setProductDetailsError(
          error instanceof Error
            ? error.message
            : "Product details could not be loaded.",
        );
      } finally {
        if (!controller.signal.aborted) setProductDetailsLoading(false);
      }
    }

    void loadProductDetails();
    return () => controller.abort();
  }, [selectedProductId]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCart() {
      try {
        const response = await fetch("/api/cart", { signal: controller.signal });
        const result = (await response.json()) as { items?: CartItem[]; error?: string };
        if (!response.ok || !Array.isArray(result.items)) {
          throw new Error(result.error || "The shopping bag could not be loaded.");
        }
        cartRef.current = result.items;
        setCart(result.items);
      } catch (error) {
        if (controller.signal.aborted) return;
        setCartError(
          error instanceof Error
            ? error.message
            : "Your saved shopping bag could not be loaded. Check the MongoDB connection.",
        );
      } finally {
        if (!controller.signal.aborted) setCartLoading(false);
      }
    }

    void loadCart();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnnouncementIndex((index) => (index + 1) % announcementMessages.length);
    }, 2600);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedProduct(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedProduct]);

  const bagCount = useMemo(
    () => cart.reduce((total, item) => total + item.quantity, 0),
    [cart],
  );

  const cartSubtotal = useMemo(
    () => cart.reduce((total, item) => total + item.price * item.quantity, 0),
    [cart],
  );

  const loadMoreProducts = async () => {
    if (nextProductPage === null || loadingMoreProducts) return;

    const controller = new AbortController();
    loadMoreControllerRef.current = controller;
    setLoadingMoreProducts(true);
    setLoadMoreError("");

    try {
      const response = await fetch(
        getProductsUrl(nextProductPage, search, selectedCategory, sortBy),
        { signal: controller.signal },
      );
      const result = (await response.json()) as {
        products?: Product[];
        pagination?: { nextPage: number | null };
        error?: string;
      };
      const nextProducts = result.products;
      if (!response.ok || !Array.isArray(nextProducts) || !result.pagination) {
        throw new Error(result.error || "More products could not be loaded.");
      }
      setProducts((current) => [...current, ...nextProducts]);
      setNextProductPage(result.pagination.nextPage);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLoadMoreError(
        error instanceof Error ? error.message : "More products could not be loaded.",
      );
    } finally {
      if (!controller.signal.aborted) setLoadingMoreProducts(false);
    }
  };

  const saveCart = (nextCart: CartItem[]) => {
    const save = async () => {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: nextCart.map(({ productId, size, quantity }) => ({
            productId,
            size,
            quantity,
          })),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "The shopping bag could not be saved.");
      }
      setCartError("");
    };

    const pendingSave = cartWriteQueueRef.current.then(save, save);
    cartWriteQueueRef.current = pendingSave.then(
      () => undefined,
      () => undefined,
    );
    void pendingSave.catch((error: unknown) => {
      setCartError(
        error instanceof Error ? error.message : "The shopping bag could not be saved.",
      );
    });
  };

  const commitCart = (nextCart: CartItem[]) => {
    cartRef.current = nextCart;
    setCart(nextCart);
    saveCart(nextCart);
  };

  const addToCart = (product: Product, size: string) => {
    if (cartLoading) return;

    const currentCart = cartRef.current;
    const productQuantity = currentCart
      .filter((item) => item.productId === product.id)
      .reduce((total, item) => total + item.quantity, 0);
    if (productQuantity >= product.stock) {
      setCartError("The available stock for this piece is already in your bag.");
      setCartOpen(true);
      return;
    }

    const existingItem = currentCart.find(
      (item) => item.productId === product.id && item.size === size,
    );
    const nextCart = existingItem
      ? currentCart.map((item) =>
          item.productId === product.id && item.size === size
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      : [
          ...currentCart,
          {
            productId: product.id,
            name: product.name,
            price: product.price,
            image: product.image,
            size,
            quantity: 1,
          },
        ];

    commitCart(nextCart);
    setCartOpen(true);
  };

  const updateCartQuantity = (productId: number, size: string, change: number) => {
    const currentCart = cartRef.current;
    const product = products.find((item) => item.id === productId);
    const currentProductQuantity = currentCart
      .filter((item) => item.productId === productId)
      .reduce((total, item) => total + item.quantity, 0);
    if (change > 0 && product && currentProductQuantity >= product.stock) {
      setCartError("The available stock for this piece is already in your bag.");
      return;
    }

    const nextCart = currentCart.flatMap((item) => {
      if (item.productId !== productId || item.size !== size) return [item];
      const nextQuantity = item.quantity + change;
      return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity }] : [];
    });
    commitCart(nextCart);
  };

  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNewsletterSubmitting(true);
    setNewsletterMessage("");

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newsletterEmail }),
      });
      const result = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Your email could not be saved.");
      }
      setNewsletterMessage(result.message || "Thanks for joining the S2G list.");
      setNewsletterEmail("");
    } catch (error) {
      setNewsletterMessage(
        error instanceof Error ? error.message : "Your email could not be saved. Try again.",
      );
    } finally {
      setNewsletterSubmitting(false);
    }
  };

  const openProduct = (product: Product) => {
    setSelectedProductDetails(null);
    setProductDetailsError("");
    setProductDetailsLoading(Number.isSafeInteger(product.id) && product.id > 0);
    setSelectedProduct(product);
    setSelectedSize(getProductSizes(product)[0] ?? null);
    setSelectedImageIndex(0);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#111111] text-[#F5F2EC]">
      <div className="bg-[#F5F2EC] text-[#111111]">
        <div className="track-limiter relative flex h-11 items-center justify-center overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={announcementIndex}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="flex items-center justify-center gap-4 text-[0.62rem] font-semibold uppercase tracking-[0.28em]"
            >
              {announcementMessages[announcementIndex]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <header
        className={`sticky top-0 z-50 border-b border-white/10 transition-colors duration-300 ${
          scrolled ? "bg-[#111111]/95" : "bg-transparent"
        }`}
      >
        <div className="track-limiter flex h-16 items-center justify-between gap-3 sm:h-20 sm:gap-6">
          <a href="#top" className="flex items-center gap-3 text-left" aria-label="S2G home">
            <div className="flex flex-col leading-none">
              <span className="font-display text-3xl tracking-[0.14em] text-[#F5F2EC]">
                S2G
              </span>
              <span className="mt-1 text-[0.52rem] font-semibold uppercase tracking-[0.42em] text-[#D9D6CF]">
                Curated thrift
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#F5F2EC] md:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="nav-link">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2 text-[#F5F2EC] sm:gap-4">
            <button
              type="button"
              aria-label="Search products"
              onClick={() => {
                document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
                window.setTimeout(() => searchInputRef.current?.focus(), 350);
              }}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-xl transition hover:bg-white/10"
            >
              ⌕
            </button>
            <button
              type="button"
              aria-label="Open shopping bag"
              className="relative flex h-10 items-center gap-2 rounded-full px-1 text-xl transition hover:opacity-80"
              onClick={() => setCartOpen(true)}
            >
              <span>👜</span>
              <span
                key={bagCount}
                className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F5F2EC] px-1 text-[0.6rem] font-bold text-[#111111]"
              >
                {bagCount}
              </span>
            </button>
            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-lg md:hidden"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-white/10 bg-[#111111] md:hidden"
            >
              <div className="track-limiter flex flex-col gap-5 py-5 text-[0.7rem] font-semibold uppercase tracking-[0.2em]">
                {navItems.map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="nav-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden border-b border-white/10">
          <div className="absolute inset-0">
            <Image
              src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1600&q=80"
              alt="Editorial streetwear fashion portrait"
              fill
              preload
              sizes="100vw"
              quality={80}
              className="h-full w-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-[#111111]/45" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(97,94,62,0.35),_transparent_38%)]" />
          </div>

          <div className="track-limiter relative grid min-h-[640px] items-end gap-10 py-12 sm:min-h-[700px] sm:py-16 md:min-h-[760px] md:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:pb-20">
            <motion.div
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="max-w-3xl pb-6 sm:pb-10"
            >
              <p className="mb-6 section-label text-[#D9D6CF]">Issue 06 · S2G</p>
              <h1 className="font-display text-[clamp(3.25rem,13.8vw,4.3rem)] leading-[0.82] tracking-[0.035em] text-[#F5F2EC] md:text-[7rem] md:leading-[0.74] md:tracking-[0.05em] lg:text-[8.3rem]">
                STYLE THAT
                <span className="block text-[#D9D6CF]">COMES AROUND.</span>
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#F5F2EC]/80 md:text-lg">
                Curated thrift. Distinctive fits.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#collection"
                  className="inline-flex items-center justify-center rounded-full bg-[#F5F2EC] px-7 py-3 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#111111] transition hover:-translate-y-0.5 hover:bg-[#D9D6CF]"
                >
                  Explore the drop
                </a>
                <a
                  href="#story"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 bg-transparent px-7 py-3 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#F5F2EC] transition hover:-translate-y-0.5 hover:border-[#F5F2EC]/70"
                >
                  Our story
                </a>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.12, ease: "easeOut" }}
              className="flex items-end justify-end pb-8 text-right lg:pb-20"
            >
              <div className="flex items-end gap-6 text-[#F5F2EC]/80">
                <div className="hidden h-32 w-px bg-[#F5F2EC]/60 lg:block" />
                <div>
                  <p className="mb-2 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-[#D9D6CF]">
                    Lookbook
                  </p>
                  <p className="font-display text-2xl tracking-[0.14em]">S2G / 2025</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <CollectionPreviews />

        <section id="collection" className="track-limiter py-20 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between"
          >
            <div>
              <p className="section-label">Freshly curated</p>
              <h2 className="mt-3 font-display text-4xl tracking-[0.08em] text-[#F5F2EC] md:text-6xl">
                THE LATEST FINDS.
              </h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-[#D9D6CF] md:text-right">
              Browse the pieces currently listed in the S2G catalog.
            </p>
          </motion.div>

          <div className="mb-8 grid gap-3 md:grid-cols-[1.2fr_0.6fr_0.6fr]">
            <div className={`relative ${showSuggestions ? "z-20" : ""}`}>
              <div className="relative rounded-full border border-white/10 bg-[#1A1A1A] px-4 py-3">
                <span aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-[#D9D6CF]">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setProducts([]);
                    setCatalogLoading(true);
                    setSearchFocused(true);
                    setActiveSuggestionIndex(-1);
                    setSearch(event.target.value);
                  }}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown" && productSuggestions.length > 0) {
                      event.preventDefault();
                      setActiveSuggestionIndex((index) =>
                        (index + 1) % productSuggestions.length,
                      );
                    } else if (event.key === "ArrowUp" && productSuggestions.length > 0) {
                      event.preventDefault();
                      setActiveSuggestionIndex((index) =>
                        index <= 0 ? productSuggestions.length - 1 : index - 1,
                      );
                    } else if (
                      event.key === "Enter" &&
                      activeSuggestionIndex >= 0 &&
                      productSuggestions[activeSuggestionIndex]
                    ) {
                      event.preventDefault();
                      chooseSuggestion(productSuggestions[activeSuggestionIndex]);
                    } else if (event.key === "Escape") {
                      setSearchFocused(false);
                      setActiveSuggestionIndex(-1);
                    }
                  }}
                  placeholder="Search pieces"
                  ref={searchInputRef}
                  role="combobox"
                  aria-label="Search products"
                  aria-autocomplete="list"
                  aria-expanded={suggestionsListVisible}
                  aria-controls={suggestionsListVisible ? "product-search-suggestions" : undefined}
                  aria-activedescendant={
                    suggestionsListVisible && activeSuggestionIndex >= 0
                      ? `product-search-suggestion-${productSuggestions[activeSuggestionIndex].id}`
                      : undefined
                  }
                  className="min-h-6 w-full border-0 bg-transparent pl-8 text-sm text-[#F5F2EC] placeholder:text-[#D9D6CF]/70 outline-none"
                />
              </div>
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-white/10 bg-[#171717] p-2 text-[#F5F2EC] shadow-xl">
                  {catalogLoading ? (
                    <p role="status" className="px-3 py-3 text-sm text-[#D9D6CF]">
                      Searching products…
                    </p>
                  ) : catalogError ? (
                    <p role="status" className="px-3 py-3 text-sm text-[#D9D6CF]">
                      Suggestions are unavailable. See the catalog message below.
                    </p>
                  ) : productSuggestions.length > 0 ? (
                    <div id="product-search-suggestions" role="listbox" aria-label="Product suggestions">
                      {productSuggestions.map((product, index) => (
                        <button
                          key={product.id}
                          id={`product-search-suggestion-${product.id}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeSuggestionIndex}
                          tabIndex={-1}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseSuggestion(product)}
                          className={`flex w-full items-center justify-between gap-4 rounded-xl px-3 py-3 text-left transition ${
                            index === activeSuggestionIndex
                              ? "bg-white/15"
                              : "hover:bg-white/10"
                          }`}
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{product.name}</span>
                            <span className="mt-1 block truncate text-xs text-[#D9D6CF]">{product.category}</span>
                          </span>
                          <span className="shrink-0 text-xs text-[#D9D6CF]">
                            ₹{product.price.toLocaleString("en-IN")}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p role="status" className="px-3 py-3 text-sm text-[#D9D6CF]">
                      No matching products found.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="relative overflow-hidden rounded-full border border-white/10 bg-[#1A1A1A] px-4 py-3">
              <select
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value)}
                className="w-full appearance-none bg-transparent text-sm text-[#F5F2EC] outline-none [color-scheme:dark]"
                aria-label="Filter products by category"
              >
                <option className="bg-[#1A1A1A] text-[#F5F2EC]" value="All">All categories</option>
                {categories.map((category) => (
                  <option className="bg-[#1A1A1A] text-[#F5F2EC]" key={category.title} value={category.title}>
                    {category.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative overflow-hidden rounded-full border border-white/10 bg-[#1A1A1A] px-4 py-3">
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="w-full appearance-none bg-transparent text-sm text-[#F5F2EC] outline-none [color-scheme:dark]"
                aria-label="Sort products"
              >
                <option className="bg-[#1A1A1A] text-[#F5F2EC]" value="featured">Featured</option>
                <option className="bg-[#1A1A1A] text-[#F5F2EC]" value="low">Price: Low to high</option>
                <option className="bg-[#1A1A1A] text-[#F5F2EC]" value="high">Price: High to low</option>
                <option className="bg-[#1A1A1A] text-[#F5F2EC]" value="name">Name</option>
              </select>
            </div>
          </div>

          {catalogLoading ? (
            <div
              role="status"
              aria-label="Loading products"
              className="grid gap-6 md:grid-cols-2 xl:grid-cols-3"
            >
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#171717]"
                >
                  <div className="aspect-[4/5] animate-pulse bg-white/5" />
                  <div className="space-y-4 p-5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
                    <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
                    <div className="h-10 animate-pulse rounded-full bg-white/5" />
                  </div>
                </div>
              ))}
              <span className="sr-only">Loading the latest finds…</span>
            </div>
          ) : catalogError ? (
            <div role="alert" className="rounded-[2rem] border border-[#8c3f38]/40 bg-[#8c3f38]/10 p-10 text-center text-sm text-[#F5D6D1]">
              {catalogError}
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-[#171717] p-10 text-center">
              <p className="font-display text-3xl tracking-[0.08em] text-[#F5F2EC]">No matches found.</p>
              <p className="mt-3 text-sm text-[#D9D6CF]">
                Try a different keyword or browse another category.
              </p>
            </div>
          ) : (
            <motion.div layout className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product, index) => {
                const sizes = getProductSizes(product);
                const firstSize = sizes[0];

                return (
                <motion.article
                  key={product.id ?? `${product.name}-${index}`}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.42, delay: index * 0.05, ease: "easeOut" }}
                  whileHover={{ y: -8 }}
                  className="group overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#171717]"
                >
                  <div className="relative overflow-hidden">
                    <ProductImage
                      src={product.image}
                      alt={product.name}
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                    {product.badge ? (
                      <span className="absolute left-4 top-4 rounded-full border border-[#F5F2EC]/30 bg-[#111111]/60 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.22em] text-[#F5F2EC]">
                        {product.badge}
                      </span>
                    ) : null}
                  </div>

                  <div className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.58rem] font-semibold uppercase tracking-[0.26em] text-[#D9D6CF]">
                          {product.category}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-[#F5F2EC]">{product.name}</h3>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl tracking-[0.08em] text-[#F5F2EC]">
                          ₹{product.price.toLocaleString("en-IN")}
                        </div>
                        {product.compareAtPrice !== undefined &&
                          product.compareAtPrice > product.price && (
                            <span className="text-xs text-[#D9D6CF]/60 line-through">
                              ₹{product.compareAtPrice.toLocaleString("en-IN")}
                            </span>
                          )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-[#D9D6CF]">
                      <span>Sizes: {sizes.length > 0 ? sizes.join(" / ") : "Not specified"}</span>
                      <span>{product.condition}</span>
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => openProduct(product)}
                        className="min-h-11 flex-1 rounded-full border border-white/15 px-4 py-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#F5F2EC] transition hover:border-[#F5F2EC]"
                      >
                        Quick view
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (firstSize) addToCart(product, firstSize);
                        }}
                        disabled={cartLoading || product.stock < 1 || !firstSize}
                        className="min-h-11 flex-1 rounded-full bg-[#F5F2EC] px-4 py-2.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-[#111111] transition hover:bg-[#D9D6CF] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add to bag
                      </button>
                    </div>
                  </div>
                </motion.article>
                );
              })}
            </motion.div>
          )}

          {loadMoreError && (
            <p role="alert" className="mt-6 text-center text-sm text-[#F5D6D1]">
              {loadMoreError}
            </p>
          )}
          {nextProductPage !== null && !catalogLoading && !catalogError && (
            <div className="mt-10 flex justify-center">
              <button
                type="button"
                onClick={() => void loadMoreProducts()}
                disabled={loadingMoreProducts}
                className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/20 px-7 text-[0.65rem] font-bold uppercase tracking-[0.2em] transition hover:border-white hover:bg-white hover:text-[#111111] disabled:cursor-wait disabled:opacity-60"
              >
                {loadingMoreProducts ? "Loading more…" : "Load more pieces"}
              </button>
            </div>
          )}
        </section>

        <section id="customer-demand" className="border-y border-white/10 bg-[#171717]">
          <div className="track-limiter py-16 md:py-20">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="section-label">Community wishlist</p>
                <h2 className="mt-3 font-display text-4xl tracking-[0.08em] md:text-6xl">
                  CUSTOMER DEMAND
                </h2>
              </div>
              <a
                href="/customer-demand"
                className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 text-[0.62rem] font-bold uppercase tracking-[0.16em] transition hover:bg-white hover:text-[#111111]"
              >
                Browse requests <span className="ml-2" aria-hidden="true">↗</span>
              </a>
            </div>

            {customerRequestsLoading ? (
              <div
                role="status"
                aria-label="Loading community requests"
                className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
              >
                {Array.from({ length: 3 }, (_, index) => (
                  <div
                    key={index}
                    className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]"
                  >
                    <div className="aspect-[4/3] animate-pulse bg-white/5" />
                    <div className="space-y-3 p-5">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                ))}
              </div>
            ) : customerRequestsError ? (
              <div
                role="alert"
                className="rounded-2xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 px-6 py-8 text-center text-sm text-[#F5D6D1]"
              >
                {customerRequestsError}
              </div>
            ) : customerRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
                <p className="text-sm leading-6 text-[#D9D6CF]">
                  Approved community requests will appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {customerRequests.slice(0, 3).map((request) => (
                  <a
                    key={request.id}
                    href="/customer-demand"
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-[#111111] transition hover:-translate-y-1 hover:border-white/25"
                  >
                    <div className="relative aspect-[4/3] bg-[#262622]">
                      {request.image ? (
                        <Image
                          src={request.image}
                          alt={`Reference for ${request.name}`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition duration-500 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-display text-5xl tracking-[0.1em] text-white/40">
                          S2G
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#D9D6CF]">
                            {request.category}
                          </p>
                          <h3 className="mt-2 font-semibold text-[#F5F2EC]">{request.name}</h3>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-[#F5F2EC]">
                          ₹{request.budget.toLocaleString("en-IN")}
                        </span>
                      </div>
                      <p className="text-xs text-[#D9D6CF]">
                        {[request.brand, request.size && `Size ${request.size}`, request.colour]
                          .filter(Boolean)
                          .join(" · ") || "Community request"}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            {[...Array(2)].flatMap(() => [
              "S2G — SECOND LIFE, NEW STYLE — SHILLONG TO GUWAHATI — THRIFT CULTURE —",
            ])}
            {" "}
          </div>
        </div>

        <section className="track-limiter py-20 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-8"
          >
            <p className="section-label">Shop the mood</p>
          </motion.div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {categories.map((category, index) => (
              <motion.button
                key={category.title}
                type="button"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.45, delay: index * 0.05, ease: "easeOut" }}
                onClick={() => {
                  setSelectedCategory(category.title);
                  setSearch("");
                  document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" });
                }}
                className="group relative overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#171717] text-left"
              >
                <Image
                  src={category.image}
                  alt={category.title}
                  width={900}
                  height={1200}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 20vw"
                  quality={80}
                  className="h-72 w-full object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111111]/80 via-[#111111]/10 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="font-display text-3xl tracking-[0.08em]">{category.title}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        <section id="story" className="border-y border-white/10 bg-[#F5F2EC] text-[#111111]">
          <div className="track-limiter grid items-center gap-10 py-20 md:grid-cols-2 md:py-24">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="overflow-hidden rounded-[2rem]"
            >
              <Image
                src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80"
                alt="S2G thrifted fashion portrait"
                width={1200}
                height={1500}
                sizes="(max-width: 768px) 100vw, 50vw"
                quality={80}
                className="h-[560px] w-full object-cover"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-xl"
            >
              <p className="section-label !text-[#111111]/70">Our story</p>
              <h2 className="mt-4 font-display text-5xl leading-none tracking-[0.08em] text-[#111111] md:text-6xl">
                GOOD STYLE DOESN&apos;T NEED TO BE NEW.
              </h2>
              <p className="mt-6 text-base leading-7 text-[#111111]/75">
                S2G gives pre-loved clothing another life through carefully curated thrift finds, standout individual pieces, and accessible streetwear that speaks for itself. We bring together collected style, recycled fashion, and the personalities who wear it best.
              </p>
              <a
                href="#newsletter"
                className="mt-8 inline-flex items-center justify-center rounded-full bg-[#111111] px-6 py-3 text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#F5F2EC] transition hover:bg-[#3a3a3a]"
              >
                Get to know S2G
              </a>
            </motion.div>
          </div>
        </section>

        <section className="track-limiter py-20 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="mb-10 max-w-3xl"
          >
            <p className="section-label">One-of-one</p>
            <h2 className="mt-3 font-display text-5xl tracking-[0.08em] md:text-6xl">
              WHEN IT&apos;S GONE, IT&apos;S GONE.
            </h2>
          </motion.div>

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-6 md:grid-cols-2">
              {products.slice(0, 2).map((product, index) => (
                <motion.div
                  key={product.id ?? `${product.name}-${index}`}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="overflow-hidden rounded-[1.8rem] border border-white/10 bg-[#171717]"
                >
                  <ProductImage
                    src={product.image}
                    alt={product.name}
                    sizes="(max-width: 768px) 100vw, 40vw"
                    className="h-80 w-full object-cover"
                  />
                  <div className="space-y-3 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.58rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">
                        {product.condition}
                      </p>
                      <span className="rounded-full border border-white/15 px-2 py-1 text-[0.52rem] font-semibold uppercase tracking-[0.18em] text-[#F5F2EC]">
                        {product.badge ?? "Available"}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold text-[#F5F2EC]">{product.name}</h3>
                    <div className="flex items-center justify-between text-sm text-[#D9D6CF]">
                      <span>₹{product.price.toLocaleString("en-IN")}</span>
                      <span>{product.stock} left</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-[#171717] p-7 md:p-8">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-[#D9D6CF]">
                Availability note
              </p>
              <p className="mt-5 text-base leading-7 text-[#F5F2EC]/80">
                Selected thrift pieces may be one-of-one and availability depends on actual stock. Every listing is checked for authenticity, condition, and honest wear notes before it reaches the collection.
              </p>
              <a
                href="#collection"
                className="mt-8 inline-flex items-center justify-center rounded-full bg-[#F5F2EC] px-5 py-3 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#111111] transition hover:bg-[#D9D6CF]"
              >
                Shop the latest drop
              </a>
            </div>
          </div>
        </section>

        <section className="bg-[#F5F2EC] py-20 text-[#111111] md:py-24">
          <div className="track-limiter grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-xl"
            >
              <p className="section-label !text-[#111111]/70">Find your next favorite</p>
              <h2 className="mt-3 font-display text-5xl tracking-[0.08em] md:text-7xl">
                PRE-LOVED. RE-IMAGINED.
              </h2>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, delay: 0.08, ease: "easeOut" }}
              className="relative overflow-hidden rounded-[2rem] border border-[#111111]/10 bg-[#E9E5DE] p-8"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(53,60,44,0.12),_transparent_52%)]" />
              <div className="relative grid gap-8 md:grid-cols-[0.8fr_1.2fr]">
                <div className="space-y-4 text-xs font-semibold uppercase tracking-[0.22em] text-[#111111]/70">
                  <div>North East India</div>
                </div>
                <div className="aspect-[4/3] rounded-[1.5rem] border border-[#111111]/10 bg-[linear-gradient(135deg,_rgba(17,17,17,0.02),_rgba(17,17,17,0.12))] p-3">
                  <div className="relative h-full w-full overflow-hidden rounded-[1rem] border border-[#111111]/10 bg-[#D9D6CF]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,_rgba(17,17,17,0.06),_transparent_20%),radial-gradient(circle_at_80%_40%,_rgba(17,17,17,0.08),_transparent_22%)]" />
                    <div className="absolute left-[15%] top-[18%] h-[44%] w-[70%] rounded-full border border-[#111111]/15" />
                    <div className="absolute left-[42%] top-[10%] h-[50%] w-[18%] rounded-full border border-[#111111]/15" />
                    <div className="absolute left-[16%] top-[58%] h-[18%] w-[68%] rounded-full border border-[#111111]/15" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="newsletter" className="track-limiter py-20 md:py-24">
          <div className="rounded-[2.25rem] border border-white/10 bg-[#171717] p-8 md:p-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
            >
              <div className="max-w-lg">
                <p className="section-label">Community</p>
                <h2 className="mt-4 font-display text-5xl tracking-[0.08em] md:text-6xl">
                  BE FIRST TO THE DROP.
                </h2>
              </div>

              <form onSubmit={handleNewsletterSubmit} className="flex w-full max-w-xl flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  maxLength={254}
                  placeholder="Email address"
                  aria-label="Email address"
                  value={newsletterEmail}
                  onChange={(event) => setNewsletterEmail(event.target.value)}
                  className="min-h-14 flex-1 rounded-full border border-white/10 bg-[#111111] px-5 text-sm text-[#F5F2EC] placeholder:text-[#D9D6CF]/70 outline-none"
                />
                <button
                  type="submit"
                  disabled={newsletterSubmitting}
                  className="min-h-14 rounded-full bg-[#F5F2EC] px-6 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-[#111111] transition hover:bg-[#D9D6CF]"
                >
                  {newsletterSubmitting ? "Joining..." : "Join the list"}
                </button>
              </form>
              {newsletterMessage && (
                <p role="status" aria-live="polite" className="mt-3 text-sm text-[#D9D6CF]">
                  {newsletterMessage}
                </p>
              )}
            </motion.div>

            <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="transition hover:text-[#F5F2EC]">
                Instagram
              </a>
              <span>Curated thrift, north east India</span>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#0B0B0B] py-16">
        <div className="track-limiter grid gap-10 lg:grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr]">
          <div>
            <p className="font-display text-5xl leading-none tracking-[0.09em]">S2G</p>
            <p className="mt-3 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">
              Curated thrift
            </p>
          </div>

          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">Shop</p>
            <ul className="mt-4 space-y-3 text-sm text-[#F5F2EC]/80">
              <li><a href="#collection" className="hover:text-[#F5F2EC]">Shop all</a></li>
              <li><a href="#collection" className="hover:text-[#F5F2EC]">New drops</a></li>
              <li><a href="#collection" className="hover:text-[#F5F2EC]">Tops</a></li>
              <li><a href="#collection" className="hover:text-[#F5F2EC]">Bottoms</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">About</p>
            <ul className="mt-4 space-y-3 text-sm text-[#F5F2EC]/80">
              <li><a href="#story" className="hover:text-[#F5F2EC]">About S2G</a></li>
              <li><a href="#newsletter" className="hover:text-[#F5F2EC]">Contact</a></li>
              <li><a href="#collection" className="hover:text-[#F5F2EC]">Shipping</a></li>
              <li><a href="#collection" className="hover:text-[#F5F2EC]">Returns</a></li>
            </ul>
          </div>

          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF]">Policy</p>
            <ul className="mt-4 space-y-3 text-sm text-[#F5F2EC]/80">
              <li><a href="#newsletter" className="hover:text-[#F5F2EC]">Privacy policy</a></li>
              <li><a href="#newsletter" className="hover:text-[#F5F2EC]">Terms & conditions</a></li>
              <li><a href="https://instagram.com" target="_blank" rel="noreferrer" className="hover:text-[#F5F2EC]">Instagram</a></li>
            </ul>
          </div>
        </div>

        <div className="track-limiter mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-[#D9D6CF] md:flex-row md:items-center md:justify-between">
          <span>© 2025 S2G. All rights reserved.</span>
          <span>Pre-loved. Re-defined.</span>
        </div>
      </footer>

      <AnimatePresence>
        {cartOpen && (
          <motion.aside
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-[#111111]/55 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              initial={{ x: 420 }}
              animate={{ x: 0 }}
              exit={{ x: 420 }}
              transition={{ type: "spring", stiffness: 250, damping: 25 }}
              className="ml-auto flex h-full w-full max-w-md flex-col bg-[#171717] p-6 text-[#F5F2EC]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-[0.58rem] font-semibold uppercase tracking-[0.24em] text-[#D9D6CF]">
                    Shopping bag
                  </p>
                  <h3 className="mt-2 font-display text-4xl tracking-[0.08em]">{bagCount} ITEMS</h3>
                  <p className="mt-1 text-[0.62rem] text-[#D9D6CF]">Saved for this browser</p>
                </div>
                <button type="button" onClick={() => setCartOpen(false)} className="text-2xl">
                  ×
                </button>
              </div>

              {cartError && (
                <p role="alert" className="mb-4 rounded-xl border border-[#d88578]/30 bg-[#8c3f38]/15 px-4 py-3 text-sm text-[#F5D6D1]">
                  {cartError}
                </p>
              )}

              {cartLoading ? (
                <div role="status" className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/15 text-center text-sm text-[#D9D6CF]">
                  Loading your saved bag…
                </div>
              ) : cart.length === 0 ? (
                <div className="flex flex-1 items-center justify-center rounded-[1.5rem] border border-dashed border-white/15 text-center text-[#D9D6CF]">
                  <div>
                    <p className="font-display text-3xl tracking-[0.08em] text-[#F5F2EC]">Your bag is empty.</p>
                    <p className="mt-2 text-sm">Build your next outfit from the latest finds.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-4 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div key={`${item.productId}-${item.size}`} className="flex gap-3 rounded-[1.2rem] border border-white/10 bg-[#111111] p-3">
                        <ProductImage
                          src={item.image}
                          alt={item.name}
                          sizes="80px"
                          className="h-24 w-20 rounded-xl object-cover"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[#F5F2EC]">{item.name}</p>
                              <p className="mt-1 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-[#D9D6CF]">
                                Size {item.size}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => updateCartQuantity(item.productId, item.size, -item.quantity)}
                              className="text-sm text-[#D9D6CF]"
                              aria-label={`Remove ${item.name} from bag`}
                            >
                              Remove
                            </button>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <div className="inline-flex items-center rounded-full border border-white/10">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.productId, item.size, -1)}
                                className="h-8 w-8 text-lg text-[#F5F2EC]"
                                aria-label={`Decrease quantity for ${item.name}`}
                              >
                                −
                              </button>
                              <span className="min-w-8 text-center text-sm">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.productId, item.size, 1)}
                                className="h-8 w-8 text-lg text-[#F5F2EC]"
                                aria-label={`Increase quantity for ${item.name}`}
                              >
                                +
                              </button>
                            </div>
                            <p className="font-display text-2xl tracking-[0.08em]">
                              ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 border-t border-white/10 pt-5">
                    <div className="mb-5 flex items-center justify-between text-sm text-[#D9D6CF]">
                      <span>Subtotal</span>
                      <span className="font-display text-2xl tracking-[0.08em] text-[#F5F2EC]">
                        ₹{cartSubtotal.toLocaleString("en-IN")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="w-full rounded-full bg-[#F5F2EC] px-5 py-3 text-[0.64rem] font-bold uppercase tracking-[0.22em] text-[#111111]"
                    >
                      Checkout
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.aside>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="dialog-scroll fixed inset-0 z-[70] overflow-y-auto overscroll-contain bg-[#111111]/70 p-0 backdrop-blur-sm sm:p-6"
            onClick={() => setSelectedProduct(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-view-title"
              className="mx-auto my-0 flex min-h-[100svh] w-full max-w-5xl flex-col overflow-hidden rounded-none bg-[#F5F2EC] pb-[env(safe-area-inset-bottom)] text-[#111111] sm:my-6 sm:min-h-0 sm:rounded-[2rem] sm:pb-0 md:max-h-[calc(100dvh-3rem)] md:min-h-[34rem] md:flex-row"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="shrink-0 bg-[#E9E5DE] p-3 sm:p-4 md:flex md:min-h-0 md:w-[48%] md:flex-col">
                {getProductGallery(visibleProductDetails ?? selectedProduct)[selectedImageIndex] ? (
                  <ProductImage
                    key={`${selectedProduct.id}-${selectedImageIndex}`}
                    src={getProductGallery(visibleProductDetails ?? selectedProduct)[selectedImageIndex]}
                    alt={selectedProduct.name}
                    sizes="(max-width: 768px) 100vw, 48vw"
                    className="h-[min(34svh,18rem)] min-h-40 w-full rounded-[1.2rem] object-cover text-4xl sm:h-[min(48svh,26rem)] sm:min-h-56 sm:rounded-[1.5rem] md:min-h-0 md:flex-1"
                  />
                ) : (
                  <div
                    role="img"
                    aria-label={`No image available for ${selectedProduct.name}`}
                    className="flex h-[min(34svh,18rem)] min-h-40 w-full items-center justify-center rounded-[1.2rem] bg-[#D9D6CF] font-display text-5xl tracking-[0.1em] text-[#77746d] sm:h-[min(48svh,26rem)] sm:min-h-56 sm:rounded-[1.5rem] md:min-h-0 md:flex-1"
                  >
                    S2G
                  </div>
                )}
                <div className="mt-3 flex gap-3 overflow-x-auto pb-1 md:grid md:grid-cols-3 md:overflow-visible">
                  {getProductGallery(visibleProductDetails ?? selectedProduct).map((image, index) => (
                    <button
                      key={`${selectedProduct.id}-${index}`}
                      type="button"
                      onClick={() => setSelectedImageIndex(index)}
                      aria-label={`Show ${selectedProduct.name}, view ${index + 1}`}
                      aria-pressed={selectedImageIndex === index}
                      className={`w-16 shrink-0 overflow-hidden rounded-xl border transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] sm:w-20 md:w-auto ${
                        selectedImageIndex === index
                          ? "border-[#111111]"
                          : "border-[#111111]/10"
                      }`}
                    >
                      <ProductImage
                        key={`${selectedProduct.id}-${index}`}
                        src={image}
                        alt={`Preview ${index + 1} for ${selectedProduct.name}`}
                        sizes="80px"
                        className="h-14 w-full object-cover text-xs sm:h-16"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 flex-col p-5 sm:p-6 md:min-h-0 md:overflow-y-auto md:p-8">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-[#111111]/65">
                      {selectedProduct.category}
                    </p>
                    <h3
                      id="quick-view-title"
                      className="mt-2 font-display text-3xl leading-none tracking-[0.08em] sm:text-4xl"
                    >
                      {selectedProduct.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    aria-label="Close quick view"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#111111]/15 text-2xl transition hover:bg-[#111111]/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <span className="font-display text-3xl tracking-[0.08em] sm:text-4xl">
                    ₹{selectedProduct.price.toLocaleString("en-IN")}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-[#111111]/15 px-3 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.16em]">
                      {selectedProduct.condition}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[0.56rem] font-semibold uppercase tracking-[0.16em] ${
                        selectedProduct.stock > 0
                          ? "bg-[#5f6856]/15 text-[#46503e]"
                          : "bg-[#6d3a3a]/10 text-[#6d3a3a]"
                      }`}
                    >
                      {selectedProduct.stock > 0
                        ? `${selectedProduct.stock} ${
                            selectedProduct.stock === 1 ? "piece" : "pieces"
                          } left`
                        : "Out of stock"}
                    </span>
                  </div>
                </div>

                {productDetailsLoading ? (
                  <p role="status" className="mt-6 text-sm text-[#111111]/60">
                    Loading product details…
                  </p>
                ) : productDetailsError ? (
                  <p role="alert" className="mt-6 text-sm text-[#6d3a3a]">
                    {productDetailsError}
                  </p>
                ) : (
                  <p className="mt-6 text-base leading-7 text-[#111111]/75">
                    {visibleProductDetails?.description ?? ""}
                  </p>
                )}

                <div className="mt-6">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[#111111]/60">
                    Size
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose a size">
                    {getProductSizes(selectedProduct).map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        aria-pressed={selectedSize === size}
                        className={`h-10 min-w-10 rounded-full border px-3 text-sm font-medium transition ${
                          selectedSize === size
                            ? "border-[#111111] bg-[#111111] text-[#F5F2EC]"
                            : "border-[#111111]/15 bg-transparent text-[#111111]"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-6 rounded-[1.2rem] border border-[#111111]/10 bg-white/50 p-4">
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-[#111111]/60">
                    Fit notes
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-[#111111]/80">
                    <li>• Relaxed silhouette with a wearable vintage drape.</li>
                    <li>• Measurements available on request for the exact piece.</li>
                    <li>• Honest wear marks are noted in listing details.</li>
                  </ul>
                </div>

                <div className="sticky bottom-0 -mx-5 mt-8 flex flex-col gap-3 border-t border-[#111111]/10 bg-[#F5F2EC] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:flex-row sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSize) {
                        addToCart(selectedProduct, selectedSize);
                        setSelectedProduct(null);
                      }
                    }}
                    disabled={cartLoading || selectedProduct.stock < 1 || !selectedSize}
                    className="flex-1 rounded-full bg-[#111111] px-5 py-3 text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#F5F2EC] transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Add to bag
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="flex-1 rounded-full border border-[#111111]/15 px-5 py-3 text-[0.64rem] font-bold uppercase tracking-[0.2em] text-[#111111] transition hover:bg-[#111111]/5"
                  >
                    Continue browsing
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
