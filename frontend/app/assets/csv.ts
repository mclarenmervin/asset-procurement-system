export const assetHeaders = [
  "Asset Tag",
  "Serial",
  "Product",
  "Category",
  "Tags",
  "Status",
  "Vendor",
  "Department",
  "Location",
  "Custodian",
  "Purchase Order",
  "Purchase Price",
  "Purchase Date",
  "Commissioning Date",
  "Warranty End",
  "Expiry",
  "Notes",
] as const;

const fields = [
  "assetTag",
  "serialNumber",
  "product",
  "category",
  "tags",
  "status",
  "vendor",
  "department",
  "location",
  "custodian",
  "purchaseOrder",
  "purchasePrice",
  "purchaseDate",
  "commissioningDate",
  "warrantyEndDate",
  "expiryDate",
  "notes",
] as const;

export function parseAssetCsv(text: string) {
  const records = parseCsv(text.replace(/^\uFEFF/, ""));
  if (!records.length) throw new Error("The CSV file is empty");
  const normalized = records[0].map((value) => value.trim().toLowerCase());
  const indexes = assetHeaders.map((header) =>
    normalized.indexOf(header.toLowerCase()),
  );
  const required = ["Asset Tag", "Product", "Category"];
  const missing = required.filter(
    (header) => normalized.indexOf(header.toLowerCase()) < 0,
  );
  if (missing.length)
    throw new Error(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  return records
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row) =>
      Object.fromEntries(
        fields.map((field, index) => [
          field,
          indexes[index] < 0 ? "" : (row[indexes[index]] || "").trim(),
        ]),
      ),
    );
}

export function downloadAssetTemplate() {
  const example = [
    "AST-1001",
    "SN-001",
    "Product SKU or name",
    "Category code or name",
    "critical; outdoor",
    "IN_STOCK",
    "Vendor code or name",
    "Department code or name",
    "Location code or name",
    "user@example.com",
    "PO-001",
    "25000",
    "2026-08-20",
    "2026-08-21",
    "2027-08-20",
    "",
    "Optional notes",
  ];
  saveCsv("asset-import-template.csv", [
    assetHeaders as unknown as string[],
    example,
  ]);
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function saveCsv(name: string, rows: string[][]) {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  const blob = new Blob(
    ["\uFEFF" + rows.map((row) => row.map(escape).join(",")).join("\r\n")],
    { type: "text/csv;charset=utf-8" },
  );
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
