/**
 * Cendaro ERP — RAG System & Commercial Document Processing Test Suite
 *
 * Comprehensive Vitest unit and integration tests covering:
 *   1. Document Ingestion & Structure-Aware Tabular Chunking (STC)
 *      - Packing List: Level 1 master summary & Level 2 row-groups with prepended context tags
 *      - Commercial & SENIAT Fiscal Invoices: Level 1 fiscal summary & Level 2 item row-groups
 *      - Delivery Notes: Level 1 dispatch summary & Level 2 item row-groups
 *      - Raw commercial document parser with regex extraction (RIFs, control numbers, containers)
 *      - Full metadata extraction (origin, destination, document numbers, totals, currency)
 *   2. Embedding Generation & Vector Math
 *      - Exact 1,536 dimensions
 *      - L2 Euclidean normalization (||v||₂ ≈ 1.0)
 *      - Semantic proximity (identical & related texts vs unrelated texts)
 *      - Typo resilience (subword trigrams) & multilingual token support
 *   3. Access Control & Role-Based Query Restrictions
 *      - `allowedRoles` enforcement (management vs employee/vendor/marketing)
 *      - Vendor query isolation (restricted vendor ID scoping)
 *      - Confidential cost redaction (unit FOB, total FOB, master totals, sanitized metadata)
 *   4. Input Validation & Edge Cases
 *      - Zod schema validation (search and ingest inputs)
 *      - Boundary checks (limits, score thresholds, empty inputs)
 *      - Chunker edge cases (empty items, missing fields, token estimation)
 *   5. Integration: Search & Ingestion Services and tRPC Router
 *      - Ingestion pipeline with automatic embedding calculation
 *      - Search retrieval with pgvector cosine distance simulation
 *      - `ragRouter` procedures authorization and execution
 */

import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { RagAccessRole, RagDocumentType } from "@cendaro/validators";
import {
  ragIngestInputSchema,
  ragSearchInputSchema,
} from "@cendaro/validators";

import type {
  ChunkDeliveryNoteInput,
  ChunkInvoiceInput,
  ChunkPackingListInput,
} from "../../src/services/rag/chunker";
import type { RagIngestContext } from "../../src/services/rag/ingest";
import type { RagSearchContext } from "../../src/services/rag/search";
import { logger } from "../../src/logger";
import { ragRouter } from "../../src/routers/rag";
import {
  chunkDeliveryNote,
  chunkInvoice,
  chunkPackingList,
  chunkRawCommercialDocument,
  estimateTokenCount,
} from "../../src/services/rag/chunker";
import {
  cosineSimilarity,
  EMBEDDING_DIMENSIONS,
  generateDeterministicEmbedding,
  generateEmbedding,
  generateEmbeddings,
} from "../../src/services/rag/embeddings";
import {
  ingestDocument,
  ingestInvoice,
  ingestPackingList,
  ingestRawDocument,
} from "../../src/services/rag/ingest";
import { searchRagChunks } from "../../src/services/rag/search";
import { createCallerFactory, createTRPCRouter } from "../../src/trpc";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures & Mock Database Utilities
// ─────────────────────────────────────────────────────────────────────────────

const TEST_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001";
const TEST_USER_ID = "00000000-0000-4000-8000-000000000002";
const VENDOR_A_ID = "00000000-0000-4000-8000-0000000000aa";
const VENDOR_B_ID = "00000000-0000-4000-8000-0000000000bb";

interface MockRow {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  chunkType: string;
  content: string;
  tokenCount: number | null;
  chunkMetadata: Record<string, unknown>;
  documentType: RagDocumentType;
  documentNumber: string | null;
  documentTitle: string;
  documentMetadata: Record<string, unknown>;
  distance: number;
}

/**
 * Creates a mock Drizzle database returning synthetic pgvector query results.
 */
function createMockSearchDb(
  mockRows: MockRow[],
): NodePgDatabase<Record<string, unknown>> {
  const queryBuilder = {
    from: () => queryBuilder,
    innerJoin: () => queryBuilder,
    where: () => queryBuilder,
    orderBy: () => queryBuilder,
    limit: (n: number) => {
      return Promise.resolve(mockRows.slice(0, n));
    },
    then: (
      onFulfilled: (rows: MockRow[]) => unknown,
      onRejected?: (err: unknown) => unknown,
    ) => Promise.resolve(mockRows).then(onFulfilled, onRejected),
  };

  return {
    select: () => queryBuilder,
  } as unknown as NodePgDatabase<Record<string, unknown>>;
}

/**
 * Creates a mock Drizzle database recording inserts for `ragDocuments` and `ragDocumentChunks`.
 */
