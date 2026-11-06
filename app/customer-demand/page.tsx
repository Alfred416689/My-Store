"use client";

import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type ProductRequest = {
  id: string;
  name: string;
  category: string;
  brand: string;
  size: string;
  colour: string;
  budget: number;
  details: string;
  image: string;
  status: "Approved";
  requestedAt: string;
};

type RequestFormValues = Omit<ProductRequest, "id" | "status" | "requestedAt">;

const categories = [
  "T-shirts",
  "Shirts",
  "Jeans",
  "Trousers",
  "Jackets",
  "Hoodies",
  "Dresses",
  "Footwear",
  "Accessories",
  "Other",
];

const emptyForm: RequestFormValues = {
  name: "",
  category: "",
  brand: "",
  size: "",
  colour: "",
  budget: 0,
  details: "",
  image: "",
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(value: string) {
  return dateFormatter.format(new Date(value));
}

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function StatusBadge({ status }: { status: "Approved" }) {
  return (
    <span className="inline-flex rounded-full bg-[#e8e3d9] px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] text-[#514d43]">
      {status}
    </span>
  );
}

function RequestImage({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [unavailable, setUnavailable] = useState(!src);

  if (src && !unavailable) {
    return (
      <Image
        src={src}
        alt={`Reference for ${name}`}
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className={className}
        onError={() => setUnavailable(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={`No reference image for ${name}`}
      className={`absolute inset-0 flex items-center justify-center bg-[#e7e2d9] text-[#7c796f] ${className}`}
    >
      <span className="font-display text-5xl tracking-[0.1em]" aria-hidden="true">
        S2G
      </span>
    </div>
  );
}

function RequestCard({
  request,
  onView,
}: {
  request: ProductRequest;
  onView: (request: ProductRequest) => void;
}) {
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group overflow-hidden rounded-2xl border border-[#111111]/10 bg-white transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(17,17,17,0.09)]"
    >
      <button
        type="button"
        onClick={() => onView(request)}
        className="block w-full text-left focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[#5f6856]"
        aria-label={`View ${request.name} request details`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#e7e2d9]">
          <RequestImage
            src={request.image}
            name={request.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#6b6b63]">
                {request.category}
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-[#191a18]">
                {request.name}
              </h2>
            </div>
            <span className="shrink-0 pt-1 text-sm font-bold text-[#252720]">
              {formatPrice(request.budget)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#65665f]">
            <span>Size {request.size || "Any"}</span>
            {request.colour && <span>{request.colour}</span>}
          </div>
          <div className="flex items-center justify-between border-t border-[#111111]/8 pt-3 text-[0.68rem] text-[#73736c]">
            <span>Requested {formatDate(request.requestedAt)}</span>
            <span className="font-semibold text-[#34362f] transition group-hover:translate-x-0.5">
              View request <span aria-hidden="true">↗</span>
            </span>
          </div>
        </div>
      </button>
    </motion.article>
  );
}

export default function CustomerDemandPage() {
  const [requests, setRequests] = useState<ProductRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsError, setRequestsError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [sizeFilter, setSizeFilter] = useState("");
  const [budgetFilter, setBudgetFilter] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ProductRequest | null>(null);
  const [formValues, setFormValues] = useState<RequestFormValues>(emptyForm);
  const [imageProgress, setImageProgress] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visibleRequests = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      const matchesSearch =
        !normalizedSearch ||
        `${request.name} ${request.category} ${request.brand} ${request.colour}`
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesCategory =
        categoryFilter === "All categories" || request.category === categoryFilter;
      const matchesSize =
        !sizeFilter || request.size.toLowerCase().includes(sizeFilter.trim().toLowerCase());
      const matchesBudget =
        !budgetFilter || request.budget <= Number(budgetFilter);

      return (
        matchesSearch &&
        matchesCategory &&
        matchesSize &&
        matchesBudget
      );
    });

    return filtered.sort((a, b) =>
      sortOrder === "oldest"
        ? a.requestedAt.localeCompare(b.requestedAt)
        : b.requestedAt.localeCompare(a.requestedAt),
    );
  }, [
    budgetFilter,
    categoryFilter,
    requests,
    search,
    sizeFilter,
    sortOrder,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRequests() {
      try {
        const response = await fetch("/api/customer-requests", {
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          requests?: ProductRequest[];
          error?: string;
        };
        if (!response.ok || !Array.isArray(result.requests)) {
          throw new Error(result.error || "Customer requests could not be loaded.");
        }
        setRequests(result.requests);
      } catch (error) {
        if (controller.signal.aborted) return;
        setRequestsError(
          error instanceof Error
            ? error.message
            : "Customer requests could not be loaded. Check the MongoDB connection and try again.",
        );
      } finally {
        if (!controller.signal.aborted) setRequestsLoading(false);
      }
    }

    void loadRequests();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!formOpen && !selectedRequest) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFormOpen(false);
        setSelectedRequest(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [formOpen, selectedRequest]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openNewRequest = () => {
    setFormValues(emptyForm);
    setImageProgress(null);
    setFormError("");
    setFormOpen(true);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setFormError("Choose a JPG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Reference images must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setFormError("");
    setImageProgress(0);
    const reader = new FileReader();
    reader.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        setImageProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      }
    };
    reader.onerror = () => {
      setImageProgress(null);
      setFormError("That image could not be previewed. Please try another file.");
    };
    reader.onload = () => {
      const image = reader.result;
      if (typeof image === "string") {
        setFormValues((current) => ({ ...current, image }));
        setImageProgress(100);
      } else {
        setImageProgress(null);
        setFormError("That image could not be previewed. Please try another file.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError("");

    if (new FormData(event.currentTarget).get("publicConsent") !== "on") {
      setFormError("Confirm that your request details and reference image may be shown publicly.");
      return;
    }

    setFormSubmitting(true);
    try {
      const response = await fetch("/api/customer-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formValues, publicConsent: true }),
      });
      const result = (await response.json()) as {
        request?: Omit<ProductRequest, "status"> & { status: "Pending" };
        error?: string;
      };
      if (!response.ok || !result.request) {
        throw new Error(result.error || "Your request could not be saved.");
      }

      setFormOpen(false);
      setToast("Your request was submitted for review. It will appear after approval.");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Your request could not be saved. Try again.",
      );
    } finally {
      setFormSubmitting(false);
    }
  };

  const currentDialogRequest = selectedRequest;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#111111] text-[#F5F2EC]">
      <div className="border-b border-black/5 bg-[#F5F2EC] text-[#111111]">
        <div className="track-limiter flex min-h-10 items-center justify-center gap-2 text-center text-[0.58rem] font-bold uppercase tracking-[0.16em] sm:text-[0.65rem] sm:tracking-[0.24em]">
          <span aria-hidden="true">✦</span>
          Customer requests are reviewed before appearing publicly
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#111111]">
        <div className="track-limiter flex h-[4.5rem] items-center justify-between gap-5">
          <Link href="/" className="flex flex-col leading-none" aria-label="S2G home">
            <span className="font-display text-3xl tracking-[0.14em]">S2G</span>
            <span className="mt-1 text-[0.48rem] font-semibold uppercase tracking-[0.34em] text-[#D9D6CF]">
              Curated thrift
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-4 text-[0.62rem] font-semibold uppercase tracking-[0.15em] sm:gap-7 sm:text-[0.68rem] sm:tracking-[0.2em]"
          >
            <Link href="/" className="text-[#D9D6CF] transition hover:text-white">
              Shop
            </Link>
            <span className="text-white" aria-current="page">
              Customer Demand
            </span>
          </nav>
          <Link
            href="/"
            className="hidden rounded-full border border-white/20 px-4 py-2 text-[0.58rem] font-bold uppercase tracking-[0.15em] transition hover:bg-white hover:text-[#111111] sm:inline-flex"
          >
            Back to shop
          </Link>
        </div>
      </header>

      <main>
        <section className="bg-[#F5F2EC] text-[#111111]">
          <div className="track-limiter grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1fr_0.82fr] lg:py-24">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-2xl"
            >
              <p className="section-label !text-[#111111]/60">S2G · Customer demand</p>
              <h1 className="mt-5 font-display text-6xl leading-[0.9] tracking-[0.04em] sm:text-7xl md:text-8xl">
                LOOKING FOR SOMETHING SPECIFIC?
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-[#111111]/70 sm:text-base">
                Can&apos;t find your desired piece? Tell us what you&apos;re looking for, and we&apos;ll try to find it for you.
              </p>
              <button
                type="button"
                onClick={openNewRequest}
                className="mt-8 inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#111111] px-7 py-3 text-[0.66rem] font-bold uppercase tracking-[0.2em] text-[#F5F2EC] transition hover:-translate-y-0.5 hover:bg-[#34362f] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
              >
                Request a product <span aria-hidden="true">↗</span>
              </button>
              <p className="mt-4 max-w-md text-xs leading-5 text-[#111111]/55">
                Approved requests are shared publicly with the community. Do not include personal or contact information.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="relative mx-auto grid w-full max-w-xl grid-cols-[1fr_0.72fr] gap-3"
            >
              <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[#e7e2d9] sm:h-[22rem] sm:aspect-auto">
                <Image
                  src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80"
                  alt="Curated vintage outfit inspiration"
                  fill
                  preload
                  sizes="(max-width: 640px) 50vw, 30vw"
                  className="h-72 w-full object-cover sm:h-[22rem]"
                />
              </div>
              <div className="mt-10 flex flex-col gap-3 sm:mt-14">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[#e7e2d9] sm:h-44 sm:aspect-auto">
                  <Image
                    src="https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=700&q=80"
                    alt="Vintage denim inspiration"
                    fill
                    sizes="(max-width: 640px) 35vw, 22vw"
                    className="h-36 w-full object-cover sm:h-44"
                  />
                </div>
                <div className="flex min-h-32 flex-col justify-between rounded-[1.5rem] bg-[#5f6856] p-5 text-[#F5F2EC]">
                  <span className="text-[0.56rem] font-bold uppercase tracking-[0.22em] text-white/70">
                    Your next find
                  </span>
                  <p className="font-display text-3xl leading-none tracking-[0.08em] sm:text-4xl">
                    START WITH A WISH.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section id="requests" className="track-limiter py-14 sm:py-20">
          <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="section-label">Approved community requests</p>
              <h2 className="mt-3 font-display text-4xl tracking-[0.08em] sm:text-5xl">
                WHAT EVERYONE&apos;S LOOKING FOR
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#D9D6CF]">
              Browse approved requests for inspiration. New submissions appear here after admin review.
            </p>
          </div>

          <div className="mb-8 grid gap-3 rounded-2xl border border-white/10 bg-[#171717] p-4 sm:grid-cols-2 lg:grid-cols-6">
            <label className="lg:col-span-2">
              <span className="sr-only">Search requests</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search requests"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-4 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#F5F2EC]"
              />
            </label>
            <label>
              <span className="sr-only">Filter by category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-[#F5F2EC]"
              >
                <option>All categories</option>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="sr-only">Filter by size</span>
              <input
                value={sizeFilter}
                onChange={(event) => setSizeFilter(event.target.value)}
                placeholder="Size"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-[#F5F2EC]"
              />
            </label>
            <label>
              <span className="sr-only">Maximum budget filter</span>
              <input
                type="number"
                min="0"
                value={budgetFilter}
                onChange={(event) => setBudgetFilter(event.target.value)}
                placeholder="Max budget ₹"
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-sm text-white placeholder:text-white/40 focus-visible:outline-2 focus-visible:outline-[#F5F2EC]"
              />
            </label>
            <label>
              <span className="sr-only">Sort requests</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/10 bg-[#111111] px-3 text-xs text-white focus-visible:outline-2 focus-visible:outline-[#F5F2EC]"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
          </div>

          {requestsError ? (
            <div role="alert" className="rounded-2xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 px-6 py-10 text-center text-sm text-[#F5D6D1]">
              {requestsError}
            </div>
          ) : requestsLoading ? (
            <div role="status" className="rounded-2xl border border-white/10 bg-[#171717] px-6 py-10 text-center text-sm text-[#D9D6CF]">
              Loading community requests…
            </div>
          ) : visibleRequests.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-[#171717] px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/5 text-2xl" aria-hidden="true">
                ♧
              </span>
              <h3 className="mt-5 font-display text-3xl tracking-[0.08em]">
                {requests.length === 0 ? "THE WISHLIST STARTS HERE" : "NO REQUESTS FOUND"}
              </h3>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#D9D6CF]">
                {requests.length === 0
                  ? "Be the first to share what you would love to find. Requests appear here after approval."
                  : "Try a different filter, or submit a new request for review."}
              </p>
            </div>
          ) : (
            <motion.div layout className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {visibleRequests.map((request) => (
                  <div key={request.id}>
                    <RequestCard
                      request={request}
                      onView={setSelectedRequest}
                    />
                  </div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        <section className="border-t border-white/10 bg-[#171717]">
          <div className="track-limiter grid gap-5 py-10 text-sm leading-6 text-[#D9D6CF] sm:grid-cols-3">
            <p><strong className="text-white">Share the idea.</strong> Add a reference photo, size and budget to your public request.</p>
            <p><strong className="text-white">We look for the right fit.</strong> Requests are saved for the S2G team to review.</p>
            <p><strong className="text-white">You decide.</strong> A request is not a purchase order, and an example photo is never the final product listing.</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="track-limiter flex flex-col gap-3 py-7 text-xs text-[#D9D6CF] sm:flex-row sm:items-center sm:justify-between">
          <span className="font-display text-xl tracking-[0.12em] text-white">S2G · CURATED THRIFT</span>
          <Link href="/" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            Return to the storefront
          </Link>
        </div>
      </footer>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            className="dialog-scroll fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-[#111111]/75 p-0 backdrop-blur-sm sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setFormOpen(false);
            }}
          >
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-form-title"
              initial={{ opacity: 0, y: 18, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              className="mx-auto my-0 min-h-[100svh] w-full max-w-3xl overflow-hidden rounded-none bg-[#F5F2EC] pb-[env(safe-area-inset-bottom)] text-[#111111] shadow-2xl sm:my-8 sm:min-h-0 sm:rounded-2xl sm:pb-0"
            >
              <div className="sticky top-0 z-10 flex items-start justify-between gap-5 border-b border-black/10 bg-[#F5F2EC] px-4 py-4 sm:static sm:px-8 sm:py-5">
                <div>
                  <p className="text-[0.58rem] font-bold uppercase tracking-[0.2em] text-[#5f6856]">
                    Customer demand · Request review
                  </p>
                  <h2 id="request-form-title" className="mt-2 font-display text-4xl tracking-[0.06em] sm:text-5xl">
                    MAKE A WISH
                  </h2>
                  <p className="mt-2 text-xs leading-5 text-[#111111]/60">
                    If approved, your request details and reference photo will be visible to everyone. Do not include personal or contact information.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  aria-label="Close request form"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/15 text-2xl transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleFormSubmit} className="space-y-5 p-4 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-bold">Product name <span className="text-[#8c3f38]">*</span></span>
                    <input
                      required
                      maxLength={100}
                      value={formValues.name}
                      onChange={(event) => setFormValues({ ...formValues, name: event.target.value })}
                      placeholder="e.g. Vintage leather jacket"
                      className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-bold">Reference image <span className="font-normal text-black/50">(optional · JPG, PNG or WebP · up to 5 MB)</span></span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageChange}
                      className="sr-only"
                    />
                    <div className="flex flex-col gap-4 rounded-xl border border-dashed border-black/20 bg-white/60 p-3 sm:flex-row sm:items-center">
                      {formValues.image ? (
                        <Image
                          src={formValues.image}
                          alt="Your selected reference preview"
                          width={112}
                          height={112}
                          unoptimized
                          className="h-28 w-full rounded-lg object-cover sm:w-28"
                        />
                      ) : (
                        <div className="flex h-24 w-full items-center justify-center rounded-lg bg-[#e7e2d9] text-3xl text-[#7c796f] sm:w-28" aria-hidden="true">
                          +
                        </div>
                      )}
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-full border border-black/20 px-4 py-2 text-[0.6rem] font-bold uppercase tracking-[0.13em] transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                        >
                          {formValues.image ? "Change image" : "Choose an image"}
                        </button>
                        {imageProgress !== null && (
                          <div className="mt-3">
                            <div
                              className="h-1.5 overflow-hidden rounded-full bg-black/10"
                              role="progressbar"
                              aria-label="Preparing reference image preview"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={imageProgress}
                            >
                              <div
                                className="h-full rounded-full bg-[#5f6856] transition-[width]"
                                style={{ width: `${imageProgress}%` }}
                              />
                            </div>
                            <p className="mt-1 text-[0.65rem] text-black/55">
                              Ready to upload · {imageProgress}%
                            </p>
                          </div>
                        )}
                        <p className="mt-2 text-[0.68rem] leading-5 text-black/55">
                          Your reference photo will be stored with this public request and is only for inspiration.
                        </p>
                      </div>
                    </div>
                  </label>

                  <label>
                    <span className="mb-2 block text-xs font-bold">Category <span className="text-[#8c3f38]">*</span></span>
                    <select
                      required
                      value={formValues.category}
                      onChange={(event) => setFormValues({ ...formValues, category: event.target.value })}
                      className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    >
                      <option value="">Choose a category</option>
                      {categories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold">Preferred brand <span className="font-normal text-black/50">(optional)</span></span>
                    <input
                      maxLength={60}
                      value={formValues.brand}
                      onChange={(event) => setFormValues({ ...formValues, brand: event.target.value })}
                      placeholder="Any brand"
                      className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold">Preferred size</span>
                    <input
                      maxLength={30}
                      value={formValues.size}
                      onChange={(event) => setFormValues({ ...formValues, size: event.target.value })}
                      placeholder="e.g. M, 30, UK 7"
                      className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold">Preferred colour</span>
                    <input
                      maxLength={40}
                      value={formValues.colour}
                      onChange={(event) => setFormValues({ ...formValues, colour: event.target.value })}
                      placeholder="e.g. Navy, faded black"
                      className="min-h-12 w-full rounded-xl border border-black/15 bg-white px-4 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    />
                  </label>
                  <label>
                    <span className="mb-2 block text-xs font-bold">Maximum budget <span className="text-[#8c3f38]">*</span></span>
                    <div className="flex min-h-12 items-center overflow-hidden rounded-xl border border-black/15 bg-white focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[#5f6856]">
                      <span className="px-4 text-sm text-black/50">₹</span>
                      <input
                        required
                        type="number"
                        min="1"
                        max="1000000"
                        step="1"
                        value={formValues.budget || ""}
                        onChange={(event) => setFormValues({ ...formValues, budget: Number(event.target.value) })}
                        placeholder="1500"
                        className="min-h-12 w-full border-0 bg-transparent pr-4 text-sm outline-none"
                      />
                    </div>
                  </label>
                  <label className="sm:col-span-2">
                    <span className="mb-2 block text-xs font-bold">Additional details <span className="font-normal text-black/50">(optional)</span></span>
                    <textarea
                      maxLength={500}
                      rows={3}
                      value={formValues.details}
                      onChange={(event) => setFormValues({ ...formValues, details: event.target.value })}
                      placeholder="Fit, fabric, or details that would help us understand what you're after."
                      className="w-full resize-y rounded-xl border border-black/15 bg-white px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#5f6856]"
                    />
                    <span className="mt-1 block text-right text-[0.65rem] text-black/45">
                      {formValues.details.length}/500
                    </span>
                  </label>
                </div>

                <label className="flex items-start gap-3 text-xs leading-5 text-black/70">
                  <input
                    type="checkbox"
                    name="publicConsent"
                    required
                    className="mt-1 h-4 w-4 shrink-0 accent-[#5f6856]"
                  />
                  <span>
                    I understand that my request details and any reference photo I upload will be stored in MongoDB. If approved, they will be displayed publicly in the community wishlist.
                  </span>
                </label>

                {formError && (
                  <p role="alert" className="rounded-xl border border-[#8c3f38]/20 bg-[#8c3f38]/[0.06] px-4 py-3 text-sm text-[#773c35]">
                    {formError}
                  </p>
                )}
                <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-3 border-t border-black/10 bg-[#F5F2EC] px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="min-h-12 rounded-full border border-black/20 px-6 text-[0.62rem] font-bold uppercase tracking-[0.15em] transition hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                  >
                    Keep browsing
                  </button>
                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="min-h-12 rounded-full bg-[#111111] px-7 text-[0.62rem] font-bold uppercase tracking-[0.15em] text-white transition hover:bg-[#34362f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                  >
                    {formSubmitting ? "Submitting..." : "Submit request"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {currentDialogRequest && (
          <motion.div
            className="fixed inset-0 z-[75] overflow-y-auto bg-[#111111]/75 p-3 backdrop-blur-sm sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSelectedRequest(null);
            }}
          >
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-detail-title"
              initial={{ opacity: 0, y: 18, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              className="mx-auto my-3 grid w-full max-w-4xl overflow-hidden rounded-2xl bg-[#F5F2EC] text-[#111111] shadow-2xl md:my-8 md:grid-cols-[0.85fr_1.15fr]"
            >
              <div className="relative min-h-56 bg-[#e7e2d9] md:min-h-[32rem]">
                <RequestImage
                  src={currentDialogRequest.image}
                  name={currentDialogRequest.name}
                  className="h-full max-h-[36rem] min-h-56 w-full object-cover"
                />
              </div>
              <div className="p-5 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#5f6856]">
                      {currentDialogRequest.category}
                    </p>
                    <h2 id="request-detail-title" className="mt-2 font-display text-4xl leading-[0.95] tracking-[0.04em] sm:text-5xl">
                      {currentDialogRequest.name}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedRequest(null)}
                    aria-label="Close request details"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/15 text-2xl hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <StatusBadge status={currentDialogRequest.status} />
                  <span className="text-xs text-black/55">
                    Requested {formatDate(currentDialogRequest.requestedAt)}
                  </span>
                </div>
                <p className="mt-5 font-display text-3xl tracking-[0.06em]">
                  UP TO {formatPrice(currentDialogRequest.budget)}
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-y border-black/10 py-5 text-sm">
                  <div><dt className="text-xs text-black/50">Preferred size</dt><dd className="mt-1 font-semibold">{currentDialogRequest.size || "Any"}</dd></div>
                  <div><dt className="text-xs text-black/50">Colour</dt><dd className="mt-1 font-semibold">{currentDialogRequest.colour || "No preference"}</dd></div>
                  {currentDialogRequest.brand && (
                    <div className="col-span-2"><dt className="text-xs text-black/50">Preferred brand</dt><dd className="mt-1 font-semibold">{currentDialogRequest.brand}</dd></div>
                  )}
                </dl>
                {currentDialogRequest.details && (
                  <p className="mt-5 text-sm leading-6 text-black/70">{currentDialogRequest.details}</p>
                )}

                <p className="mt-6 text-xs leading-5 text-black/55">
                  This request is public and cannot be edited or deleted from this page.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-5 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-white/10 bg-[#F5F2EC] px-5 py-4 text-center text-sm font-semibold text-[#111111] shadow-xl sm:bottom-8"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
