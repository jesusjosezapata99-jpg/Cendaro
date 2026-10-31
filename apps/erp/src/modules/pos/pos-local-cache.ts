"use client";

import type { CartLine, ProductItem } from "./types";

const DB_NAME = "cendaro_pos_local_v1";
const DB_VERSION = 2;
const STORE_PRODUCTS = "products";
const STORE_STOCK = "stock";
const STORE_META = "meta";
const STORE_OFFLINE_QUEUE = "offline_queue";

export interface OfflinePosSalePayload {
  idempotencyKey: string;
  customerId?: string;
  customerName: string;
  customerIdentification?: string;
  items: {
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }[];
  payments: {
    method: "cash" | "mobile_payment" | "pos_terminal" | "transfer" | "zelle";
    amount: number;
    currency: "USD" | "VES";
    amountBs?: number;
    reference?: string;
    bankName?: string;
  }[];
  subtotal: number;
  discount: number;
  total: number;
  changeUsd: number;
  changeBs: number;
  bcvRate: number;
  createdAt: string;
}

interface StockRecord {
  id: string;
  storeStock: number;
}

interface MetaRecord {
  key: string;
  value: unknown;
}

function openPosDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
          const prodStore = db.createObjectStore(STORE_PRODUCTS, {
            keyPath: "id",
          });
          prodStore.createIndex("by_sku", "skuLower", { unique: false });
          prodStore.createIndex("by_barcode", "barcodeLower", {
            unique: false,
          });
        }
        if (!db.objectStoreNames.contains(STORE_STOCK)) {
          db.createObjectStore(STORE_STOCK, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_OFFLINE_QUEUE)) {
          db.createObjectStore(STORE_OFFLINE_QUEUE, {
            keyPath: "idempotencyKey",
          });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function syncPosCatalogCache(
  products: readonly ProductItem[],
): Promise<void> {
  if (products.length === 0) return;
  const db = await openPosDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_PRODUCTS, "readwrite");
      const store = tx.objectStore(STORE_PRODUCTS);
      for (const p of products) {
        store.put({
          ...p,
          skuLower: p.sku.trim().toLowerCase(),
          barcodeLower: p.barcode ? p.barcode.trim().toLowerCase() : "",
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadPosCatalogCache(): Promise<ProductItem[]> {
  const db = await openPosDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PRODUCTS, "readonly");
      const store = tx.objectStore(STORE_PRODUCTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = req.result as ProductItem[];
        resolve(rows);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

/**
 * Instant (<2ms) local IndexedDB barcode/SKU lookup so laser/USB barcode
 * scanners never drop a scan while waiting for network debounce.
 */
export async function lookupPosProductByCode(
  rawCode: string,
): Promise<ProductItem | null> {
  const code = rawCode.trim().toLowerCase();
  if (!code) return null;
  const db = await openPosDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_PRODUCTS, "readonly");
      const store = tx.objectStore(STORE_PRODUCTS);
      const barcodeIdx = store.index("by_barcode");
      const barcodeReq = barcodeIdx.get(code);
      barcodeReq.onsuccess = () => {
        if (barcodeReq.result) {
          resolve(barcodeReq.result as ProductItem);
          return;
        }
        const skuIdx = store.index("by_sku");
        const skuReq = skuIdx.get(code);
        skuReq.onsuccess = () =>
          resolve((skuReq.result as ProductItem | undefined) ?? null);
        skuReq.onerror = () => resolve(null);
      };
      barcodeReq.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function syncPosStockCache(
  rows: readonly StockRecord[],
): Promise<void> {
  if (rows.length === 0) return;
  const db = await openPosDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_STOCK, "readwrite");
      const store = tx.objectStore(STORE_STOCK);
      for (const r of rows) {
        store.put({ id: r.id, storeStock: r.storeStock });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadPosStockCache(): Promise<StockRecord[]> {
  const db = await openPosDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_STOCK, "readonly");
      const store = tx.objectStore(STORE_STOCK);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as StockRecord[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function saveActivePosCart(cart: CartLine[]): Promise<void> {
  const db = await openPosDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_META, "readwrite");
      const store = tx.objectStore(STORE_META);
      const record: MetaRecord = { key: "active_cart", value: cart };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadActivePosCart(): Promise<CartLine[]> {
  const db = await openPosDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, "readonly");
      const store = tx.objectStore(STORE_META);
      const req = store.get("active_cart");
      req.onsuccess = () => {
        const res = req.result as MetaRecord | undefined;
        resolve(Array.isArray(res?.value) ? (res.value as CartLine[]) : []);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function enqueueOfflinePosSale(
  sale: OfflinePosSalePayload,
): Promise<void> {
  const db = await openPosDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_OFFLINE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_OFFLINE_QUEUE);
      store.put(sale);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function loadOfflinePosQueue(): Promise<OfflinePosSalePayload[]> {
  const db = await openPosDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_OFFLINE_QUEUE, "readonly");
      const store = tx.objectStore(STORE_OFFLINE_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as OfflinePosSalePayload[]);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function removeOfflinePosSale(
  idempotencyKey: string,
): Promise<void> {
  const db = await openPosDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_OFFLINE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_OFFLINE_QUEUE);
      store.delete(idempotencyKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
