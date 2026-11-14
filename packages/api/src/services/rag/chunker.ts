/**
 * Cendaro — Commercial Document Hierarchical Chunker (STC)
 *
 * Implements Structure-Aware Tabular Chunking for commercial documents:
 *   • Packing Lists: Level 1 master logistics summary + Level 2 item row-groups with prepended context.
 *   • Commercial & Fiscal Invoices: Level 1 master fiscal summary + Level 2 item row-groups.
 *   • Delivery Notes: Level 1 dispatch summary + Level 2 delivery item row-groups.
 *
 * Extracts document metadata: origin, destination, accessRules (allowedRoles),
 * queryRestrictions (confidentialCosts, vendorId), and document numbers.
 */

import type {
  DocumentAccessRules,
  DocumentDestination,
  DocumentMetadata,
  DocumentNumbers,
  DocumentOrigin,
  DocumentQueryRestrictions,
  DocumentTotals,
  RagAccessRole,
  RagChunkInput,
  RagDocumentType,
} from "@cendaro/validators";

// ──────────────────────────────────────────────
// Domain Types for Structured Documents
// ──────────────────────────────────────────────

export interface PackingListHeader {
  shipper?: string;
  originPort?: string;
  originCountry?: string;
  consignee?: string;
  destinationPort?: string;
  destinationWarehouse?: string;
  containerNumber?: string;
  blNumber?: string;
  sealNumber?: string;
  vessel?: string;
  departureDate?: string;
  arrivalDate?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  totalVolumeCbm?: number;
  totalPackages?: number;
  notes?: string;
}

export interface PackingListItem {
  packageNo?: string | number;
  sku?: string;
  description: string;
  translatedName?: string;
  chineseName?: string;
  quantity: number;
  uom?: string;
  unitCostFob?: number;
  totalCostFob?: number;
  weightKg?: number;
  volumeCbm?: number;
}

export interface InvoiceHeader {
  documentType: "commercial_invoice" | "fiscal_invoice";
  invoiceNumber: string;
  controlNumber?: string;
  orderNumber?: string;
  issuerName: string;
  issuerRif: string;
  issuerAddress?: string;
  issuerPhone?: string;
  buyerName: string;
  buyerRif: string;
  buyerAddress?: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  exchangeRateBcv?: number;
  paymentTerms?: string;
  notes?: string;
}

export interface InvoiceItem {
  lineNumber: number;
  sku?: string;
  description: string;
  quantity: number;
  uom?: string;
  unitPrice: number;
  discountPercent?: number;
  taxRatePercent?: number;
  subtotal: number;
}

export interface InvoiceTotals {
  subtotal: number;
  exemptAmount?: number;
  taxableBase16?: number;
  iva16?: number;
  taxableBase8?: number;
  iva8?: number;
  igtfBase?: number;
  igtf3?: number;
  retentionIva?: number;
  retentionIslr?: number;
  totalAmount: number;
  totalAmountVes?: number;
}

export interface DeliveryNoteHeader {
  noteNumber: string;
  orderNumber?: string;
  recipientName: string;
  recipientIdDoc?: string;
  deliveryAddress: string;
  carrierName?: string;
  licensePlate?: string;
  dispatchedAt: string;
  notes?: string;
}

export interface DeliveryNoteItem {
  lineNumber: number;
  sku?: string;
  description: string;
  quantityOrdered: number;
  quantityDispatched: number;
  uom?: string;
}

// ──────────────────────────────────────────────
// Token Estimation Utility
// ──────────────────────────────────────────────

/**
 * Robust token count estimator for multilingual text (Spanish, English, Chinese).
 * Heuristic: ~4 characters per token for Latin scripts, ~1-2 characters for Asian scripts.
 */
export function estimateTokenCount(text: string): number {
  if (!text || text.trim().length === 0) return 1;
  const trimmed = text.trim();
  // Count CJK characters
  const cjkChars = (trimmed.match(/[\u4e00-\u9fa5]/g) ?? []).length;
  const otherChars = trimmed.length - cjkChars;
  const estimated = Math.ceil(otherChars / 4) + Math.ceil(cjkChars * 1.2);
  return Math.max(1, estimated);
}

// ──────────────────────────────────────────────
// Packing List Chunking
// ──────────────────────────────────────────────

