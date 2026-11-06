import {
  Binary,
  type Collection,
  type Db,
  type Document,
} from "mongodb";

export type CustomerRequestStatus = "Pending" | "Approved";

export type CustomerRequestDocument = Document & {
  name: string;
  category: string;
  brand: string;
  size: string;
  colour: string;
  budget: number;
  details: string;
  status: CustomerRequestStatus;
  requestedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
  hasImage: boolean;
  image: { contentType: string; data: Binary } | null;
};

const collectionsByDatabase = new WeakMap<
  Db,
  Promise<Collection<CustomerRequestDocument>>
>();

export function getCustomerRequestCollection(database: Db) {
  let collection = collectionsByDatabase.get(database);
  if (!collection) {
    collection = (async () => {
      const requests = database.collection<CustomerRequestDocument>("customerRequests");
      await requests.createIndex({ status: 1, requestedAt: -1 });
      return requests;
    })();
    collectionsByDatabase.set(database, collection);
    void collection.catch(() => collectionsByDatabase.delete(database));
  }
  return collection;
}

export function serializeCustomerRequest(document: CustomerRequestDocument) {
  const id = document._id.toString();
  return {
    id,
    name: document.name,
    category: document.category,
    brand: document.brand,
    size: document.size,
    colour: document.colour,
    budget: document.budget,
    details: document.details,
    image: document.hasImage ? `/api/customer-requests/${id}/image` : "",
    status: document.status,
    requestedAt: document.requestedAt.toISOString(),
  };
}
