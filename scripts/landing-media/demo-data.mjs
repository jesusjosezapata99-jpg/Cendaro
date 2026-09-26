/**
 * Fictitious demo company for the landing recordings
 * (PLAN-2026-09-LANDING-REDESIGN T3.1). Every name, RIF, cédula, phone and
 * amount here is invented; nothing comes from production data.
 *
 * "Distribuidora Aurora, C.A." — a cleaning, home and hardware distributor
 * in Valencia, Carabobo, importing part of its range from China.
 */

export const DEMO = {
  organization: {
    name: "Distribuidora Aurora",
    legalName: "Distribuidora Aurora, C.A.",
    rifDigits: "50123456",
  },
  workspace: {
    name: "Distribuidora Aurora",
    slug: "distribuidora-aurora-demo",
  },
  owner: {
    fullName: "Gabriela Rivas",
    username: "demo.aurora",
    email: "demo.aurora@example.com",
  },
  profile: {
    city: "Valencia",
    state: "Carabobo",
    country: "VE",
    address: "Zona Industrial Norte, Galpón 14, Valencia, Carabobo",
    phone: "0241-555-0142",
    supportEmail: "ventas@example.com",
  },
};

export const WAREHOUSES = [
  {
    key: "central",
    name: "Almacén Central Valencia",
    type: "warehouse",
    location: "Zona Industrial Norte, Valencia",
  },
  {
    key: "tienda",
    name: "Tienda Av. Bolívar",
    type: "showroom",
    location: "Av. Bolívar Norte, Valencia",
  },
  {
    key: "transito",
    name: "Tránsito Puerto Cabello",
    type: "transit",
    location: "Puerto Cabello, Carabobo",
  },
];

export const CATEGORIES = [
  { key: "limpieza", name: "Limpieza" },
  { key: "hogar", name: "Hogar y cocina" },
  { key: "ferreteria", name: "Ferretería" },
  { key: "cuidado", name: "Cuidado personal" },
  { key: "papeleria", name: "Papelería" },
];

export const BRANDS = [
  "Brisa",
  "Nubia",
  "Ferrocasa",
  "Lumen",
  "Cristal",
  "Tauro",
  "Andina",
  "Marelo",
];

export const SUPPLIERS = [
  { key: "ningbo", name: "Ningbo Haoyu Trading Co.", country: "CN", contact: "Lily Chen" },
  { key: "yiwu", name: "Yiwu Sunrise Household Ltd.", country: "CN", contact: "Kevin Zhou" },
  { key: "guangzhou", name: "Guangzhou Mingda Hardware", country: "CN", contact: "Jason Li" },
  { key: "quimicos", name: "Químicos del Centro, C.A.", country: "VE", contact: "Ramón Pérez" },
  { key: "plasticos", name: "Plásticos Carabobo, C.A.", country: "VE", contact: "Daniela Soto" },
];

/**
 * [sku, name, category, brand index, supplier, cost USD, store USD,
 *  wholesale USD, stock central, stock tienda]
 */