export interface ChunkPackingListInput {
  header: PackingListHeader;
  items: PackingListItem[];
  vendorId?: string;
  rowsPerGroup?: number;
}

export interface ChunkDocumentResult {
  metadata: DocumentMetadata;
  chunks: RagChunkInput[];
}

/**
 * Hierarchical chunking for packing lists.
 * Level 1: Document Master Summary
 * Level 2: Tabular Row-Group Chunks with prepended context
 */
export function chunkPackingList(
  input: ChunkPackingListInput,
): ChunkDocumentResult {
  const { header, items, vendorId, rowsPerGroup = 6 } = input;
  const hasConfidentialCosts = items.some(
    (item) =>
      (item.unitCostFob !== undefined && item.unitCostFob > 0) ||
      (item.totalCostFob !== undefined && item.totalCostFob > 0),
  );

  const allowedRoles: RagAccessRole[] = hasConfidentialCosts
    ? ["owner", "admin", "supervisor"]
    : ["owner", "admin", "supervisor", "employee"];

  const origin: DocumentOrigin = {
    shipper: header.shipper,
    entityName: header.shipper,
    country: header.originCountry,
    port: header.originPort,
  };

  const destination: DocumentDestination = {
    consignee: header.consignee,
    country: header.originCountry ? "Venezuela" : undefined,
    port: header.destinationPort,
    warehouse: header.destinationWarehouse,
  };

  const documentNumbers: DocumentNumbers = {
    containerNumber: header.containerNumber,
    blNumber: header.blNumber,
    documentNumber: header.containerNumber ?? header.blNumber,
  };

  const accessRules: DocumentAccessRules = {
    allowedRoles,
    restrictedFields: hasConfidentialCosts
      ? ["unitCostFob", "totalCostFob", "costFob"]
      : [],
  };

  const queryRestrictions: DocumentQueryRestrictions = {
    vendorId,
    confidentialCosts: hasConfidentialCosts,
  };

  const totalCostFobSum = items.reduce(
    (acc, it) =>
      acc +
      (it.totalCostFob ?? (it.unitCostFob ? it.unitCostFob * it.quantity : 0)),
    0,
  );

  const totals: DocumentTotals = {
    totalPackages: header.totalPackages ?? items.length,
    totalWeightKg:
      header.grossWeightKg ??
      items.reduce((acc, it) => acc + (it.weightKg ?? 0), 0),
    totalVolumeCbm:
      header.totalVolumeCbm ??
      items.reduce((acc, it) => acc + (it.volumeCbm ?? 0), 0),
    totalItems: items.length,
    totalAmount: totalCostFobSum > 0 ? totalCostFobSum : undefined,
    currency: "USD",
  };

  const metadata: DocumentMetadata = {
    origin,
    destination,
    accessRules,
    queryRestrictions,
    documentNumbers,
    totals,
    containerNumber: header.containerNumber,
    blNumber: header.blNumber,
    totalAmount: totals.totalAmount,
    currency: "USD",
    notes: header.notes,
  };

  const chunks: RagChunkInput[] = [];

  // ── Level 1: Document Master Summary Chunk ──────────────────
  const summaryLines: string[] = [
    `[RESUMEN DE DOCUMENTO: PACKING LIST LOGÍSTICO]`,
    `- Contenedor: ${header.containerNumber ?? "N/D"} | B/L (Bill of Lading): ${header.blNumber ?? "N/D"}${header.sealNumber ? ` | Precinto: ${header.sealNumber}` : ""}`,
    `- Embarcador / Origen: ${header.shipper ?? "N/D"}${header.originPort ? ` (Puerto: ${header.originPort}${header.originCountry ? `, ${header.originCountry}` : ""})` : ""}`,
    `- Consignatario / Destino: ${header.consignee ?? "Cendaro C.A."}${header.destinationPort ? ` (Puerto: ${header.destinationPort})` : ""}${header.destinationWarehouse ? ` | Almacén: ${header.destinationWarehouse}` : ""}`,
    `- Fechas: Zarpe/Salida: ${header.departureDate ?? "N/D"} | Llegada estimada: ${header.arrivalDate ?? "N/D"}`,
    `- Totales: Bultos: ${totals.totalPackages ?? items.length} | Peso Bruto: ${totals.totalWeightKg ?? "N/D"} kg | Volumen: ${totals.totalVolumeCbm ?? "N/D"} CBM`,
    `- Total Renglones: ${items.length} productos / referencias`,
  ];
  if (header.vessel) {
    summaryLines.push(`- Buque / Transporte: ${header.vessel}`);
  }
  if (totalCostFobSum > 0) {
    summaryLines.push(
      `- Valor Total FOB Estimado: $${totalCostFobSum.toFixed(2)} USD`,
    );
  }
  if (header.notes) {
    summaryLines.push(`- Notas: ${header.notes}`);
  }

  const summaryContent = summaryLines.join("\n");
  chunks.push({
    chunkIndex: 0,
    chunkType: "document_summary",
    content: summaryContent,
    tokenCount: estimateTokenCount(summaryContent),
    metadata: {
      isMasterSummary: true,
      containerNumber: header.containerNumber,
      blNumber: header.blNumber,
      totalItems: items.length,
      accessRoles: allowedRoles,
      confidentialCosts: hasConfidentialCosts,
    },
  });

  // ── Level 2: Tabular Row-Group Chunks with Prepended Context ──
  const masterContextTag = `[DOCUMENTO: Packing List | Contenedor: ${header.containerNumber ?? "N/D"} | BL: ${header.blNumber ?? "N/D"} | Origen: ${header.originPort ?? header.shipper ?? "Exterior"} | Destino: ${header.destinationWarehouse ?? header.destinationPort ?? "Venezuela"}]`;

  for (let i = 0; i < items.length; i += rowsPerGroup) {
    const groupItems = items.slice(i, i + rowsPerGroup);
    const groupLines: string[] = [masterContextTag];
    const groupSkus: string[] = [];

    groupItems.forEach((item, idx) => {
      const rowNum = i + idx + 1;
      if (item.sku) groupSkus.push(item.sku);

      let itemLine = `- Fila ${rowNum} | Bulto: ${item.packageNo ?? rowNum} | SKU: ${item.sku ?? "S/C"} | ${item.description}`;
      if (item.translatedName) {
        itemLine += ` (ES: ${item.translatedName})`;
      }
      if (item.chineseName) {
        itemLine += ` (ZH: ${item.chineseName})`;
      }
      itemLine += ` | Cant: ${item.quantity} ${item.uom ?? "UNID"}`;
      if (item.unitCostFob !== undefined) {
        itemLine += ` | P.Unit FOB: $${item.unitCostFob.toFixed(2)}`;
      }
      if (item.totalCostFob !== undefined) {
        itemLine += ` | Total FOB: $${item.totalCostFob.toFixed(2)}`;
      }
      if (item.weightKg !== undefined) {
        itemLine += ` | Peso: ${item.weightKg} kg`;
      }
      if (item.volumeCbm !== undefined) {
        itemLine += ` | CBM: ${item.volumeCbm}`;
      }
      groupLines.push(itemLine);
    });

    const chunkContent = groupLines.join("\n");
    chunks.push({
      chunkIndex: chunks.length,
      chunkType: "row_group",
      content: chunkContent,
      tokenCount: estimateTokenCount(chunkContent),
      metadata: {
        itemRange: [i + 1, i + groupItems.length],
        skus: groupSkus,
        containerNumber: header.containerNumber,
        blNumber: header.blNumber,
        accessRoles: allowedRoles,
        confidentialCosts: hasConfidentialCosts,
      },
    });
  }

  return { metadata, chunks };
}

