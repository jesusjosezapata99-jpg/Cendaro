import type {
  CartLine,
  CustomerInfo,
} from "~/components/modals/pos-checkout-dialog";
import type { PosReceiptData } from "~/components/modals/pos-receipt-dialog";

export type { CartLine, CustomerInfo, PosReceiptData };

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  categoryId: string | null;
  status: string;
  imageUrl: string | null;
}

export interface CategoryItem {
  id: string;
  name: string;
}

export interface TodayStats {
  count: number;
  revenue: number;
  avgTicket: number;
}