export const PRODUCTS = [
  ["LIM-001", "Detergente líquido 2 L", "limpieza", 0, "quimicos", 2.1, 3.9, 3.2, 420, 36],
  ["LIM-002", "Cloro concentrado 1 L", "limpieza", 0, "quimicos", 0.8, 1.6, 1.25, 610, 48],
  ["LIM-003", "Desinfectante lavanda 1 L", "limpieza", 1, "quimicos", 1.1, 2.2, 1.75, 380, 24],
  ["LIM-004", "Lavaplatos en crema 500 g", "limpieza", 1, "quimicos", 0.95, 1.9, 1.5, 3, 2],
  ["LIM-005", "Suavizante de ropa 2 L", "limpieza", 0, "quimicos", 1.9, 3.6, 2.95, 210, 18],
  ["LIM-006", "Limpiavidrios con atomizador 500 ml", "limpieza", 4, "quimicos", 1.2, 2.4, 1.9, 145, 20],
  ["LIM-007", "Esponja doble uso x3", "limpieza", 4, "yiwu", 0.35, 0.95, 0.7, 980, 64],
  ["LIM-008", "Paño de microfibra 40×40 x2", "limpieza", 4, "yiwu", 0.6, 1.5, 1.15, 540, 40],
  ["LIM-009", "Coleto de algodón", "limpieza", 6, "plasticos", 1.3, 2.7, 2.1, 260, 22],
  ["LIM-010", "Escoba plástica con palo", "limpieza", 6, "plasticos", 1.8, 3.5, 2.8, 2, 1],
  ["LIM-011", "Bolsas de basura 30 L x20", "limpieza", 6, "plasticos", 0.9, 1.8, 1.4, 720, 50],
  ["LIM-012", "Guantes de látex talla M", "limpieza", 4, "yiwu", 0.55, 1.3, 1.0, 330, 30],
  ["HOG-001", "Juego de ollas de aluminio x5", "hogar", 7, "ningbo", 18.5, 34.9, 29.0, 64, 6],
  ["HOG-002", "Sartén antiadherente 26 cm", "hogar", 7, "ningbo", 6.2, 12.9, 10.5, 118, 10],
  ["HOG-003", "Termo de acero 1 L", "hogar", 3, "ningbo", 4.1, 8.9, 7.2, 96, 12],
  ["HOG-004", "Set de cubiertos x24", "hogar", 7, "ningbo", 5.4, 11.5, 9.3, 2, 1],
  ["HOG-005", "Contenedor hermético 1,5 L x3", "hogar", 3, "yiwu", 2.3, 5.2, 4.1, 240, 20],
  ["HOG-006", "Tabla de cortar bambú", "hogar", 3, "yiwu", 2.0, 4.6, 3.6, 150, 14],
  ["HOG-007", "Vaso de vidrio 350 ml x6", "hogar", 4, "ningbo", 3.1, 6.8, 5.4, 132, 16],
  ["HOG-008", "Cafetera italiana 6 tazas", "hogar", 7, "ningbo", 5.9, 12.5, 10.2, 58, 8],
  ["HOG-009", "Toallero de cocina x3", "hogar", 3, "yiwu", 1.4, 3.2, 2.5, 310, 26],
  ["HOG-010", "Organizador plástico 12 L", "hogar", 6, "plasticos", 2.6, 5.5, 4.4, 190, 12],
  ["FER-001", "Taladro percutor 650 W", "ferreteria", 5, "guangzhou", 24.0, 45.0, 38.0, 42, 4],
  ["FER-002", "Juego de destornilladores x12", "ferreteria", 5, "guangzhou", 4.8, 9.9, 8.1, 88, 10],
  ["FER-003", "Cinta métrica 5 m", "ferreteria", 5, "guangzhou", 1.2, 2.9, 2.3, 260, 24],
  ["FER-004", "Martillo de uña 16 oz", "ferreteria", 2, "guangzhou", 3.4, 7.2, 5.8, 96, 9],
  ["FER-005", "Candado de acero 40 mm", "ferreteria", 2, "guangzhou", 2.2, 4.8, 3.9, 170, 15],
  ["FER-006", "Bombillo LED 12 W luz blanca", "ferreteria", 3, "ningbo", 0.9, 2.1, 1.65, 860, 70],
  ["FER-007", "Extensión eléctrica 5 m", "ferreteria", 3, "ningbo", 3.0, 6.5, 5.2, 3, 1],
  ["FER-008", "Cinta aislante x3", "ferreteria", 2, "guangzhou", 0.7, 1.7, 1.3, 420, 30],
  ["FER-009", "Silicón transparente 280 ml", "ferreteria", 2, "quimicos", 1.9, 4.1, 3.3, 140, 12],
  ["FER-010", "Brocha de 3 pulgadas", "ferreteria", 2, "guangzhou", 0.8, 1.9, 1.5, 230, 18],
  ["CUI-001", "Jabón de tocador x3", "cuidado", 1, "quimicos", 1.0, 2.2, 1.75, 520, 44],
  ["CUI-002", "Champú herbal 750 ml", "cuidado", 1, "quimicos", 2.4, 4.9, 3.95, 210, 20],
  ["CUI-003", "Crema dental 100 ml", "cuidado", 1, "quimicos", 0.9, 1.95, 1.55, 640, 52],
  ["CUI-004", "Papel higiénico doble hoja x12", "cuidado", 6, "plasticos", 3.3, 6.4, 5.3, 300, 30],
  ["CUI-005", "Desodorante en barra 50 g", "cuidado", 1, "quimicos", 1.3, 2.9, 2.3, 0, 0],
  ["CUI-006", "Toallas húmedas x80", "cuidado", 1, "yiwu", 1.1, 2.5, 2.0, 260, 24],
  ["PAP-001", "Cuaderno universitario 100 h", "papeleria", 3, "yiwu", 0.85, 1.9, 1.5, 700, 60],
  ["PAP-002", "Bolígrafos azules x12", "papeleria", 3, "yiwu", 1.1, 2.6, 2.05, 380, 36],
  ["PAP-003", "Resma papel carta 500 h", "papeleria", 4, "plasticos", 3.8, 6.9, 5.9, 160, 14],
  ["PAP-004", "Marcadores permanentes x4", "papeleria", 3, "yiwu", 1.4, 3.1, 2.45, 210, 18],
];

/**
 * Fictitious customers:
 * [name, type, idType, letter, number, phone, credit USD, credit days].
 */