// ──────────────────────────────────────────────
// Invoice Chunking (Commercial & Fiscal / SENIAT)
// ──────────────────────────────────────────────

export interface ChunkInvoiceInput {
  header: InvoiceHeader;
  items: InvoiceItem[];
  totals: InvoiceTotals;
  customerId?: string;
  vendorId?: string;
  rowsPerGroup?: number;
}

/**
 * Hierarchical chunking for Commercial and Fiscal Invoices.
 * Level 1: Master summary (parties, RIF, control/invoice numbers, dates, fiscal totals, retentions)
 * Level 2: Tabular row-groups with prepended document and parties context
 */
export function chunkInvoice(input: ChunkInvoiceInput): ChunkDocumentResult {
  const {
    header,
    items,
    totals,
    customerId,
    vendorId,
    rowsPerGroup = 6,
  } = input;
  const isFiscal = header.documentType === "fiscal_invoice";

  const allowedRoles: RagAccessRole[] = [
    "owner",
    "admin",
    "supervisor",
    "employee",
  ];

  const origin: DocumentOrigin = {
    entityName: header.issuerName,
    rif: header.issuerRif,
    address: header.issuerAddress,
  };

  const destination: DocumentDestination = {
    buyerName: header.buyerName,
    rif: header.buyerRif,
    address: header.buyerAddress,
  };

  const documentNumbers: DocumentNumbers = {
    documentNumber: header.invoiceNumber,
    invoiceNumber: header.invoiceNumber,
    controlNumber: header.controlNumber,
    orderNumber: header.orderNumber,
  };

  const accessRules: DocumentAccessRules = {
    allowedRoles,
    restrictedFields: [],
  };

  const queryRestrictions: DocumentQueryRestrictions = {
    customerId,
    vendorId,
    confidentialCosts: false,
  };

  const docTotals: DocumentTotals = {
    subtotal: totals.subtotal,
    tax: (totals.iva16 ?? 0) + (totals.iva8 ?? 0),
    totalAmount: totals.totalAmount,
    currency: header.currency,
    totalItems: items.length,
  };

  const metadata: DocumentMetadata = {
    origin,
    destination,
    accessRules,
    queryRestrictions,
    documentNumbers,
    totals: docTotals,
    invoiceNumber: header.invoiceNumber,
    controlNumber: header.controlNumber,
    orderNumber: header.orderNumber,
    totalAmount: totals.totalAmount,
    currency: header.currency,
    notes: header.notes,
  };

  const chunks: RagChunkInput[] = [];

  // ── Level 1: Document Master Summary Chunk ──────────────────
  const summaryLines: string[] = [
    `[RESUMEN DE DOCUMENTO: ${isFiscal ? "FACTURA FISCAL SENIAT" : "FACTURA COMERCIAL"}]`,
    `- Factura N°: ${header.invoiceNumber}${header.controlNumber ? ` | N° de Control: ${header.controlNumber}` : ""}${header.orderNumber ? ` | Pedido N°: ${header.orderNumber}` : ""}`,
    `- Emisor: ${header.issuerName} | RIF: ${header.issuerRif}${header.issuerAddress ? ` | Dir: ${header.issuerAddress}` : ""}`,
    `- Cliente / Receptor: ${header.buyerName} | RIF/CI: ${header.buyerRif}${header.buyerAddress ? ` | Dir: ${header.buyerAddress}` : ""}`,
    `- Fechas: Emisión: ${header.issueDate}${header.dueDate ? ` | Vencimiento: ${header.dueDate}` : ""}`,
    `- Moneda: ${header.currency}${header.exchangeRateBcv ? ` | Tasa de Cambio BCV: ${header.exchangeRateBcv.toFixed(4)} VES/USD` : ""}`,
    `- Detalle Financiero:`,
    `  * Subtotal: $${totals.subtotal.toFixed(2)}`,
  ];

  if (totals.exemptAmount !== undefined && totals.exemptAmount > 0) {
    summaryLines.push(`  * Monto Exento: $${totals.exemptAmount.toFixed(2)}`);
  }
  if (totals.taxableBase16 !== undefined && totals.taxableBase16 > 0) {
    summaryLines.push(
      `  * Base Imponible 16%: $${totals.taxableBase16.toFixed(2)} | IVA (16%): $${(totals.iva16 ?? 0).toFixed(2)}`,
    );
  }
  if (totals.taxableBase8 !== undefined && totals.taxableBase8 > 0) {
    summaryLines.push(
      `  * Base Imponible 8%: $${totals.taxableBase8.toFixed(2)} | IVA (8%): $${(totals.iva8 ?? 0).toFixed(2)}`,
    );
  }
  if (totals.igtf3 !== undefined && totals.igtf3 > 0) {
    summaryLines.push(
      `  * Base IGTF (3%): $${(totals.igtfBase ?? 0).toFixed(2)} | IGTF Percibido: $${totals.igtf3.toFixed(2)}`,
    );
  }
  if (totals.retentionIva !== undefined && totals.retentionIva > 0) {
    summaryLines.push(
      `  * Comprobante Retención IVA: -$${totals.retentionIva.toFixed(2)}`,
    );
  }
  if (totals.retentionIslr !== undefined && totals.retentionIslr > 0) {
    summaryLines.push(
      `  * Comprobante Retención ISLR: -$${totals.retentionIslr.toFixed(2)}`,
    );
  }

  summaryLines.push(
    `  * MONTO TOTAL: $${totals.totalAmount.toFixed(2)} ${header.currency}`,
  );
  if (totals.totalAmountVes !== undefined) {
    summaryLines.push(
      `  * Equivalente en Bolívares (VES): Bs. ${totals.totalAmountVes.toFixed(2)}`,
    );
  }
  summaryLines.push(`- Total Renglones: ${items.length} productos facturados`);
  if (header.paymentTerms) {
    summaryLines.push(`- Condiciones de Pago: ${header.paymentTerms}`);
  }
  if (header.notes) {
    summaryLines.push(`- Notas: ${header.notes}`);
  }

  const summaryContent = summaryLines.join("\n");
  chunks.push({
    chunkIndex: 0,
    chunkType: "document_summary",
    content: summaryContent,
    tokenCount: estimateTokenCount(summaryContent),
    metadata: {
      isMasterSummary: true,
      invoiceNumber: header.invoiceNumber,
      controlNumber: header.controlNumber,
      issuerRif: header.issuerRif,
      buyerRif: header.buyerRif,
      totalAmount: totals.totalAmount,
      currency: header.currency,
      accessRoles: allowedRoles,
    },
  });

  // ── Level 2: Tabular Row-Group Chunks with Prepended Context ──
  const masterContextTag = `[DOCUMENTO: ${isFiscal ? "Factura Fiscal" : "Factura"} #${header.invoiceNumber}${header.controlNumber ? ` | Control: ${header.controlNumber}` : ""} | Emisor: ${header.issuerName} (${header.issuerRif}) | Cliente: ${header.buyerName} (${header.buyerRif}) | Fecha: ${header.issueDate}]`;

  for (let i = 0; i < items.length; i += rowsPerGroup) {
    const groupItems = items.slice(i, i + rowsPerGroup);
    const groupLines: string[] = [masterContextTag];
    const groupSkus: string[] = [];

    groupItems.forEach((item) => {
      if (item.sku) groupSkus.push(item.sku);
      let lineText = `- Renglón ${item.lineNumber} | SKU: ${item.sku ?? "S/C"} | ${item.description} | Cant: ${item.quantity} ${item.uom ?? "UND"} | P.Unit: $${item.unitPrice.toFixed(2)}`;
      if (item.discountPercent !== undefined && item.discountPercent > 0) {
        lineText += ` | Desc: ${item.discountPercent}%`;
      }
      if (item.taxRatePercent !== undefined) {
        lineText += ` | IVA: ${item.taxRatePercent}%`;
      }
      lineText += ` | Subtotal: $${item.subtotal.toFixed(2)}`;
      groupLines.push(lineText);
    });

    const chunkContent = groupLines.join("\n");
    chunks.push({
      chunkIndex: chunks.length,
      chunkType: "row_group",
      content: chunkContent,
      tokenCount: estimateTokenCount(chunkContent),
      metadata: {
        itemRange: [
          items[i]?.lineNumber ?? i + 1,
          items[i + groupItems.length - 1]?.lineNumber ?? i + groupItems.length,
        ],
        skus: groupSkus,
        invoiceNumber: header.invoiceNumber,
        controlNumber: header.controlNumber,
        issuerRif: header.issuerRif,
        buyerRif: header.buyerRif,
        accessRoles: allowedRoles,
      },
    });
  }

  return { metadata, chunks };
}

