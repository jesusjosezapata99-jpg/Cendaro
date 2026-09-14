"use client";

import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";

import type { UserRole } from "@cendaro/validators";

import {
  useArParams,
  useBrandParams,
  useCategoryParams,
  useClosureParams,
  useContainerParams,
  useCustomerParams,
  useOrderParams,
  usePaymentParams,
  useProductParams,
  useQuoteParams,
  useSupplierParams,
  useUserParams,
} from "~/hooks/params";
import { useCurrentUser } from "~/hooks/use-current-user";
import { useTRPC } from "~/trpc/client";

// Dynamically import dialogs/sheets with ssr: false so heavy form bundles are only loaded when triggered
const CreateOrderDialog = dynamic(
  () =>
    import("~/components/forms/create-order").then((m) => m.CreateOrderDialog),
  { ssr: false },
);

const CreateQuoteDialog = dynamic(
  () =>
    import("~/components/forms/create-quote").then((m) => m.CreateQuoteDialog),
  { ssr: false },
);

const CreateCustomerDialog = dynamic(
  () =>
    import("~/components/forms/create-customer").then(
      (m) => m.CreateCustomerDialog,
    ),
  { ssr: false },
);

const CreateProductDialog = dynamic(
  () =>
    import("~/components/forms/create-product").then(
      (m) => m.CreateProductDialog,
    ),
  { ssr: false },
);

const RegisterPaymentDialog = dynamic(
  () =>
    import("~/components/forms/register-payment").then(
      (m) => m.RegisterPaymentDialog,
    ),
  { ssr: false },
);

const CreateContainerDialog = dynamic(
  () =>
    import("~/components/forms/create-container").then(
      (m) => m.CreateContainerDialog,
    ),
  { ssr: false },
);

const CreateUserDialog = dynamic(
  () =>
    import("~/components/forms/create-user").then((m) => m.CreateUserDialog),
  { ssr: false },
);

const EditUserDialog = dynamic(
  () => import("~/components/forms/edit-user").then((m) => m.EditUserDialog),
  { ssr: false },
);

const CreateSupplierDialog = dynamic(
  () =>
    import("~/components/forms/create-supplier").then(
      (m) => m.CreateSupplierDialog,
    ),
  { ssr: false },
);

const CreateBrandDialog = dynamic(
  () =>
    import("~/components/forms/create-brand").then((m) => m.CreateBrandDialog),
  { ssr: false },
);

const CreateCategoryDialog = dynamic(
  () =>
    import("~/components/forms/create-category").then(
      (m) => m.CreateCategoryDialog,
    ),
  { ssr: false },
);

const CreateArDialog = dynamic(
  () => import("~/components/forms/create-ar").then((m) => m.CreateArDialog),
  { ssr: false },
);

const RecordArPaymentDialog = dynamic(
  () =>
    import("~/components/forms/record-ar-payment").then(
      (m) => m.RecordArPaymentDialog,
    ),
  { ssr: false },
);

const CreateClosureDialog = dynamic(
  () =>
    import("~/components/forms/create-closure").then(
      (m) => m.CreateClosureDialog,
    ),
  { ssr: false },
);

const OrderDetailSheet = dynamic(
  () =>
    import("~/components/sheets/order-detail-sheet").then(
      (m) => m.OrderDetailSheet,
    ),
  { ssr: false },
);

const CustomerDetailSheet = dynamic(
  () =>
    import("~/components/sheets/customer-detail-sheet").then(
      (m) => m.CustomerDetailSheet,
    ),
  { ssr: false },
);

const ProductDetailSheet = dynamic(
  () =>
    import("~/components/sheets/product-detail-sheet").then(
      (m) => m.ProductDetailSheet,
    ),
  { ssr: false },
);

function EditUserWrapper({
  userId,
  open,
  onClose,
  currentUserRole,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
  currentUserRole: UserRole;
}) {
  const trpc = useTRPC();
  const { data: users } = useQuery(trpc.users.list.queryOptions());
  const user = users?.find((u) => u.id === userId);

  if (!user) return null;

  return (
    <EditUserDialog
      open={open}
      onClose={onClose}
      currentUserRole={currentUserRole}
      user={user}
    />
  );
}

function RecordArPaymentWrapper({
  arId,
  open,
  onClose,
}: {
  arId: string;
  open: boolean;
  onClose: () => void;
}) {
  const trpc = useTRPC();
  const { data: receivables } = useQuery(
    trpc.receivables.list.queryOptions({ limit: 100 }),
  );
  const receivable = receivables?.find((r) => r.id === arId) ?? null;

  return (
    <RecordArPaymentDialog
      open={open}
      onClose={onClose}
      receivable={receivable}
    />
  );
}

/**
 * GlobalSheets — Single instance mounted in AppShell (PLAN-2026-09-DESIGN-SYSTEM §T5.1).
 * Listens to domain nuqs hooks and mounts the corresponding sheet/dialog when active.
 * Closing resets the respective URL query parameter, preserving browser history.
 */
