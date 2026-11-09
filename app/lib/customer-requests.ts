export type CustomerRequestStatus = "Pending" | "Approved";

export type CustomerRequestRow = {
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
  image_path: string | null;
};

export function serializeCustomerRequest(document: CustomerRequestRow) {
  return {
    id: document.id,
    name: document.name,
    category: document.category,
    brand: document.brand,
    size: document.size,
    colour: document.colour,
    budget: document.budget,
    details: document.details,
    image: document.image_path ? `/api/customer-requests/${document.id}/image` : "",
    status: document.status,
    requestedAt: document.requested_at,
  };
}