// ──────────────────────────────────────────────
// Delivery Note Chunking
// ──────────────────────────────────────────────

export interface ChunkDeliveryNoteInput {
  header: DeliveryNoteHeader;
  items: DeliveryNoteItem[];
  vendorId?: string;
  rowsPerGroup?: number;
}

export function chunkDeliveryNote(
  input: ChunkDeliveryNoteInput,
): ChunkDocumentResult {
  const { header, items, vendorId, rowsPerGroup = 6 } = input;
  const allowedRoles: RagAccessRole[] = [
    "owner",
    "admin",
    "supervisor",
    "employee",
  ];

  const destination: DocumentDestination = {
    buyerName: header.recipientName,
    address: header.deliveryAddress,
  };

  const documentNumbers: DocumentNumbers = {
    deliveryNoteNumber: header.noteNumber,
    documentNumber: header.noteNumber,
    orderNumber: header.orderNumber,
  };

  const metadata: DocumentMetadata = {
    destination,
    documentNumbers,
    accessRules: { allowedRoles },
    queryRestrictions: { vendorId, confidentialCosts: false },
    totals: { totalItems: items.length, currency: "USD" },
    orderNumber: header.orderNumber,
    notes: header.notes,
  };

  const chunks: RagChunkInput[] = [];

  const summaryContent = [
    `[RESUMEN DE DOCUMENTO: NOTA DE ENTREGA / DESPACHO]`,
    `- Nota de Entrega N°: ${header.noteNumber}${header.orderNumber ? ` | Pedido Asociado: ${header.orderNumber}` : ""}`,
    `- Receptor: ${header.recipientName}${header.recipientIdDoc ? ` | Cédula/RIF: ${header.recipientIdDoc}` : ""}`,
    `- Dirección de Entrega: ${header.deliveryAddress}`,
    `- Despacho: Fecha: ${header.dispatchedAt}${header.carrierName ? ` | Transportista: ${header.carrierName}` : ""}${header.licensePlate ? ` | Placa: ${header.licensePlate}` : ""}`,
    `- Total Renglones a Despachar: ${items.length} productos`,
  ].join("\n");

  chunks.push({
    chunkIndex: 0,
    chunkType: "document_summary",
    content: summaryContent,
    tokenCount: estimateTokenCount(summaryContent),
    metadata: {
      isMasterSummary: true,
      noteNumber: header.noteNumber,
      orderNumber: header.orderNumber,
      accessRoles: allowedRoles,
    },
  });

  const masterContextTag = `[DOCUMENTO: Nota de Entrega #${header.noteNumber} | Receptor: ${header.recipientName} | Fecha: ${header.dispatchedAt}]`;

  for (let i = 0; i < items.length; i += rowsPerGroup) {
    const groupItems = items.slice(i, i + rowsPerGroup);
    const groupLines: string[] = [masterContextTag];
    const groupSkus: string[] = [];

    groupItems.forEach((item) => {
      if (item.sku) groupSkus.push(item.sku);
      groupLines.push(
        `- Renglón ${item.lineNumber} | SKU: ${item.sku ?? "S/C"} | ${item.description} | Despachado: ${item.quantityDispatched} de ${item.quantityOrdered} ${item.uom ?? "UND"}`,
      );
    });

    const chunkContent = groupLines.join("\n");
    chunks.push({
      chunkIndex: chunks.length,
      chunkType: "row_group",
      content: chunkContent,
      tokenCount: estimateTokenCount(chunkContent),
      metadata: {
        itemRange: [
          items[i]?.lineNumber ?? i + 1,
          items[i + groupItems.length - 1]?.lineNumber ?? i + groupItems.length,
        ],
        skus: groupSkus,
        noteNumber: header.noteNumber,
        accessRoles: allowedRoles,
      },
    });
  }

  return { metadata, chunks };
}

