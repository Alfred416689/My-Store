import type { ProductCollection } from "@/app/lib/catalog";
import type { CustomerRequestStatus } from "@/app/lib/customer-requests";

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      products: Table<
        {
          id: number;
          name: string;
          price: number;
          compare_at_price: number | null;
          category: string;
          collections: ProductCollection[];
          featured: boolean;
          condition: string;
          sizes: string[];
          image: string;
          gallery: string[];
          image_path: string | null;
          description: string;
          stock: number;
          badge: string | null;
        },
        {
          id?: number;
          name: string;
          price: number;
          compare_at_price?: number | null;
          category: string;
          collections: ProductCollection[];
          featured: boolean;
          condition: string;
          sizes: string[];
          image: string;
          gallery: string[];
          image_path?: string | null;
          description: string;
          stock: number;
          badge?: string | null;
        },
        Partial<{
          name: string;
          price: number;
          compare_at_price: number | null;
          category: string;
          collections: ProductCollection[];
          featured: boolean;
          condition: string;
          sizes: string[];
          image: string;
          gallery: string[];
          image_path: string | null;
          description: string;
          stock: number;
          badge: string | null;
        }>
      >;
      customer_requests: Table<
        {
          id: string;
          name: string;
          category: string;
          brand: string;
          size: string;
          colour: string;
          budget: number;
          details: string;
          status: CustomerRequestStatus;
          requested_at: string;
          approved_at: string | null;
          approved_by: string | null;
          image_path: string | null;
        },
        {
          id?: string;
          name: string;
          category: string;
          brand?: string;
          size?: string;
          colour?: string;
          budget: number;
          details?: string;
          status?: CustomerRequestStatus;
          requested_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          image_path?: string | null;
        },
        Partial<{
          name: string;
          category: string;
          brand: string;
          size: string;
          colour: string;
          budget: number;
          details: string;
          status: CustomerRequestStatus;
          requested_at: string;
          approved_at: string | null;
          approved_by: string | null;
          image_path: string | null;
        }>
      >;
      newsletter_subscribers: Table<
        { email_normalized: string; email: string; subscribed_at: string },
        { email_normalized: string; email: string; subscribed_at?: string },
        Partial<{ email_normalized: string; email: string; subscribed_at: string }>
      >;
      shopping_carts: Table<
        { session_id: string; items: unknown; updated_at: string; expires_at: string },
        { session_id: string; items: unknown; updated_at?: string; expires_at: string },
        Partial<{ items: unknown; updated_at: string; expires_at: string }>
      >;
    };
    Views: Record<string, never>;
    Functions: {
      prune_expired_shopping_carts: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
