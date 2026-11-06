This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## MongoDB setup

The app uses the MongoDB database `shillong1` for the store catalog, newsletter signups, shopping bags, and customer product requests. Copy `.env.example` to `.env.local`, then set `MONGODB_URI` to your local or Atlas connection string. Keep credentials private and do not commit `.env.local`.

```env
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=shillong1
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-strong-admin-password
ADMIN_SESSION_SECRET=at-least-32-random-characters
```

Set the admin credentials only in `.env.local` (or your hosting provider's secret environment settings), not in source files. Generate a session secret with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Restart the dev server after changing environment variables. Sign in at `/admin` to review customer requests or upload products and their photos.

The catalog is initialized from `data/products.json` the first time the storefront loads. Catalog setup and index creation are reused for the lifetime of the MongoDB database connection. The storefront requests 12 product summaries at a time; category, search, and sort filters run in MongoDB, and full gallery and description data is fetched only when a product's quick view opens. Product images use the Next.js image optimizer for responsive delivery. Products uploaded by an admin are saved to MongoDB and appear in the home page catalog. Product photos must be JPG, PNG, or WebP and 5 MB or smaller. New customer requests are saved with `Pending` status and remain private until approved by an admin. Approved requests appear on the Customer Demand page and in the home page's Customer Demand section. MongoDB credentials are used only by server-side API routes and are never sent to the browser. Checkout is still a storefront-only preview.

For production, configure `MONGODB_URI` and `MONGODB_DB` in your hosting provider's server environment settings. The connection code reuses one MongoDB client and keeps the driver's default pool settings; monitor Atlas connection metrics as traffic grows.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