export function GlobalSheets() {
  const { profile } = useCurrentUser();
  const userRole = profile?.role ?? "employee";

  // Domain params hooks
  const [orderParams, setOrderParams] = useOrderParams();
  const [quoteParams, setQuoteParams] = useQuoteParams();
  const [customerParams, setCustomerParams] = useCustomerParams();
  const [productParams, setProductParams] = useProductParams();
  const [paymentParams, setPaymentParams] = usePaymentParams();
  const [containerParams, setContainerParams] = useContainerParams();
  const [userParams, setUserParams] = useUserParams();
  const [supplierParams, setSupplierParams] = useSupplierParams();
  const [brandParams, setBrandParams] = useBrandParams();
  const [categoryParams, setCategoryParams] = useCategoryParams();
  const [arParams, setArParams] = useArParams();
  const [closureParams, setClosureParams] = useClosureParams();

  return (
    <>
      {/* Sales: Orders */}
      {orderParams.createOrder && (
        <CreateOrderDialog
          open={orderParams.createOrder}
          onClose={() => void setOrderParams({ createOrder: false })}
        />
      )}
      {Boolean(orderParams.orderId) && (
        <OrderDetailSheet
          open={Boolean(orderParams.orderId)}
          onClose={() => void setOrderParams({ orderId: "" })}
          orderId={orderParams.orderId}
        />
      )}

      {/* Sales: Quotes */}
      {quoteParams.createQuote && (
        <CreateQuoteDialog
          open={quoteParams.createQuote}
          onClose={() => void setQuoteParams({ createQuote: false })}
        />
      )}

      {/* Sales: Customers */}
      {customerParams.createCustomer && (
        <CreateCustomerDialog
          open={customerParams.createCustomer}
          onClose={() => void setCustomerParams({ createCustomer: false })}
        />
      )}
      {Boolean(customerParams.customerId) && (
        <CustomerDetailSheet
          open={Boolean(customerParams.customerId)}
          onClose={() => void setCustomerParams({ customerId: "" })}
          customerId={customerParams.customerId}
        />
      )}

      {/* Catalog: Products */}
      {productParams.createProduct && (
        <CreateProductDialog
          open={productParams.createProduct}
          onClose={() => void setProductParams({ createProduct: false })}
        />
      )}
      {Boolean(productParams.productId) && (
        <ProductDetailSheet
          open={Boolean(productParams.productId)}
          onClose={() => void setProductParams({ productId: "" })}
          productId={productParams.productId}
        />
      )}

      {/* Payments */}
      {paymentParams.registerPayment && (
        <RegisterPaymentDialog
          open={paymentParams.registerPayment}
          onClose={() =>
            void setPaymentParams({ registerPayment: false, orderId: "" })
          }
          defaultOrderId={paymentParams.orderId || undefined}
        />
      )}

      {/* Inventory: Containers */}
      {containerParams.createContainer && (
        <CreateContainerDialog
          open={containerParams.createContainer}
          onClose={() => void setContainerParams({ createContainer: false })}
        />
      )}

      {/* Users & Roles */}
      {userParams.createUser && (
        <CreateUserDialog
          open={userParams.createUser}
          onClose={() => void setUserParams({ createUser: false })}
          currentUserRole={userRole}
        />
      )}

      {Boolean(userParams.editUser) && (
        <EditUserWrapper
          userId={userParams.editUser}
          open={Boolean(userParams.editUser)}
          onClose={() => void setUserParams({ editUser: "" })}
          currentUserRole={userRole}
        />
      )}

      {/* Catalog: Suppliers */}
      {supplierParams.createSupplier && (
        <CreateSupplierDialog
          open={supplierParams.createSupplier}
          onClose={() => void setSupplierParams({ createSupplier: false })}
        />
      )}

      {/* Catalog: Brands */}
      {brandParams.createBrand && (
        <CreateBrandDialog
          open={brandParams.createBrand}
          onClose={() => void setBrandParams({ createBrand: false })}
        />
      )}

      {/* Catalog: Categories */}
      {categoryParams.createCategory && (
        <CreateCategoryDialog
          open={categoryParams.createCategory}
          onClose={() => void setCategoryParams({ createCategory: false })}
        />
      )}

      {/* Accounts Receivable: Create Invoice */}
      {arParams.createAr && (
        <CreateArDialog
          open={arParams.createAr}
          onClose={() => void setArParams({ createAr: false })}
        />
      )}

      {/* Accounts Receivable: Record Payment */}
      {arParams.recordPayment && (
        <RecordArPaymentWrapper
          arId={arParams.arId}
          open={arParams.recordPayment}
          onClose={() => void setArParams({ recordPayment: false, arId: "" })}
        />
      )}

      {/* Treasury: Cash Closure */}
      {closureParams.createClosure && (
        <CreateClosureDialog
          open={closureParams.createClosure}
          onClose={() => void setClosureParams({ createClosure: false })}
        />
      )}
    </>
  );
}