// ──────────────────────────────────────────────
// Raw Commercial Document Parsing & Chunking Fallback
// ──────────────────────────────────────────────

export interface ParseRawDocumentOptions {
  documentType: RagDocumentType;
  documentNumber?: string;
  title?: string;
  vendorId?: string;
  maxChunkSizeChars?: number;
}

/**
 * Robust structure-aware chunker for raw text/markdown documents.
 * Extracts Venezuelan RIFs, control numbers, container numbers, and separates headers from tables/sections.
 */
export function chunkRawCommercialDocument(
  rawText: string,
  options: ParseRawDocumentOptions,
): ChunkDocumentResult {
  const {
    documentType,
    documentNumber,
    vendorId,
    maxChunkSizeChars = 1200,
  } = options;
  const lines = rawText.split(/\r?\n/).map((l) => l.trimEnd());

  // Extract common commercial identifiers via regex
  const rifRegex = /\b[JVGEPC]-\d{8}-\d\b/gi;
  const controlRegex = /\b00-\d{6,8}\b/gi;
  const containerRegex = /\b[A-Z]{4}\d{7}\b/g;
  const invoiceRegex =
    /(?:factura|invoice|fac|nro|n°|num)[.:\s#]*([A-Z0-9-]{3,20})/i;

  const rifs = Array.from(new Set(rawText.match(rifRegex) ?? []));
  const controlNumbers = Array.from(new Set(rawText.match(controlRegex) ?? []));
  const containerNumbers = Array.from(
    new Set(rawText.match(containerRegex) ?? []),
  );
  const invoiceMatch = invoiceRegex.exec(rawText);

  const resolvedDocNumber =
    documentNumber ??
    invoiceMatch?.[1] ??
    containerNumbers[0] ??
    controlNumbers[0] ??
    "DOC-" + Math.random().toString(36).substring(2, 8).toUpperCase();

  const isConfidential =
    documentType === "packing_list" &&
    /\b(fob|costo|cost|unit cost|costo unitario)\b/i.test(rawText);

  const allowedRoles: RagAccessRole[] = isConfidential
    ? ["owner", "admin", "supervisor"]
    : ["owner", "admin", "supervisor", "employee"];

  const origin: DocumentOrigin = {
    rif: rifs[0],
    entityName: lines[0] ?? undefined,
  };

  const destination: DocumentDestination = {
    rif: rifs.length > 1 ? rifs[1] : undefined,
  };

  const documentNumbers: DocumentNumbers = {
    documentNumber: resolvedDocNumber,
    controlNumber: controlNumbers[0],
    containerNumber: containerNumbers[0],
    invoiceNumber: documentType.includes("invoice")
      ? resolvedDocNumber
      : undefined,
  };

  const metadata: DocumentMetadata = {
    origin,
    destination,
    documentNumbers,
    accessRules: { allowedRoles },
    queryRestrictions: { vendorId, confidentialCosts: isConfidential },
    controlNumber: controlNumbers[0],
    containerNumber: containerNumbers[0],
    invoiceNumber: documentType.includes("invoice")
      ? resolvedDocNumber
      : undefined,
  };

  const chunks: RagChunkInput[] = [];

  // Group paragraphs or tabular lines
  const paragraphs: string[] = [];
  let currentPara: string[] = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (currentPara.length > 0) {
        paragraphs.push(currentPara.join("\n"));
        currentPara = [];
      }
    } else {
      currentPara.push(line);
    }
  }
  if (currentPara.length > 0) {
    paragraphs.push(currentPara.join("\n"));
  }

  // Create Master Header Chunk from first paragraph(s)
  const headerPara = paragraphs[0] ?? rawText.substring(0, 500);
  const masterTag = `[DOCUMENTO: ${documentType.toUpperCase()} | Identificador: ${resolvedDocNumber}${controlNumbers[0] ? ` | Control: ${controlNumbers[0]}` : ""}${rifs[0] ? ` | RIF: ${rifs[0]}` : ""}]`;

  const summaryContent = `${masterTag}\n${headerPara}`;
  chunks.push({
    chunkIndex: 0,
    chunkType: "document_summary",
    content: summaryContent,
    tokenCount: estimateTokenCount(summaryContent),
    metadata: {
      isMasterSummary: true,
      documentNumber: resolvedDocNumber,
      controlNumber: controlNumbers[0],
      rifs,
      accessRoles: allowedRoles,
      confidentialCosts: isConfidential,
    },
  });

  // Level 2 chunks: chunk remaining paragraphs or lines with context tag
  let currentChunkText = "";
  const remainingParas = paragraphs.slice(1);

  for (const para of remainingParas) {
    if (
      currentChunkText.length + para.length > maxChunkSizeChars &&
      currentChunkText.length > 0
    ) {
      const fullChunkContent = `${masterTag}\n${currentChunkText.trim()}`;
      chunks.push({
        chunkIndex: chunks.length,
        chunkType: "row_group",
        content: fullChunkContent,
        tokenCount: estimateTokenCount(fullChunkContent),
        metadata: {
          documentNumber: resolvedDocNumber,
          accessRoles: allowedRoles,
          confidentialCosts: isConfidential,
        },
      });
      currentChunkText = "";
    }
    currentChunkText += (currentChunkText ? "\n\n" : "") + para;
  }

  if (currentChunkText.trim().length > 0) {
    const fullChunkContent = `${masterTag}\n${currentChunkText.trim()}`;
    chunks.push({
      chunkIndex: chunks.length,
      chunkType: "row_group",
      content: fullChunkContent,
      tokenCount: estimateTokenCount(fullChunkContent),
      metadata: {
        documentNumber: resolvedDocNumber,
        accessRoles: allowedRoles,
        confidentialCosts: isConfidential,
      },
    });
  }

  return { metadata, chunks };
}
