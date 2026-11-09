# S2G

## Supabase setup

The app uses Supabase Postgres for products, customer requests, newsletter signups, and shopping bags. Supabase Storage keeps uploaded product and request images in a private bucket; app API routes serve images according to their visibility. Admin sign-in uses Supabase Auth and is restricted to `ADMIN_EMAIL`.

1. In the Supabase dashboard, open **Project Settings → API Keys** and copy the project URL, publishable key, and service-role key.
2. Copy `.env.example` to `.env.local` and set the values below. Never expose or commit `SUPABASE_SERVICE_ROLE_KEY`; it is used only by server-side API routes.
3. In **SQL Editor**, run `supabase/migrations/20261108200000_initial_schema.sql`. This creates the tables and private storage bucket and seeds the six starter products.
4. In **Authentication → Users**, create the admin user, then set `ADMIN_EMAIL` to that account's email in `.env.local`.
5. Restart the development server after changing environment variables. Sign in at `/admin`.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-service-role-key
ADMIN_EMAIL=your-admin-email
```

The storefront requests 12 product summaries at a time; category, search, and sort filters run in Supabase, and full gallery and description data is fetched only when a product's quick view opens. Product images use the Next.js image optimizer for responsive delivery. Products uploaded by an admin are stored in the private Supabase bucket and appear in the storefront. Product photos must be JPG, PNG, or WebP and 5 MB or smaller. New customer requests are saved with `Pending` status and remain private until approved by an admin. Approved requests appear on the Customer Demand page and in the home page's Customer Demand section. Database access and Storage uploads use the service-role key only on the server. Checkout is still a storefront-only preview.

For production, configure the same environment variables in your hosting provider's secret settings. Do not add a `NEXT_PUBLIC_` prefix to the service-role key.

## Local development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.