export const CUSTOMERS = [
  ["Bodega La Esquina", "retail", "rif", "J", "41234567", "0414-555-0101", 0, 0],
  ["Abastos El Sol", "wholesale", "rif", "J", "40987654", "0424-555-0102", 1500, 15],
  ["Comercial Dos Hermanos", "wholesale", "rif", "J", "31456789", "0412-555-0103", 2500, 30],
  ["Ferretería El Tornillo", "distributor", "rif", "J", "29876543", "0241-555-0104", 4000, 30],
  ["Minimarket Los Andes", "retail", "rif", "J", "40765432", "0416-555-0105", 800, 15],
  ["Inversiones Paraparal", "wholesale", "rif", "J", "30567891", "0414-555-0106", 3000, 30],
  ["Farmacia Santa Rosa", "retail", "rif", "J", "41876502", "0424-555-0107", 0, 0],
  ["Distribuidora Guacara", "distributor", "rif", "J", "29345671", "0245-555-0108", 6000, 45],
  ["Supermercado San Diego", "wholesale", "rif", "J", "40123987", "0241-555-0109", 3500, 30],
  ["Librería Escolar Naguanagua", "retail", "rif", "J", "41567234", "0412-555-0110", 600, 15],
  ["Carlos Mendoza", "retail", "cedula", "V", "18456732", "0414-555-0111", 0, 0],
  ["María Fernanda Gil", "retail", "cedula", "V", "20981345", "0424-555-0112", 0, 0],
  ["José Luis Paredes", "vip", "cedula", "V", "15673421", "0416-555-0113", 500, 15],
  ["Ana Karina Salas", "retail", "cedula", "V", "22345678", "0412-555-0114", 0, 0],
  ["Multiservicios Tocuyito", "wholesale", "rif", "J", "30987612", "0241-555-0115", 2000, 30],
  ["Bodegón Prebo", "retail", "rif", "J", "41098765", "0414-555-0116", 0, 0],
  ["Hogar Express Los Guayos", "distributor", "rif", "J", "40432198", "0245-555-0117", 5000, 45],
  ["Comercial Tres Estrellas", "wholesale", "rif", "J", "31234098", "0424-555-0118", 1800, 15],
  ["Luisa Hernández", "retail", "cedula", "V", "17890123", "0412-555-0119", 0, 0],
  ["Tienda ML Oficial Aurora", "marketplace", "rif", "J", "50123457", "0414-555-0120", 0, 0],
];

/**
 * Packing list of the container in transit, as the AI returned it:
 * [supplier name, translated name, sku hint, qty, unit cost USD,
 *  matched sku or null, confidence].
 */
export const CONTAINER_ITEMS = [
  ["Aluminum cookware set 5pcs", "Juego de ollas de aluminio x5", "HOG-001", 240, 17.9, "HOG-001", 0.97],
  ["Non-stick frying pan 26cm", "Sartén antiadherente 26 cm", "HOG-002", 400, 5.95, "HOG-002", 0.95],
  ["Stainless vacuum flask 1L", "Termo de acero 1 L", "HOG-003", 300, 3.9, "HOG-003", 0.93],
  ["Cutlery set 24pcs gift box", "Set de cubiertos x24", "HOG-004", 360, 5.1, "HOG-004", 0.91],
  ["Moka pot 6 cups", "Cafetera italiana 6 tazas", "HOG-008", 200, 5.6, "HOG-008", 0.94],
  ["Impact drill 650W 220V", "Taladro percutor 650 W", "FER-001", 120, 23.2, "FER-001", 0.96],
  ["Screwdriver set 12pcs", "Juego de destornilladores x12", "FER-002", 300, 4.6, "FER-002", 0.92],
  ["LED bulb 12W 6500K E27", "Bombillo LED 12 W luz blanca", "FER-006", 2400, 0.82, "FER-006", 0.98],
  ["Extension cord 5m 3 outlets", "Extensión eléctrica 5 m", "FER-007", 300, 2.85, "FER-007", 0.9],
  ["Microfiber cloth 40x40 2pcs", "Paño de microfibra 40×40 x2", "LIM-008", 1500, 0.55, "LIM-008", 0.95],
  ["Kitchen scale digital 5kg", "Balanza de cocina digital 5 kg", null, 180, 3.4, null, 0.42],
  ["Silicone baking mat 40x30", "Lámina de silicona para horno 40×30", null, 240, 1.25, null, 0.38],
];

/** Mercado Libre listings recorded in Cendaro: [sku, title, price USD]. */
export const ML_LISTINGS = [
  ["HOG-001", "Juego De Ollas Aluminio 5 Piezas Aurora", 36.9],
  ["FER-001", "Taladro Percutor 650w Con Maletín", 47.5],
  ["HOG-008", "Cafetera Italiana 6 Tazas Aluminio", 13.4],
  ["FER-006", "Bombillo Led 12w Luz Blanca Pack", 2.3],
  ["HOG-003", "Termo Acero Inoxidable 1 Litro", 9.5],
];

/** Rates the demo history ends at (Bs per USD; CNY per USD). */
export const RATES_TODAY = { bcv: 853.4993, parallel: 957.32, rmb_usd: 6.7074 };
