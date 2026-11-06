"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

type PendingRequest = {
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

type ManagedProduct = {
  id: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  collections: ("everyday" | "curated")[];
  featured: boolean;
  condition: string;
  sizes: string[];
  image: string;
  badge?: string;
  stock: number;
  description: string;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatPrice(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("The selected image could not be read."));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

export default function AdminPage() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [products, setProducts] = useState<ManagedProduct[]>([]);
  const [editingProduct, setEditingProduct] = useState<ManagedProduct | null>(null);
  const [authState, setAuthState] = useState<"checking" | "signed-in" | "signed-out">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [pageError, setPageError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState("");
  const [addingProduct, setAddingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState("");
  const [productFormSuccess, setProductFormSuccess] = useState("");

  const loadProducts = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/products", { signal });
    const result = (await response.json()) as {
      products?: ManagedProduct[];
      error?: string;
    };
    if (response.status === 401) {
      setProducts([]);
      setAuthState("signed-out");
      return;
    }
    if (!response.ok || !Array.isArray(result.products)) {
      throw new Error(result.error || "Products could not be loaded.");
    }
    setProducts(result.products);
  }, []);

  const loadRequests = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/customer-requests", { signal });
      const result = (await response.json()) as {
        requests?: PendingRequest[];
        error?: string;
      };

      if (response.status === 401) {
        setRequests([]);
        setAuthState("signed-out");
        return;
      }
      if (!response.ok || !Array.isArray(result.requests)) {
        throw new Error(result.error || "Pending requests could not be loaded.");
      }

      setRequests(result.requests);
      setPageError("");
      setAuthState("signed-in");
      try {
        await loadProducts(signal);
      } catch (error) {
        if (signal?.aborted) return;
        setPageError(
          error instanceof Error ? error.message : "Products could not be loaded.",
        );
      }
    } catch (error) {
      if (signal?.aborted) return;
      setPageError(
        error instanceof Error ? error.message : "Pending requests could not be loaded.",
      );
      setAuthState("signed-in");
    }
  }, [loadProducts]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void loadRequests(controller.signal), 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadRequests]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Admin sign-in failed.");
      }

      setPassword("");
      await loadRequests();
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Admin sign-in failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    const response = await fetch("/api/admin/session", { method: "DELETE" });
    if (!response.ok) {
      setPageError("Could not sign out. Please try again.");
      return;
    }
    setRequests([]);
    setProducts([]);
    setEditingProduct(null);
    setPageError("");
    setAuthState("signed-out");
  };

  const approveRequest = async (request: PendingRequest) => {
    setApprovingId(request.id);
    setPageError("");

    try {
      const response = await fetch(`/api/admin/customer-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "The request could not be approved.");
      }

      setRequests((current) => current.filter((item) => item.id !== request.id));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "The request could not be approved.");
    } finally {
      setApprovingId("");
    }
  };

  const addProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProductFormError("");
    setProductFormSuccess("");
    setAddingProduct(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const image = formData.get("image");
      if (
        (!(image instanceof File) || image.size === 0) &&
        !editingProduct
      ) {
        throw new Error("Choose a product image to upload.");
      }
      if (image instanceof File && image.size > 5 * 1024 * 1024) {
        throw new Error("Choose an image that is 5 MB or smaller.");
      }

      const body = {
        name: formData.get("name"),
        category: formData.get("category"),
        price: Number(formData.get("price")),
        compareAtPrice: formData.get("compareAtPrice")
          ? Number(formData.get("compareAtPrice"))
          : null,
        condition: formData.get("condition"),
        sizes: formData.get("sizes"),
        stock: Number(formData.get("stock")),
        badge: formData.get("badge"),
        description: formData.get("description"),
        collections: formData.getAll("collections"),
        featured: formData.get("featured") === "on",
        ...(image instanceof File && image.size > 0
          ? { image: await readImageAsDataUrl(image) }
          : {}),
      };
      const response = await fetch(
        editingProduct
          ? `/api/admin/products/${editingProduct.id}`
          : "/api/admin/products",
        {
        method: editingProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        },
      );
      const result = (await response.json()) as {
        product?: ManagedProduct;
        error?: string;
      };
      if (!response.ok || !result.product) {
        throw new Error(result.error || "The product could not be saved.");
      }

      form.reset();
      setEditingProduct(null);
      setProductFormSuccess(
        editingProduct
          ? `${result.product.name} has been updated.`
          : `${result.product.name} is now listed in the storefront.`,
      );
      await loadProducts();
    } catch (error) {
      setProductFormError(
        error instanceof Error ? error.message : "The product could not be saved.",
      );
    } finally {
      setAddingProduct(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#111111] px-4 py-10 text-[#F5F2EC] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-5 border-b border-white/10 pb-6">
          <div>
            <Link href="/" className="font-display text-2xl tracking-[0.14em]">S2G</Link>
            <p className="mt-2 text-[0.65rem] font-bold uppercase tracking-[0.22em] text-[#D9D6CF]">
              Admin · Store management
            </p>
            <h1 className="mt-3 font-display text-5xl tracking-[0.08em] sm:text-6xl">
              REQUEST REVIEW
            </h1>
          </div>
          {authState === "signed-in" && (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="rounded-full border border-white/20 px-5 py-2 text-[0.62rem] font-bold uppercase tracking-[0.16em] transition hover:bg-white hover:text-[#111111]"
            >
              Sign out
            </button>
          )}
        </header>

        {authState === "checking" ? (
          <p role="status" className="rounded-2xl border border-white/10 bg-[#171717] p-8 text-center text-sm text-[#D9D6CF]">
            Checking admin session…
          </p>
        ) : authState === "signed-out" ? (
          <section className="mx-auto max-w-md rounded-2xl border border-white/10 bg-[#171717] p-6 sm:p-8">
            <h2 className="font-display text-3xl tracking-[0.08em]">ADMIN SIGN IN</h2>
            <p className="mt-2 text-sm leading-6 text-[#D9D6CF]">
              Sign in to review product requests before they appear publicly.
            </p>
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold">Admin email</span>
                <input
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm text-white outline-none focus-visible:border-[#D9D6CF]"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm text-white outline-none focus-visible:border-[#D9D6CF]"
                />
              </label>
              {loginError && (
                <p role="alert" className="rounded-xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 px-4 py-3 text-sm text-[#F5D6D1]">
                  {loginError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="min-h-12 w-full rounded-full bg-[#F5F2EC] px-6 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#111111] transition hover:bg-[#D9D6CF] disabled:opacity-60"
              >
                {submitting ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </section>
        ) : (
          <section>
            <section className="mb-12 rounded-2xl border border-white/10 bg-[#171717] p-5 sm:p-8">
              <p className="section-label">Store inventory</p>
              <h2 className="mt-2 font-display text-3xl tracking-[0.08em] sm:text-4xl">
                {editingProduct ? "EDIT PRODUCT" : "ADD A PRODUCT"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#D9D6CF]">
                Add or update product details and choose where each piece belongs.
              </p>

              <form
                id="product-form"
                key={editingProduct?.id ?? "new-product"}
                onSubmit={addProduct}
                className="mt-7 grid gap-4 sm:grid-cols-2"
              >
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Product name</span>
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={editingProduct?.name}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Category</span>
                  <input
                    name="category"
                    required
                    maxLength={50}
                    placeholder="e.g. Graphic Tees"
                    defaultValue={editingProduct?.category}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Price (₹)</span>
                  <input
                    name="price"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    required
                    defaultValue={editingProduct?.price}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Original price (optional)</span>
                  <input
                    name="compareAtPrice"
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    defaultValue={editingProduct?.compareAtPrice}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Condition</span>
                  <input
                    name="condition"
                    required
                    maxLength={80}
                    placeholder="e.g. Very good"
                    defaultValue={editingProduct?.condition}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Sizes</span>
                  <input
                    name="sizes"
                    required
                    maxLength={120}
                    placeholder="e.g. S, M, L"
                    defaultValue={editingProduct?.sizes.join(", ")}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold">Stock quantity</span>
                  <input
                    name="stock"
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    required
                    defaultValue={editingProduct?.stock ?? 1}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold">Badge (optional)</span>
                  <input
                    name="badge"
                    maxLength={40}
                    placeholder="e.g. One-of-one"
                    defaultValue={editingProduct?.badge}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] px-4 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold">Description</span>
                  <textarea
                    name="description"
                    required
                    maxLength={1000}
                    rows={4}
                    defaultValue={editingProduct?.description}
                    className="w-full rounded-xl border border-white/15 bg-[#111111] px-4 py-3 text-sm outline-none focus-visible:border-[#D9D6CF]"
                  />
                </label>
                <fieldset className="rounded-xl border border-white/10 p-4 sm:col-span-2">
                  <legend className="px-2 text-xs font-semibold">Shopping collections</legend>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        name="collections"
                        type="checkbox"
                        value="everyday"
                        defaultChecked={
                          editingProduct
                            ? editingProduct.collections.includes("everyday")
                            : true
                        }
                        className="h-4 w-4 accent-[#F5F2EC]"
                      />
                      Everyday Finds
                    </label>
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        name="collections"
                        type="checkbox"
                        value="curated"
                        defaultChecked={editingProduct?.collections.includes("curated")}
                        className="h-4 w-4 accent-[#F5F2EC]"
                      />
                      The Curated Collection
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-[#D9D6CF]">
                    Select both only when a piece should intentionally appear in both collections.
                  </p>
                </fieldset>
                <label className="flex min-h-12 items-center gap-3 text-sm sm:col-span-2">
                  <input
                    name="featured"
                    type="checkbox"
                    defaultChecked={editingProduct?.featured}
                    className="h-4 w-4 accent-[#F5F2EC]"
                  />
                  Feature this piece in its collection
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-xs font-semibold">Product image</span>
                  <input
                    name="image"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    required={!editingProduct}
                    className="min-h-12 w-full rounded-xl border border-white/15 bg-[#111111] p-3 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-[#F5F2EC] file:px-4 file:py-2 file:text-xs file:font-bold file:text-[#111111]"
                  />
                  <span className="mt-2 block text-xs text-[#D9D6CF]">
                    JPG, PNG, or WebP · up to 5 MB{editingProduct ? " · leave blank to keep the current image" : ""}
                  </span>
                </label>
                {productFormError && (
                  <p role="alert" className="rounded-xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 px-4 py-3 text-sm text-[#F5D6D1] sm:col-span-2">
                    {productFormError}
                  </p>
                )}
                {productFormSuccess && (
                  <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 sm:col-span-2">
                    {productFormSuccess}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={addingProduct}
                  className="min-h-12 rounded-full bg-[#F5F2EC] px-7 text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#111111] transition hover:bg-[#D9D6CF] disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
                >
                  {addingProduct
                    ? "Saving product…"
                    : editingProduct
                      ? "Save product changes"
                      : "Upload and add product"}
                </button>
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProduct(null);
                      setProductFormError("");
                      setProductFormSuccess("");
                    }}
                    className="min-h-12 rounded-full border border-white/20 px-7 text-[0.65rem] font-bold uppercase tracking-[0.16em] transition hover:bg-white/10 sm:col-span-2 sm:justify-self-start"
                  >
                    Cancel editing
                  </button>
                )}
              </form>
            </section>

            <section className="mb-12">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="section-label">Manage placement</p>
                  <h2 className="mt-2 font-display text-3xl tracking-[0.08em]">
                    {products.length} {products.length === 1 ? "PRODUCT" : "PRODUCTS"}
                  </h2>
                </div>
                <p className="text-sm text-[#D9D6CF]">
                  Existing listings are assigned to Everyday Finds by default.
                </p>
              </div>
              {products.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/20 bg-[#171717] px-6 py-10 text-center text-sm text-[#D9D6CF]">
                  No products are available to manage yet.
                </div>
              ) : (
                <div className="grid gap-3">
                  {products.map((product) => (
                    <article
                      key={product.id}
                      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-[#171717] p-4 sm:flex-row sm:items-center"
                    >
                      <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#262622]">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-semibold">{product.name}</h3>
                        <p className="mt-1 text-xs text-[#D9D6CF]">
                          {formatPrice(product.price)} · {product.category} · Stock {product.stock}
                        </p>
                        <p className="mt-2 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-[#D9D6CF]">
                          {product.collections
                            .map((collection) =>
                              collection === "everyday" ? "Everyday Finds" : "The Curated Collection",
                            )
                            .join(" + ")}
                          {product.featured ? " · Featured" : ""}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingProduct(product);
                          setProductFormError("");
                          setProductFormSuccess("");
                          document.getElementById("product-form")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }}
                        className="min-h-11 rounded-full border border-white/20 px-5 text-[0.62rem] font-bold uppercase tracking-[0.16em] transition hover:bg-white hover:text-[#111111]"
                      >
                        Edit product
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="section-label">Pending review</p>
                <h2 className="mt-2 font-display text-3xl tracking-[0.08em]">
                  {requests.length} {requests.length === 1 ? "REQUEST" : "REQUESTS"}
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#D9D6CF]">
                Approving a request makes it visible in Customer Demand and on the home page.
              </p>
            </div>

            {pageError ? (
              <div role="alert" className="rounded-2xl border border-[#8c3f38]/40 bg-[#8c3f38]/10 p-6 text-sm text-[#F5D6D1]">
                {pageError}
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/20 bg-[#171717] px-6 py-16 text-center">
                <p className="font-display text-3xl tracking-[0.08em]">ALL CAUGHT UP</p>
                <p className="mt-3 text-sm text-[#D9D6CF]">New product requests will appear here for review.</p>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {requests.map((request) => (
                  <article key={request.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#171717]">
                    <div className="relative aspect-[4/3] bg-[#262622]">
                      {request.image ? (
                        <Image
                          src={request.image}
                          alt={`Reference for ${request.name}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                          unoptimized
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center font-display text-5xl tracking-[0.1em] text-white/40">
                          S2G
                        </div>
                      )}
                    </div>
                    <div className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[0.62rem] font-bold uppercase tracking-[0.17em] text-[#D9D6CF]">
                            {request.category}
                          </p>
                          <h3 className="mt-2 text-lg font-semibold">{request.name}</h3>
                        </div>
                        <span className="shrink-0 text-sm font-bold">{formatPrice(request.budget)}</span>
                      </div>
                      <p className="text-xs leading-5 text-[#D9D6CF]">
                        {[request.brand, request.size && `Size ${request.size}`, request.colour]
                          .filter(Boolean)
                          .join(" · ") || "No preferences added"}
                      </p>
                      {request.details && (
                        <p className="whitespace-pre-wrap text-sm leading-6 text-[#D9D6CF]">
                          {request.details}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                        <span className="text-xs text-[#D9D6CF]">
                          Submitted {dateFormatter.format(new Date(request.requestedAt))}
                        </span>
                        <button
                          type="button"
                          disabled={approvingId === request.id}
                          onClick={() => void approveRequest(request)}
                          className="min-h-10 rounded-full bg-[#F5F2EC] px-5 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#111111] transition hover:bg-[#D9D6CF] disabled:opacity-60"
                        >
                          {approvingId === request.id ? "Approving…" : "Approve"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