function createMockIngestDb() {
  const insertedDocs: Record<string, unknown>[] = [];
  const insertedChunks: Record<string, unknown>[] = [];

  const db: Record<string, unknown> = {
    insert: (_table: Record<string, unknown>) => {
      return {
        values: (val: Record<string, unknown> | Record<string, unknown>[]) => {
          if (Array.isArray(val)) {
            insertedChunks.push(...val);
            return Promise.resolve(val);
          }
          insertedDocs.push(val);
          return {
            returning: () =>
              Promise.resolve([
                {
                  id: "00000000-0000-4000-8000-000000000099",
                  workspaceId: val.workspaceId ?? TEST_WORKSPACE_ID,
                  documentType: val.documentType,
                  documentNumber: val.documentNumber ?? null,
                  title: val.title,
                  fileUrl: val.fileUrl ?? null,
                  fileName: val.fileName ?? null,
                  status: "indexed",
                  metadata: val.metadata ?? {},
                  tokenCount: val.tokenCount ?? 0,
                  chunkCount: val.chunkCount ?? 0,
                  createdBy: val.createdBy ?? null,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]),
          };
        },
      };
    },
    transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(db),
  };

  return {
    db: db as unknown as NodePgDatabase<Record<string, unknown>>,
    insertedDocs,
    insertedChunks,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Document Ingestion & Structure-Aware Tabular Chunking (STC)
// ─────────────────────────────────────────────────────────────────────────────

describe("1. Document Ingestion & Structure-Aware Tabular Chunking", () => {
  describe("1.1 Packing List Chunking (STC)", () => {
    const packingListFixture: ChunkPackingListInput = {
      header: {
        shipper: "Yiwu International Logistics Co., Ltd.",
        originPort: "Ningbo-Zhoushan",
        originCountry: "China",
        consignee: "Cendaro C.A.",
        destinationPort: "Puerto Cabello",
        destinationWarehouse: "Almacén Principal Valencia",
        containerNumber: "MSCU9876543",
        blNumber: "MEDU1234567890",
        sealNumber: "SEAL-998877",
        vessel: "MSC ISABELLA V.2401",
        departureDate: "2026-10-01",
        arrivalDate: "2026-11-10",
        grossWeightKg: 24500.5,
        netWeightKg: 23100.0,
        totalVolumeCbm: 68.4,
        totalPackages: 1200,
        notes: "Carga consolidada ferretería y repuestos",
      },
      items: [
        {
          packageNo: 1,
          sku: "FER-001",
          description: "Stainless steel hex bolts M8x50mm",
          translatedName: "Pernos hexagonales acero inoxidable M8x50mm",
          chineseName: "不锈钢六角螺栓",
          quantity: 500,
          uom: "CAJA",
          unitCostFob: 12.5,
          totalCostFob: 6250.0,
          weightKg: 500,
          volumeCbm: 1.2,
        },
        {
          packageNo: 2,
          sku: "FER-002",
          description: "High tensile steel lock nuts M8",
          translatedName: "Tuercas de seguridad acero M8",
          chineseName: "高强度锁紧螺母",
          quantity: 400,
          uom: "CAJA",
          unitCostFob: 8.0,
          totalCostFob: 3200.0,
          weightKg: 350,
          volumeCbm: 0.9,
        },
        {
          packageNo: 3,
          sku: "AUT-101",
          description: "Ceramic front brake pads Corolla 2022",
          translatedName: "Pastillas de freno delanteras cerámicas",
          chineseName: "陶瓷刹车片",
          quantity: 200,
          uom: "JUEGO",
          unitCostFob: 18.5,
          totalCostFob: 3700.0,
          weightKg: 400,
          volumeCbm: 1.1,
        },
        {
          packageNo: 4,
          sku: "AUT-102",
          description: "Heavy duty shock absorbers rear",
          translatedName: "Amortiguadores traseros uso pesado",
          chineseName: "重型减震器",
          quantity: 100,
          uom: "PAR",
          unitCostFob: 45.0,
          totalCostFob: 4500.0,
          weightKg: 850,
          volumeCbm: 2.4,
        },
      ],
      rowsPerGroup: 2, // Group in batches of 2 rows to test multiple Level 2 chunks
    };

    it("generates a Level 1 master summary chunk containing complete logistics header data", () => {
      const result = chunkPackingList(packingListFixture);

      expect(result.chunks.length).toBeGreaterThanOrEqual(2);
      const masterChunk = result.chunks[0];
      expect(masterChunk).toBeDefined();
      expect(masterChunk?.chunkIndex).toBe(0);
      expect(masterChunk?.chunkType).toBe("document_summary");

      // Verify master content contains required logistics data
      const content = masterChunk?.content ?? "";
      expect(content).toContain(
        "[RESUMEN DE DOCUMENTO: PACKING LIST LOGÍSTICO]",
      );
      expect(content).toContain("MSCU9876543");
      expect(content).toContain("MEDU1234567890");
      expect(content).toContain("SEAL-998877");
      expect(content).toContain("Yiwu International Logistics Co., Ltd.");
      expect(content).toContain("Ningbo-Zhoushan");
      expect(content).toContain("China");
      expect(content).toContain("Cendaro C.A.");
      expect(content).toContain("Puerto Cabello");
      expect(content).toContain("Almacén Principal Valencia");
      expect(content).toContain("24500.5 kg");
      expect(content).toContain("68.4 CBM");
      expect(content).toContain("1200");
      expect(content).toContain("MSC ISABELLA V.2401");
      expect(content).toContain("Valor Total FOB Estimado: $17650.00 USD");

      // Verify master chunk metadata
      const meta = masterChunk ? masterChunk.metadata : {};
      expect(meta.isMasterSummary).toBe(true);
      expect(meta.containerNumber).toBe("MSCU9876543");
      expect(meta.blNumber).toBe("MEDU1234567890");
      expect(meta.totalItems).toBe(4);
      expect(meta.confidentialCosts).toBe(true);
      expect(meta.accessRoles).toEqual(["owner", "admin", "supervisor"]);
    });

    it("generates Level 2 tabular row-group chunks with prepended context tags and line items", () => {
      const result = chunkPackingList(packingListFixture);
      const rowGroupChunks = result.chunks.filter(
        (c) => c.chunkType === "row_group",
      );

      expect(rowGroupChunks.length).toBe(2); // 4 items with rowsPerGroup = 2

      const chunk1 = rowGroupChunks[0];
      expect(chunk1).toBeDefined();
      const content1 = chunk1?.content ?? "";

      // Context tag prepended
      expect(content1).toContain(
        "[DOCUMENTO: Packing List | Contenedor: MSCU9876543 | BL: MEDU1234567890 | Origen: Ningbo-Zhoushan | Destino: Almacén Principal Valencia]",
      );
      // Items 1 & 2
      expect(content1).toContain("SKU: FER-001");
      expect(content1).toContain("Stainless steel hex bolts M8x50mm");
      expect(content1).toContain(
        "(ES: Pernos hexagonales acero inoxidable M8x50mm)",
      );
      expect(content1).toContain("(ZH: 不锈钢六角螺栓)");
      expect(content1).toContain("Cant: 500 CAJA");
      expect(content1).toContain("P.Unit FOB: $12.50");
      expect(content1).toContain("Total FOB: $6250.00");

      expect(content1).toContain("SKU: FER-002");
      expect(content1).toContain("High tensile steel lock nuts M8");

      // Chunk 1 metadata
      const meta1 = chunk1 ? chunk1.metadata : {};
      expect(meta1.itemRange).toEqual([1, 2]);
      expect(meta1.skus).toEqual(["FER-001", "FER-002"]);
      expect(meta1.containerNumber).toBe("MSCU9876543");

      // Chunk 2 contains items 3 & 4
      const chunk2 = rowGroupChunks[1];
      expect(chunk2).toBeDefined();
      const content2 = chunk2?.content ?? "";
      expect(content2).toContain("SKU: AUT-101");
      expect(content2).toContain("Ceramic front brake pads Corolla 2022");
      expect(content2).toContain("SKU: AUT-102");
      expect(content2).toContain("Heavy duty shock absorbers rear");
    });

    it("extracts comprehensive metadata (origin, destination, numbers, totals, accessRules)", () => {
      const result = chunkPackingList(packingListFixture);
      const meta = result.metadata;

      expect(meta.origin?.shipper).toBe(
        "Yiwu International Logistics Co., Ltd.",
      );
      expect(meta.origin?.country).toBe("China");
      expect(meta.origin?.port).toBe("Ningbo-Zhoushan");

      expect(meta.destination?.consignee).toBe("Cendaro C.A.");
      expect(meta.destination?.port).toBe("Puerto Cabello");
      expect(meta.destination?.warehouse).toBe("Almacén Principal Valencia");

      expect(meta.documentNumbers?.containerNumber).toBe("MSCU9876543");
      expect(meta.documentNumbers?.blNumber).toBe("MEDU1234567890");

      expect(meta.totals?.totalWeightKg).toBe(24500.5);
      expect(meta.totals?.totalVolumeCbm).toBe(68.4);
      expect(meta.totals?.totalPackages).toBe(1200);
      expect(meta.totals?.totalAmount).toBe(17650);
      expect(meta.totals?.currency).toBe("USD");

      expect(meta.accessRules?.allowedRoles).toEqual([
        "owner",
        "admin",
        "supervisor",
      ]);
      expect(meta.accessRules?.restrictedFields).toContain("unitCostFob");
      expect(meta.queryRestrictions?.confidentialCosts).toBe(true);
    });

    it("allows employee access when packing list contains zero confidential costs", () => {
      const nonConfidentialFixture: ChunkPackingListInput = {
        header: {
          containerNumber: "TGHU1122334",
          shipper: "Guangzhou Export Corp",
        },
        items: [
          {
            description: "Plásticos protectores de embalaje",
            quantity: 50,
          },
        ],
      };

      const result = chunkPackingList(nonConfidentialFixture);
      expect(result.metadata.accessRules?.allowedRoles).toContain("employee");
      expect(result.metadata.queryRestrictions?.confidentialCosts).toBe(false);
      expect(result.chunks[0]?.metadata.confidentialCosts).toBe(false);
    });
  });

  describe("1.2 Commercial Invoice & SENIAT Fiscal Invoice Chunking", () => {
    const seniatInvoiceFixture: ChunkInvoiceInput = {
      header: {
        documentType: "fiscal_invoice",
        invoiceNumber: "FAC-000892",
        controlNumber: "00-00123456",
        orderNumber: "PED-2026-9901",
        issuerName: "Distribuidora Mayorista Cendaro C.A.",
        issuerRif: "J-12345678-9",
        issuerAddress: "Av. Francisco de Miranda, Torre Cendaro, Caracas",
        buyerName: "Auto Repuestos Occidente C.A.",
        buyerRif: "J-98765432-1",
        buyerAddress: "Calle 72 con Av. 15, Maracaibo, Zulia",
        issueDate: "2026-11-04",
        dueDate: "2026-11-18",
        currency: "USD",
        exchangeRateBcv: 42.5,
        paymentTerms: "Crédito 14 días",
        notes: "Sujeto a retención de IVA 75%",
      },
      items: [
        {
          lineNumber: 1,
          sku: "ACE-5W30-SYN",
          description: "Aceite Sintético para Motor 5W30 Garrafa 4L",
          quantity: 20,
          uom: "GARRAFA",
          unitPrice: 28.0,
          taxRatePercent: 16,
          subtotal: 560.0,
        },
        {
          lineNumber: 2,
          sku: "FIL-OIL-TYT",
          description: "Filtro de Aceite Blindado Toyota Corolla/Yaris",
          quantity: 50,
          uom: "UNIDAD",
          unitPrice: 6.5,
          discountPercent: 5,
          taxRatePercent: 16,
          subtotal: 308.75,
        },
        {
          lineNumber: 3,
          sku: "BTR-12V-60AH",
          description: "Batería Automotriz 12V 60AH Libre Mantenimiento",
          quantity: 10,
          uom: "UNIDAD",
          unitPrice: 75.0,
          taxRatePercent: 16,
          subtotal: 750.0,
        },
      ],
      totals: {
        subtotal: 1618.75,
        exemptAmount: 0.0,
        taxableBase16: 1618.75,
        iva16: 259.0,
        taxableBase8: 0.0,
        iva8: 0.0,
        igtfBase: 1000.0,
        igtf3: 30.0,
        retentionIva: 194.25,
        retentionIslr: 32.38,
        totalAmount: 1907.75,
        totalAmountVes: 81079.38,
      },
      customerId: "00000000-0000-4000-8000-0000000000cc",
      rowsPerGroup: 2,
    };

    it("generates a Level 1 master fiscal summary chunk with SENIAT tax breakdown and BCV rate", () => {
      const result = chunkInvoice(seniatInvoiceFixture);

      expect(result.chunks.length).toBeGreaterThanOrEqual(2);
      const masterChunk = result.chunks[0];
      expect(masterChunk).toBeDefined();
      expect(masterChunk?.chunkType).toBe("document_summary");

      const content = masterChunk?.content ?? "";
      expect(content).toContain(
        "[RESUMEN DE DOCUMENTO: FACTURA FISCAL SENIAT]",
      );
      expect(content).toContain("Factura N°: FAC-000892");
      expect(content).toContain("N° de Control: 00-00123456");
      expect(content).toContain("Pedido N°: PED-2026-9901");
      expect(content).toContain(
        "Emisor: Distribuidora Mayorista Cendaro C.A. | RIF: J-12345678-9",
      );
      expect(content).toContain(
        "Cliente / Receptor: Auto Repuestos Occidente C.A. | RIF/CI: J-98765432-1",
      );
      expect(content).toContain("Tasa de Cambio BCV: 42.5000 VES/USD");
      expect(content).toContain("Subtotal: $1618.75");
      expect(content).toContain(
        "Base Imponible 16%: $1618.75 | IVA (16%): $259.00",
      );
      expect(content).toContain(
        "Base IGTF (3%): $1000.00 | IGTF Percibido: $30.00",
      );
      expect(content).toContain("Comprobante Retención IVA: -$194.25");
      expect(content).toContain("Comprobante Retención ISLR: -$32.38");
      expect(content).toContain("MONTO TOTAL: $1907.75 USD");
      expect(content).toContain("Equivalente en Bolívares (VES): Bs. 81079.38");

      // Verify metadata
      const meta = masterChunk ? masterChunk.metadata : {};
      expect(meta.isMasterSummary).toBe(true);
      expect(meta.invoiceNumber).toBe("FAC-000892");
      expect(meta.controlNumber).toBe("00-00123456");
      expect(meta.issuerRif).toBe("J-12345678-9");
      expect(meta.buyerRif).toBe("J-98765432-1");
      expect(meta.totalAmount).toBe(1907.75);
    });

    it("generates Level 2 item row-groups prepending party and invoice tags", () => {
      const result = chunkInvoice(seniatInvoiceFixture);
      const rowGroupChunks = result.chunks.filter(
        (c) => c.chunkType === "row_group",
      );

      expect(rowGroupChunks.length).toBe(2);

      const chunk1 = rowGroupChunks[0];
      expect(chunk1).toBeDefined();
      const content1 = chunk1?.content ?? "";

      expect(content1).toContain(
        "[DOCUMENTO: Factura Fiscal #FAC-000892 | Control: 00-00123456 | Emisor: Distribuidora Mayorista Cendaro C.A. (J-12345678-9) | Cliente: Auto Repuestos Occidente C.A. (J-98765432-1) | Fecha: 2026-11-04]",
      );
      expect(content1).toContain(
        "Renglón 1 | SKU: ACE-5W30-SYN | Aceite Sintético para Motor 5W30 Garrafa 4L",
      );
      expect(content1).toContain("Cant: 20 GARRAFA | P.Unit: $28.00");
      expect(content1).toContain("IVA: 16% | Subtotal: $560.00");

      expect(content1).toContain(
        "Renglón 2 | SKU: FIL-OIL-TYT | Filtro de Aceite Blindado Toyota Corolla/Yaris",
      );
      expect(content1).toContain("Desc: 5% | IVA: 16% | Subtotal: $308.75");

      const chunk2 = rowGroupChunks[1];
      expect(chunk2).toBeDefined();
      const content2 = chunk2?.content ?? "";
      expect(content2).toContain(
        "Renglón 3 | SKU: BTR-12V-60AH | Batería Automotriz 12V 60AH",
      );
      expect(content2).toContain("Subtotal: $750.00");
    });

    it("extracts SENIAT fiscal metadata correctly", () => {
      const result = chunkInvoice(seniatInvoiceFixture);
      const meta = result.metadata;

      expect(meta.origin?.entityName).toBe(
        "Distribuidora Mayorista Cendaro C.A.",
      );
      expect(meta.origin?.rif).toBe("J-12345678-9");
      expect(meta.destination?.buyerName).toBe("Auto Repuestos Occidente C.A.");
      expect(meta.destination?.rif).toBe("J-98765432-1");
      expect(meta.documentNumbers?.invoiceNumber).toBe("FAC-000892");
      expect(meta.documentNumbers?.controlNumber).toBe("00-00123456");
      expect(meta.documentNumbers?.orderNumber).toBe("PED-2026-9901");
      expect(meta.totals?.subtotal).toBe(1618.75);
      expect(meta.totals?.tax).toBe(259.0);
      expect(meta.totals?.totalAmount).toBe(1907.75);
      expect(meta.totals?.currency).toBe("USD");
      expect(meta.queryRestrictions?.customerId).toBe(
        "00000000-0000-4000-8000-0000000000cc",
      );
    });
  });

  describe("1.3 Delivery Note Chunking", () => {
    const deliveryNoteFixture: ChunkDeliveryNoteInput = {
      header: {
        noteNumber: "ND-5544",
        orderNumber: "PED-2026-1002",
        recipientName: "Taller Mecánico Central",
        recipientIdDoc: "V-15678901",
        deliveryAddress: "Av. Bolívar, Local 12, Valencia",
        carrierName: "Transportes Rápidos C.A.",
        licensePlate: "A12BC3D",
        dispatchedAt: "2026-11-05 08:30",
        notes: "Entregar en portón trasero",
      },
      items: [
        {
          lineNumber: 1,
          sku: "BUJ-NGK-4",
          description: "Bujías NGK Iridium Juego de 4",
          quantityOrdered: 10,
          quantityDispatched: 10,
          uom: "JUEGO",
        },
        {
          lineNumber: 2,
          sku: "COR-ALT-10",
          description: "Correa de Alternador Gates",
          quantityOrdered: 5,
          quantityDispatched: 4, // Partial dispatch
          uom: "UNIDAD",
        },
      ],
      rowsPerGroup: 5,
    };

    it("chunks delivery note into dispatch summary and row-groups with dispatched quantities", () => {
      const result = chunkDeliveryNote(deliveryNoteFixture);

      expect(result.chunks.length).toBe(2);
      const summary = result.chunks[0];
      expect(summary?.chunkType).toBe("document_summary");
      expect(summary?.content).toContain(
        "[RESUMEN DE DOCUMENTO: NOTA DE ENTREGA / DESPACHO]",
      );
      expect(summary?.content).toContain("Nota de Entrega N°: ND-5544");
      expect(summary?.content).toContain("Taller Mecánico Central");
      expect(summary?.content).toContain("Transportes Rápidos C.A.");
      expect(summary?.content).toContain("Placa: A12BC3D");

      const itemsChunk = result.chunks[1];
      expect(itemsChunk?.chunkType).toBe("row_group");
      expect(itemsChunk?.content).toContain(
        "[DOCUMENTO: Nota de Entrega #ND-5544 | Receptor: Taller Mecánico Central",
      );
      expect(itemsChunk?.content).toContain("Despachado: 10 de 10 JUEGO");
      expect(itemsChunk?.content).toContain("Despachado: 4 de 5 UNIDAD");

      expect(result.metadata.documentNumbers?.deliveryNoteNumber).toBe(
        "ND-5544",
      );
      expect(result.metadata.destination?.buyerName).toBe(
        "Taller Mecánico Central",
      );
    });
  });

  describe("1.4 Raw Commercial Document Parser (`chunkRawCommercialDocument`)", () => {
    const rawDocumentText = `
DISTRIBUIDORA FERRETERA DEL CENTRO C.A.
RIF: J-30456789-0
Av. Las Delicias, Maracay, Edo. Aragua
Factura: FAC-998811
N° de Control: 00-009876
Contenedor: TGHU7654321

Estimado cliente: Inversiones El Águila S.A.
RIF: J-40123456-7
Dirección: Zona Industrial Los Cortijos, Caracas

Detalle de productos despachados:
1. Disco de corte para metal 4.5 pulgadas - Cantidad: 100 UNID - Costo FOB: $1.20 - Subtotal: $120.00
2. Electrodos para soldar 6013 1/8 caja 5kg - Cantidad: 20 CAJAS - Costo FOB: $18.50 - Subtotal: $370.00
3. Candado de seguridad 50mm bronce - Cantidad: 40 UNID - Costo FOB: $4.50 - Subtotal: $180.00

Total General: $670.00 USD.
Condiciones: Pago de contado contra entrega.
`;

    it("extracts Venezuelan RIFs, control numbers, container codes, and marks confidential FOB costs", () => {
      const result = chunkRawCommercialDocument(rawDocumentText, {
        documentType: "commercial_invoice",
        title: "Factura Ferretera FAC-998811",
      });

      expect(result.chunks.length).toBeGreaterThanOrEqual(2);

      // Metadata extraction
      expect(result.metadata.documentNumbers?.documentNumber).toBe(
        "FAC-998811",
      );
      expect(result.metadata.controlNumber).toBe("00-009876");
      expect(result.metadata.containerNumber).toBe("TGHU7654321");
      expect(result.metadata.origin?.rif).toBe("J-30456789-0");
      expect(result.metadata.destination?.rif).toBe("J-40123456-7");

      // Master chunk tags
      const masterChunk = result.chunks[0];
      expect(masterChunk?.content).toContain(
        "[DOCUMENTO: COMMERCIAL_INVOICE | Identificador: FAC-998811",
      );
      expect(masterChunk?.content).toContain("Control: 00-009876");
      expect(masterChunk?.content).toContain("RIF: J-30456789-0");

      // Level 2 chunks have prepended tags
      const groupChunk = result.chunks[1];
      expect(groupChunk?.content).toContain(
        "[DOCUMENTO: COMMERCIAL_INVOICE | Identificador: FAC-998811",
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Embedding Generation & Vector Math
// ─────────────────────────────────────────────────────────────────────────────

describe("2. Embedding Generation & Vector Math", () => {
  it("generates vector embeddings with exactly 1,536 dimensions", async () => {
    const text =
      "Factura comercial de importación marítima Cendaro ERP contenedor MSCU1234567";
    const vector = await generateEmbedding(text);

    expect(Array.isArray(vector)).toBe(true);
    expect(vector.length).toBe(EMBEDDING_DIMENSIONS);
    expect(vector.length).toBe(1536);

    for (const val of vector) {
      expect(typeof val).toBe("number");
      expect(Number.isNaN(val)).toBe(false);
      expect(Number.isFinite(val)).toBe(true);
    }
  });

  it("ensures vector embeddings are L2 Euclidean normalized (||v||₂ ≈ 1.0)", async () => {
    const testSamples = [
      "MSCU9876543 Puerto Cabello Cendaro",
      "Factura Fiscal SENIAT N° 00-001234 con IVA 16% e IGTF 3%",
      "Short",
      "A very long detailed commercial description with multiple Spanish, English, and Chinese alphanumeric tokens like SKU-123, RIF J-12345678-9, and 汽车配件 pastillas de freno.",
      "1234567890 0987654321",
    ];

    for (const sample of testSamples) {
      const vector = await generateEmbedding(sample);
      let sumSq = 0;
      for (const val of vector) {
        sumSq += val * val;
      }
      const norm = Math.sqrt(sumSq);
      // Euclidean norm must equal 1.0 within 1e-5 precision
      expect(norm).toBeCloseTo(1.0, 5);
    }
  });

  it("handles empty or whitespace-only inputs gracefully by returning a normalized unit vector", () => {
    const emptyVector = generateDeterministicEmbedding("");
    expect(emptyVector.length).toBe(1536);
    expect(emptyVector[0]).toBe(1.0);

    let sumSq = 0;
    for (const val of emptyVector) {
      sumSq += val * val;
    }
    expect(Math.sqrt(sumSq)).toBeCloseTo(1.0, 5);

    const whitespaceVector = generateDeterministicEmbedding("   \n\t   ");
    expect(whitespaceVector.length).toBe(1536);
    expect(whitespaceVector[0]).toBe(1.0);
  });

  it("demonstrates semantic proximity: semantically related texts have higher similarity than unrelated texts", async () => {
    const logisticsTextA =
      "Contenedor marítimo con 500 bultos de repuestos automotrices desembarcado en Puerto Cabello";
    const logisticsTextB =
      "Cargamento logístico de autopartes y repuestos de vehículos transportados en contenedor naval a puerto";
    const unrelatedTextC =
      "Receta para hornear un pastel dulce de vainilla y chocolate con crema batida casera";

    const embA = await generateEmbedding(logisticsTextA);
    const embB = await generateEmbedding(logisticsTextB);
    const embC = await generateEmbedding(unrelatedTextC);

    const similarityAB = cosineSimilarity(embA, embB);
    const similarityAC = cosineSimilarity(embA, embC);

    // Semantically aligned texts must have strictly higher cosine similarity
    expect(similarityAB).toBeGreaterThan(similarityAC);

    // Distance = 1.0 - similarity; related texts have strictly lower distance
    const distAB = 1.0 - similarityAB;
    const distAC = 1.0 - similarityAC;
    expect(distAB).toBeLessThan(distAC);

    // Identical text must yield maximum cosine similarity ≈ 1.0
    const similaritySelf = cosineSimilarity(embA, embA);
    expect(similaritySelf).toBeCloseTo(1.0, 4);
  });

  it("retains high similarity under minor typos due to subword character trigram hashing", () => {
    const original =
      "Despacho de mercancia en almacen central Valencia con factura fiscal";
    const withTypos =
      "Despacho de mercancia en almacen cntral Valenca con facura fiscl";
    const unrelated = "Receta para hornear pan dulce casero en la cocina";

    const embOriginal = generateDeterministicEmbedding(original);
    const embTypos = generateDeterministicEmbedding(withTypos);
    const embUnrelated = generateDeterministicEmbedding(unrelated);

    const simTypos = cosineSimilarity(embOriginal, embTypos);
    const simUnrelated = cosineSimilarity(embOriginal, embUnrelated);

    // Subword trigrams ensure robust similarity even with dropped vowels/typos (~0.69)
    expect(simTypos).toBeGreaterThan(0.65);
    // Typo similarity must be significantly higher than unrelated similarity (< 0.15)
    expect(simTypos).toBeGreaterThan(simUnrelated + 0.4);
  });

  it("generates batch embeddings matching single generation results", async () => {
    const batchTexts = [
      "Packing list PL-2026-001",
      "Factura comercial FC-9988",
      "Nota de entrega ND-1122",
    ];

    const batchEmbeddings = await generateEmbeddings(batchTexts);
    expect(batchEmbeddings.length).toBe(3);

    for (let i = 0; i < batchTexts.length; i++) {
      const single = await generateEmbedding(batchTexts[i] ?? "");
      const batchItem = batchEmbeddings[i];
      expect(batchItem).toBeDefined();
      expect(batchItem?.length).toBe(1536);
      expect(cosineSimilarity(batchItem ?? [], single)).toBeCloseTo(1.0, 5);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Access Control & Role-Based Query Restrictions
// ─────────────────────────────────────────────────────────────────────────────

describe("3. Access Control & Role-Based Query Restrictions", () => {
  const commonChunkText =
    "- Fila 1 | SKU: AUT-500 | Amortiguador Monroe Delantero | Cant: 40 PAR | P.Unit FOB: $45.00 | Total FOB: $1800.00";

  it("filters out chunks when the user's role is not included in `allowedRoles`", async () => {
    const mockRows: MockRow[] = [
      {
        chunkId: "chunk-restricted-1",
        documentId: "doc-1",
        chunkIndex: 1,
        chunkType: "row_group",
        content: commonChunkText,
        tokenCount: 40,
        chunkMetadata: {
          accessRoles: ["owner", "admin"] as RagAccessRole[],
        },
        documentType: "packing_list",
        documentNumber: "MSCU1122334",
        documentTitle: "Packing List Restringido",
        documentMetadata: {},
        distance: 0.15,
      },
      {
        chunkId: "chunk-public-2",
        documentId: "doc-2",
        chunkIndex: 1,
        chunkType: "row_group",
        content:
          "- Fila 1 | SKU: GEN-001 | Guantes de seguridad de carnaza | Cant: 100",
        tokenCount: 30,
        chunkMetadata: {
          accessRoles: [
            "owner",
            "admin",
            "supervisor",
            "employee",
          ] as RagAccessRole[],
        },
        documentType: "packing_list",
        documentNumber: "MSCU5566778",
        documentTitle: "Packing List General",
        documentMetadata: {},
        distance: 0.18,
      },
    ];

    const mockDb = createMockSearchDb(mockRows);

    // 1. Employee query: should NOT see chunk-restricted-1
    const employeeCtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "employee" },
      user: { id: TEST_USER_ID },
    };

    const employeeRes = await searchRagChunks(employeeCtx, {
      query: "amortiguador repuestos",
      limit: 10,
      minScore: 0.5,
    });

    expect(
      employeeRes.results.some((r) => r.chunkId === "chunk-restricted-1"),
    ).toBe(false);
    expect(
      employeeRes.results.some((r) => r.chunkId === "chunk-public-2"),
    ).toBe(true);

    // 2. Owner query: SHOULD see chunk-restricted-1
    const ownerCtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "owner" },
      user: { id: TEST_USER_ID },
    };

    const ownerRes = await searchRagChunks(ownerCtx, {
      query: "amortiguador repuestos",
      limit: 10,
      minScore: 0.5,
    });

    expect(
      ownerRes.results.some((r) => r.chunkId === "chunk-restricted-1"),
    ).toBe(true);
    expect(ownerRes.results.some((r) => r.chunkId === "chunk-public-2")).toBe(
      true,
    );
  });

  it("enforces vendor query isolation: vendors cannot see documents restricted to other vendors", async () => {
    const mockRows: MockRow[] = [
      {
        chunkId: "chunk-vendor-a",
        documentId: "doc-vendor-a",
        chunkIndex: 1,
        chunkType: "row_group",
        content: "Cotización exclusiva de filtros de aire para Proveedor A",
        tokenCount: 25,
        chunkMetadata: {
          vendorId: VENDOR_A_ID,
          accessRoles: ["owner", "admin", "vendor"] as RagAccessRole[],
        },
        documentType: "commercial_invoice",
        documentNumber: "INV-VEND-A",
        documentTitle: "Factura Proveedor A",
        documentMetadata: {
          queryRestrictions: { vendorId: VENDOR_A_ID },
        },
        distance: 0.1,
      },
      {
        chunkId: "chunk-vendor-b",
        documentId: "doc-vendor-b",
        chunkIndex: 1,
        chunkType: "row_group",
        content: "Cotización exclusiva de bujías para Proveedor B",
        tokenCount: 25,
        chunkMetadata: {
          vendorId: VENDOR_B_ID,
          accessRoles: ["owner", "admin", "vendor"] as RagAccessRole[],
        },
        documentType: "commercial_invoice",
        documentNumber: "INV-VEND-B",
        documentTitle: "Factura Proveedor B",
        documentMetadata: {
          queryRestrictions: { vendorId: VENDOR_B_ID },
        },
        distance: 0.12,
      },
    ];

    const mockDb = createMockSearchDb(mockRows);

    // Vendor A searches: should ONLY see chunk-vendor-a, NOT chunk-vendor-b
    const vendorACtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "vendor" },
      user: { id: TEST_USER_ID, vendorId: VENDOR_A_ID },
    };

    const vendorARes = await searchRagChunks(vendorACtx, {
      query: "cotización repuestos",
      limit: 10,
      minScore: 0.5,
    });

    expect(vendorARes.results.some((r) => r.chunkId === "chunk-vendor-a")).toBe(
      true,
    );
    expect(vendorARes.results.some((r) => r.chunkId === "chunk-vendor-b")).toBe(
      false,
    );

    // Management (Admin) searches: can see both vendor documents
    const adminCtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "admin" },
      user: { id: TEST_USER_ID },
    };

    const adminRes = await searchRagChunks(adminCtx, {
      query: "cotización repuestos",
      limit: 10,
      minScore: 0.5,
    });

    expect(adminRes.results.some((r) => r.chunkId === "chunk-vendor-a")).toBe(
      true,
    );
    expect(adminRes.results.some((r) => r.chunkId === "chunk-vendor-b")).toBe(
      true,
    );

    // Adversarial: Vendor A specifies Vendor B's vendorId in search input
    // Must STILL be blocked and never leak Vendor B's chunks
    const spoofedVendorARes = await searchRagChunks(vendorACtx, {
      query: "cotización repuestos",
      limit: 10,
      minScore: 0.5,
      vendorId: VENDOR_B_ID,
    });
    expect(
      spoofedVendorARes.results.some((r) => r.chunkId === "chunk-vendor-b"),
    ).toBe(false);

    // Adversarial: Unassigned internal workspace document (no vendorId and no
    // explicit "vendor" role in allowedRoles) MUST fail closed for external vendors
    const unassignedInternalRows: MockRow[] = [
      {
        chunkId: "chunk-internal-unassigned",
        documentId: "doc-internal-unassigned",
        chunkIndex: 0,
        chunkType: "document_summary",
        content: "Manifiesto interno sin restricciones explícitas declaradas",
        tokenCount: 20,
        chunkMetadata: {},
        documentType: "packing_list",
        documentNumber: "PL-INT-01",
        documentTitle: "Packing List Interno",
        documentMetadata: {},
        distance: 0.05,
      },
    ];
    const unassignedRes = await searchRagChunks(
      {
        db: createMockSearchDb(unassignedInternalRows),
        workspace: { workspaceId: TEST_WORKSPACE_ID, role: "vendor" },
        user: { id: TEST_USER_ID, vendorId: VENDOR_A_ID },
      },
      { query: "manifiesto interno", limit: 10, minScore: 0.5 },
    );
    expect(unassignedRes.results).toHaveLength(0);
  });

  it("redacts confidential FOB costs and totals for sales floor / vendor / marketing roles", async () => {
    const rawContent = [
      "[DOCUMENTO: Packing List | Contenedor: MSCU9988771]",
      "- Fila 1 | SKU: AUT-101 | Amortiguador Monroe Delantero | Cant: 40 PAR | P.Unit FOB: $45.00 | Total FOB: $1800.00",
      "- Resumen: Valor Total FOB Estimado: $22500.00 USD",
    ].join("\n");

    const mockRows: MockRow[] = [
      {
        chunkId: "chunk-confidential-1",
        documentId: "doc-confidential-1",
        chunkIndex: 1,
        chunkType: "row_group",
        content: rawContent,
        tokenCount: 50,
        chunkMetadata: {
          confidentialCosts: true,
          unitCostFob: 45.0,
          totalCostFob: 1800.0,
          accessRoles: [
            "owner",
            "admin",
            "supervisor",
            "employee",
          ] as RagAccessRole[],
        },
        documentType: "packing_list",
        documentNumber: "MSCU9988771",
        documentTitle: "Packing List Confidencial",
        documentMetadata: {
          confidentialCosts: true,
        },
        distance: 0.1,
      },
    ];

    const mockDb = createMockSearchDb(mockRows);

    // 1. Employee query: costs must be redacted
    const employeeCtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "employee" },
      user: { id: TEST_USER_ID },
    };

    const employeeRes = await searchRagChunks(employeeCtx, {
      query: "amortiguador monroe",
      limit: 10,
      minScore: 0.5,
    });

    expect(employeeRes.results.length).toBe(1);
    const employeeResult = employeeRes.results[0];
    expect(employeeResult).toBeDefined();

    // Verify redaction in text content
    expect(employeeResult?.content).toContain("P.Unit FOB: [CONFIDENCIAL]");
    expect(employeeResult?.content).toContain("Total FOB: [CONFIDENCIAL]");
    expect(employeeResult?.content).toContain(
      "Valor Total FOB: [CONFIDENCIAL]",
    );
    expect(employeeResult?.content).not.toContain("$45.00");
    expect(employeeResult?.content).not.toContain("$1800.00");
    expect(employeeResult?.content).not.toContain("$22500.00");

    // Verify financial keys are stripped from metadata
    expect(employeeResult?.metadata.unitCostFob).toBeUndefined();
    expect(employeeResult?.metadata.totalCostFob).toBeUndefined();

    // 2. Admin query: costs must remain unredacted
    const adminCtx: RagSearchContext = {
      db: mockDb,
      workspace: { workspaceId: TEST_WORKSPACE_ID, role: "admin" },
      user: { id: TEST_USER_ID },
    };

    const adminRes = await searchRagChunks(adminCtx, {
      query: "amortiguador monroe",
      limit: 10,
      minScore: 0.5,
    });

    expect(adminRes.results.length).toBe(1);
    const adminResult = adminRes.results[0];
    expect(adminResult?.content).toContain("P.Unit FOB: $45.00");
    expect(adminResult?.content).toContain("Total FOB: $1800.00");
    expect(adminResult?.content).toContain(
      "Valor Total FOB Estimado: $22500.00 USD",
    );
    expect(adminResult?.metadata.unitCostFob).toBe(45.0);
    expect(adminResult?.metadata.totalCostFob).toBe(1800.0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Input Validation & Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe("4. Input Validation & Edge Cases", () => {
  describe("4.1 Zod Schema Boundary Validation", () => {
    it("validates valid search inputs and applies sensible defaults", () => {
      const parsed = ragSearchInputSchema.parse({
        query: "repuestos pastillas de freno",
      });

      expect(parsed.query).toBe("repuestos pastillas de freno");
      expect(parsed.limit).toBe(10);
      expect(parsed.minScore).toBe(0.5);
      expect(parsed.role).toBeUndefined();
    });

    it("rejects empty, overlong, or negative search inputs", () => {
      // Empty query rejected
      expect(() => ragSearchInputSchema.parse({ query: "" })).toThrow();
      expect(() => ragSearchInputSchema.parse({ query: "   " })).not.toThrow(); // non-empty string

      // Query > 1000 characters rejected
      const longQuery = "a".repeat(1001);
      expect(() => ragSearchInputSchema.parse({ query: longQuery })).toThrow();

      // Limit boundary checks
      expect(() =>
        ragSearchInputSchema.parse({ query: "valid", limit: 0 }),
      ).toThrow();
      expect(() =>
        ragSearchInputSchema.parse({ query: "valid", limit: -5 }),
      ).toThrow();
      expect(() =>
        ragSearchInputSchema.parse({ query: "valid", limit: 101 }),
      ).toThrow();

      // MinScore boundary checks
      expect(() =>
        ragSearchInputSchema.parse({ query: "valid", minScore: -0.1 }),
      ).toThrow();
      expect(() =>
        ragSearchInputSchema.parse({ query: "valid", minScore: 1.1 }),
      ).toThrow();

      // Invalid vendorId format rejected (must be UUID)
      expect(() =>
        ragSearchInputSchema.parse({
          query: "valid",
          vendorId: "not-a-valid-uuid",
        }),
      ).toThrow();

      // Client cannot supply role (strictly rejected by schema to prevent privilege escalation)
      expect(() =>
        ragSearchInputSchema.parse({
          query: "valid",
          role: "owner" as unknown as RagAccessRole,
        }),
      ).toThrow();
      expect(() =>
        ragSearchInputSchema.parse({
          query: "valid",
          role: "super_admin" as unknown as RagAccessRole,
        }),
      ).toThrow();
    });

    it("validates document ingestion schema and enforces chunk requirements", () => {
      // Valid ingest input
      const validInput = {
        documentType: "packing_list",
        title: "Packing List Contenedor 2026",
        chunks: [
          {
            chunkType: "document_summary",
            content: "Resumen de contenedor MSCU1234567",
          },
        ],
      };
      expect(() => ragIngestInputSchema.parse(validInput)).not.toThrow();

      // Empty chunks array rejected
      expect(() =>
        ragIngestInputSchema.parse({
          documentType: "packing_list",
          title: "Sin fragmentos",
          chunks: [],
        }),
      ).toThrow();

      // Missing or empty title rejected
      expect(() =>
        ragIngestInputSchema.parse({
          documentType: "packing_list",
          title: "",
          chunks: [{ content: "Fragmento 1" }],
        }),
      ).toThrow();

      // Invalid chunk embedding dimension rejected (must be 1536)
      expect(() =>
        ragIngestInputSchema.parse({
          documentType: "packing_list",
          title: "Embedding defectuoso",
          chunks: [
            {
              content: "Fragmento con 512 dims",
              embedding: new Array(512).fill(0.1),
            },
          ],
        }),
      ).toThrow();
    });
  });

  describe("4.2 Chunker Edge Cases & Token Count Estimation", () => {
    it("handles packing lists with zero line items without crashing", () => {
      const emptyItemsResult = chunkPackingList({
        header: {
          containerNumber: "EMPTY-001",
          shipper: "Empty Cargo Inc",
        },
        items: [],
      });

      expect(emptyItemsResult.chunks.length).toBe(1); // Only Level 1 summary
      expect(emptyItemsResult.chunks[0]?.chunkType).toBe("document_summary");
      expect(emptyItemsResult.metadata.totals?.totalItems).toBe(0);
    });

    it("estimates token counts accurately across Latin, alphanumeric, and CJK text", () => {
      // Empty text
      expect(estimateTokenCount("")).toBe(1);
      expect(estimateTokenCount("   ")).toBe(1);

      // Latin / Spanish text (~4 chars per token)
      const spanishText = "Factura fiscal de repuestos y autopartes"; // 40 chars
      const estimatedSpanish = estimateTokenCount(spanishText);
      expect(estimatedSpanish).toBeGreaterThanOrEqual(8);
      expect(estimatedSpanish).toBeLessThanOrEqual(15);

      // CJK / Chinese text (~1.2 tokens per character)
      const chineseText = "不锈钢六角螺栓陶瓷刹车片"; // 12 CJK chars
      const estimatedChinese = estimateTokenCount(chineseText);
      expect(estimatedChinese).toBeGreaterThanOrEqual(12);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Ingestion Orchestrator & End-to-End Workflow Integration
// ─────────────────────────────────────────────────────────────────────────────

describe("5. Ingestion Orchestrator & Workflow Integration", () => {
  it("ingests a pre-chunked document, computes missing embeddings, and records database rows", async () => {
    const { db, insertedDocs, insertedChunks } = createMockIngestDb();

    const ctx: RagIngestContext = {
      db,
      workspace: { workspaceId: TEST_WORKSPACE_ID },
      user: { id: TEST_USER_ID },
    };

    const result = await ingestDocument(ctx, {
      documentType: "commercial_invoice",
      documentNumber: "FAC-MOCK-001",
      title: "Factura Comercial Mock",
      chunks: [
        {
          chunkIndex: 0,
          chunkType: "document_summary",
          content: "Resumen Maestro de Factura FAC-MOCK-001 Total $500",
        },
        {
          chunkIndex: 1,
          chunkType: "row_group",
          content: "Renglón 1: Filtro de gasolina para Toyota $15.00",
        },
      ],
      metadata: {
        totalAmount: 500,
        currency: "USD",
      },
    });

    expect(result.status).toBe("indexed");
    expect(result.chunkCount).toBe(2);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.documentNumber).toBe("FAC-MOCK-001");

    // Verify database inserts
    expect(insertedDocs.length).toBe(1);
    expect(insertedDocs[0]?.documentType).toBe("commercial_invoice");
    expect(insertedDocs[0]?.workspaceId).toBe(TEST_WORKSPACE_ID);

    expect(insertedChunks.length).toBe(2);
    // Verify embeddings were automatically computed and populated
    const chunk0 = insertedChunks[0];
    expect(chunk0).toBeDefined();
    const emb0 = chunk0?.embedding as number[];
    expect(Array.isArray(emb0)).toBe(true);
    expect(emb0.length).toBe(1536);
  });

  it("ingests a structured packing list end-to-end via `ingestPackingList` helper", async () => {
    const { db, insertedDocs, insertedChunks } = createMockIngestDb();

    const ctx: RagIngestContext = {
      db,
      workspace: { workspaceId: TEST_WORKSPACE_ID },
      user: { id: TEST_USER_ID },
    };

    const result = await ingestPackingList(ctx, {
      header: {
        containerNumber: "CEND-8899001",
        shipper: "Shenzhen Precision Tools",
        grossWeightKg: 15200,
      },
      items: [
        {
          sku: "HER-01",
          description: "Juego de llaves combinadas 8-24mm",
          quantity: 150,
          unitCostFob: 14.0,
        },
      ],
    });

    expect(result.documentType).toBe("packing_list");
    expect(result.documentNumber).toBe("CEND-8899001");
    expect(result.chunkCount).toBeGreaterThanOrEqual(2); // Master summary + 1 row group
    expect(insertedDocs.length).toBe(1);
    expect(insertedChunks.length).toBe(result.chunkCount);
  });

  it("ingests a structured invoice end-to-end via `ingestInvoice` helper", async () => {
    const { db, insertedDocs, insertedChunks } = createMockIngestDb();

    const ctx: RagIngestContext = {
      db,
      workspace: { workspaceId: TEST_WORKSPACE_ID },
      user: { id: TEST_USER_ID },
    };

    const result = await ingestInvoice(ctx, {
      header: {
        documentType: "commercial_invoice",
        invoiceNumber: "FAC-INGEST-01",
        issuerName: "Proveedor Internacional",
        issuerRif: "J-11223344-5",
        buyerName: "Cendaro C.A.",
        buyerRif: "J-99887766-0",
        issueDate: "2026-11-12",
        currency: "USD",
      },
      items: [
        {
          lineNumber: 1,
          sku: "PROD-01",
          description: "Filtro de aire",
          quantity: 10,
          unitPrice: 15.0,
          subtotal: 150.0,
        },
      ],
      totals: {
        subtotal: 150.0,
        totalAmount: 150.0,
      },
    });

    expect(result.documentType).toBe("commercial_invoice");
    expect(result.documentNumber).toBe("FAC-INGEST-01");
    expect(result.chunkCount).toBeGreaterThanOrEqual(2);
    expect(insertedDocs.length).toBe(1);
    expect(insertedChunks.length).toBe(result.chunkCount);
  });

  it("ingests a raw commercial document end-to-end via `ingestRawDocument` helper", async () => {
    const { db, insertedDocs, insertedChunks } = createMockIngestDb();

    const ctx: RagIngestContext = {
      db,
      workspace: { workspaceId: TEST_WORKSPACE_ID },
    };

    const rawText = `
FACTURA FISCAL SENIAT
Emisor: Repuestos El Trébol C.A. RIF: J-00112233-4
Control: 00-008765 Factura: FAC-7788
Cliente: Inversiones Los Andes RIF: J-99887766-5
1. Pastillas de freno delanteras $35.00
2. Discos de freno ventilados $60.00
`;

    const result = await ingestRawDocument(ctx, {
      rawText,
      documentType: "fiscal_invoice",
    });

    expect(result.documentType).toBe("fiscal_invoice");
    expect(result.chunkCount).toBeGreaterThanOrEqual(1);
    expect(insertedDocs.length).toBe(1);
    expect(insertedChunks.length).toBe(result.chunkCount);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. tRPC Procedures & Security Guards (`ragRouter`)
// ─────────────────────────────────────────────────────────────────────────────

describe("6. tRPC Procedures & Security Guards (`ragRouter`)", () => {
  const createRagCaller = createCallerFactory(
    createTRPCRouter({ rag: ragRouter }),
  );

  function createCallerForRole(
    role: string,
    opts?: {
      emptyDoc?: boolean;
      confidentialDoc?: boolean;
      restrictedDoc?: boolean;
      allowedRoles?: string[];
      restrictedVendorDoc?: boolean;
      docVendorId?: string;
      userVendorId?: string;
      confidentialDocWithTotals?: boolean;
      mixedDocs?: boolean;
    },
  ) {
    let counter = 0;
    const nextMockId = () =>
      `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;

    const chain = (): Record<string, unknown> => {
      const self: Record<string, unknown> = {};
      for (const m of [
        "from",
        "innerJoin",
        "leftJoin",
        "where",
        "orderBy",
        "limit",
        "offset",
        "values",
        "returning",
      ]) {
        self[m] = () => self;
      }
      self.then = (
        onFulfilled: (val: unknown) => unknown,
        onRejected?: (err: unknown) => unknown,
      ) => {
        let rows: unknown[];
        if (opts?.emptyDoc) {
          rows = [];
        } else if (opts?.restrictedDoc) {
          rows = [
            {
              id: "00000000-0000-4000-8000-000000000099",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              title: "Restricted Packing List",
              status: "indexed",
              metadata: {
                accessRules: {
                  allowedRoles: opts.allowedRoles ?? ["owner", "admin"],
                },
              },
              chunkIndex: 0,
              chunkType: "row_group",
              content: "- Fila 1 | SKU: TOP-SECRET",
              tokenCount: 10,
              createdAt: new Date(),
            },
          ];
        } else if (opts?.restrictedVendorDoc) {
          rows = [
            {
              id: "00000000-0000-4000-8000-000000000099",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              title: "Vendor B Packing List",
              status: "indexed",
              metadata: {
                queryRestrictions: {
                  vendorId: opts.docVendorId ?? VENDOR_B_ID,
                },
              },
              chunkIndex: 0,
              chunkType: "row_group",
              content: "- Fila 1 | SKU: VENDOR-B-PROD",
              tokenCount: 10,
              createdAt: new Date(),
            },
          ];
        } else if (opts?.confidentialDocWithTotals) {
          rows = [
            {
              id: "00000000-0000-4000-8000-000000000099",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              documentNumber: "MSCU1234567",
              title: "Packing List Confidencial",
              status: "indexed",
              metadata: {
                confidentialCosts: true,
                totalAmount: 17650,
                totals: {
                  totalAmount: 17650,
                  currency: "USD",
                  subtotal: 17650,
                  tax: 0,
                },
                queryRestrictions: { confidentialCosts: true },
              },
              chunkIndex: 0,
              chunkType: "document_summary",
              content:
                "[RESUMEN DE DOCUMENTO: PACKING LIST LOGÍSTICO]\n- Contenedor: MSCU1234567\n- Valor Total FOB Estimado: $17650.00 USD\n- Total FOB: $17650.00",
              tokenCount: 25,
              createdAt: new Date(),
            },
          ];
        } else if (opts?.mixedDocs) {
          rows = [
            {
              id: "00000000-0000-4000-8000-000000000001",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              documentNumber: "PL-ALLOWED",
              title: "General Doc",
              status: "indexed",
              metadata: {
                totalAmount: 5000,
                totals: { totalAmount: 5000 },
                accessRoles: ["owner", "admin", "supervisor", "employee"],
              },
              createdAt: new Date(),
            },
            {
              id: "00000000-0000-4000-8000-000000000002",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              documentNumber: "PL-FORBIDDEN",
              title: "Owner Only Doc",
              status: "indexed",
              metadata: {
                accessRules: { allowedRoles: ["owner", "admin"] },
              },
              createdAt: new Date(),
            },
          ];
        } else if (opts?.confidentialDoc) {
          rows = [
            {
              id: "00000000-0000-4000-8000-000000000099",
              workspaceId: TEST_WORKSPACE_ID,
              documentType: "packing_list",
              documentNumber: "MSCU1234567",
              title: "Packing List Confidencial",
              status: "indexed",
              metadata: {
                confidentialCosts: true,
                queryRestrictions: { confidentialCosts: true },
              },
              chunkIndex: 0,
              chunkType: "row_group",
              content:
                "- Fila 1 | SKU: AUT-1 | Amortiguador | P.Unit FOB: $45.00 | Total FOB: $450.00",
              tokenCount: 20,
              createdAt: new Date(),
            },
          ];
        } else {
          rows = [
            {
              id: nextMockId(),
              workspaceId: TEST_WORKSPACE_ID,
              plan: "pro",
              fullName: "Test User",
              documentType: "packing_list",
              documentNumber: "PL-001",
              title: "Doc 1",
              status: "indexed",
              metadata: {
                accessRoles: ["owner", "admin", "supervisor", "employee"],
              },
              chunkIndex: 0,
              chunkType: "document_summary",
              content: "Contenido de prueba de documento general",
              tokenCount: 15,
              distance: 0.1,
              createdAt: new Date(),
            },
          ];
        }
        return Promise.resolve(rows).then(onFulfilled, onRejected);
      };
      return self;
    };

    const fakeDb = {
      execute: () =>
        Promise.resolve({
          rows: [
            {
              member_id: nextMockId(),
              member_role: role,
              member_status: "active",
            },
          ],
        }),
      select: () => chain(),
      insert: () => chain(),
      transaction: (fn: (tx: unknown) => Promise<unknown>) => fn(fakeDb),
    };

    return createRagCaller({
      user: {
        id: "00000000-0000-4000-8000-000000000088",
        email: `${role}@example.com`,
        vendorId:
          opts?.userVendorId ?? (role === "vendor" ? VENDOR_A_ID : undefined),
      },
      db: fakeDb as never,
      requestId: `req-${role}`,
      membershipCache: new Map(),
      afterCommit: [],
      sessionActivityChecked: true,
      log: logger.child({ requestId: `req-${role}` }),
      workspaceId: TEST_WORKSPACE_ID,
    });
  }

  it("gating: `rag.ingestDocument` requires containers:update and forbids employee or vendor", async () => {
    const employeeCaller = createCallerForRole("employee");
    const vendorCaller = createCallerForRole("vendor");
    const ownerCaller = createCallerForRole("owner");

    const validIngestInput = {
      documentType: "packing_list" as const,
      documentNumber: "CONT-1234",
      title: "Contenedor Ingest Test",
      chunks: [
        {
          chunkIndex: 0,
          chunkType: "document_summary" as const,
          content: "Resumen de contenedor",
        },
      ],
    };

    // Employee lacks containers:update -> throws FORBIDDEN
    await expect(
      employeeCaller.rag.ingestDocument(validIngestInput),
    ).rejects.toThrow(TRPCError);
    await expect(
      employeeCaller.rag.ingestDocument(validIngestInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // Vendor lacks containers:update -> throws FORBIDDEN
    await expect(
      vendorCaller.rag.ingestDocument(validIngestInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    // Owner has containers:update -> executes successfully
    const result = await ownerCaller.rag.ingestDocument(validIngestInput);
    expect(result).toBeDefined();
    expect(result.status).toBe("indexed");
  });

  it("gating: `rag.search` allows roles with orders:read and returns matching results", async () => {
    const employeeCaller = createCallerForRole("employee");

    const searchResult = await employeeCaller.rag.search({
      query: "repuestos automotrices",
      limit: 5,
      minScore: 0.1,
    });

    expect(searchResult).toBeDefined();
    expect(searchResult.query).toBe("repuestos automotrices");
    expect(Array.isArray(searchResult.results)).toBe(true);
  });

  it("validation: `rag.search` rejects empty queries with BAD_REQUEST", async () => {
    const ownerCaller = createCallerForRole("owner");

    await expect(
      ownerCaller.rag.search({
        query: "",
        limit: 10,
      }),
    ).rejects.toThrow();
  });

  it("`rag.getDocument`: returns NOT_FOUND when document does not exist", async () => {
    const caller = createCallerForRole("owner", { emptyDoc: true });

    await expect(
      caller.rag.getDocument({
        id: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("`rag.getDocument`: redacts confidential costs for non-management roles and preserves them for management", async () => {
    const employeeCaller = createCallerForRole("employee", {
      confidentialDoc: true,
    });
    const ownerCaller = createCallerForRole("owner", { confidentialDoc: true });

    // Employee gets redacted chunk content
    const employeeDoc = await employeeCaller.rag.getDocument({
      id: "00000000-0000-4000-8000-000000000099",
    });
    expect(employeeDoc.chunks.length).toBe(1);
    const empChunk = employeeDoc.chunks[0];
    expect(empChunk).toBeDefined();
    expect(empChunk?.content).toContain("[CONFIDENCIAL]");
    expect(empChunk?.content).not.toContain("$45.00");
    expect(empChunk?.content).not.toContain("$450.00");

    // Owner gets unredacted chunk content
    const ownerDoc = await ownerCaller.rag.getDocument({
      id: "00000000-0000-4000-8000-000000000099",
    });
    expect(ownerDoc.chunks.length).toBe(1);
    const ownerChunk = ownerDoc.chunks[0];
    expect(ownerChunk).toBeDefined();
    expect(ownerChunk?.content).toContain("P.Unit FOB: $45.00");
    expect(ownerChunk?.content).toContain("Total FOB: $450.00");
  });

  it("`rag.listDocuments`: retrieves workspace document inventory", async () => {
    const caller = createCallerForRole("employee");

    const docs = await caller.rag.listDocuments({
      limit: 10,
    });

    expect(Array.isArray(docs)).toBe(true);
  });

  it("`rag.getDocument`: throws FORBIDDEN when caller's role is not permitted by accessRules", async () => {
    const employeeCaller = createCallerForRole("employee", {
      restrictedDoc: true,
      allowedRoles: ["owner", "admin"],
    });

    await expect(
      employeeCaller.rag.getDocument({
        id: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const ownerCaller = createCallerForRole("owner", {
      restrictedDoc: true,
      allowedRoles: ["owner", "admin"],
    });

    const ownerDoc = await ownerCaller.rag.getDocument({
      id: "00000000-0000-4000-8000-000000000099",
    });
    expect(ownerDoc.document).toBeDefined();
  });

  it("`rag.getDocument`: throws FORBIDDEN when vendor attempts cross-vendor document access", async () => {
    const vendorACaller = createCallerForRole("vendor", {
      restrictedVendorDoc: true,
      docVendorId: VENDOR_B_ID,
      userVendorId: VENDOR_A_ID,
    });

    await expect(
      vendorACaller.rag.getDocument({
        id: "00000000-0000-4000-8000-000000000099",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("`rag.getDocument`: sanitizes document metadata totals and summary chunks with estimated total FOB for employee", async () => {
    const employeeCaller = createCallerForRole("employee", {
      confidentialDocWithTotals: true,
    });

    const result = await employeeCaller.rag.getDocument({
      id: "00000000-0000-4000-8000-000000000099",
    });

    // Master document metadata totals must be sanitized
    const docMeta = result.document.metadata as Record<string, unknown>;
    expect(docMeta.totalAmount).toBeUndefined();
    expect(
      (docMeta.totals as Record<string, unknown> | undefined)?.totalAmount,
    ).toBeUndefined();

    // Summary chunk containing '- Valor Total FOB Estimado: $...' must be redacted
    expect(result.chunks.length).toBeGreaterThan(0);
    const summaryChunk = result.chunks[0];
    expect(summaryChunk?.content).toContain("Valor Total FOB: [CONFIDENCIAL]");
    expect(summaryChunk?.content).not.toContain("$17650.00");
  });

  it("`rag.listDocuments`: filters out unauthorized documents and sanitizes metadata for employee", async () => {
    const employeeCaller = createCallerForRole("employee", {
      mixedDocs: true,
    });

    const docs = await employeeCaller.rag.listDocuments({ limit: 10 });
    expect(Array.isArray(docs)).toBe(true);
    // Should filter out PL-FORBIDDEN (which is owner/admin only)
    expect(docs.every((d) => d.documentNumber !== "PL-FORBIDDEN")).toBe(true);
    for (const doc of docs) {
      const meta = doc.metadata as Record<string, unknown>;
      expect(meta.totalAmount).toBeUndefined();
      expect(
        (meta.totals as Record<string, unknown> | undefined)?.totalAmount,
      ).toBeUndefined();
    }
  });
});
