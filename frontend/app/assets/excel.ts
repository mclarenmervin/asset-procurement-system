import ExcelJS from "exceljs";

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

export async function parseAssetExcel(file: File) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.rowCount < 1)
    throw new Error("The Excel workbook is empty");
  const headerValues = rowValues(sheet.getRow(1));
  const normalized = headerValues.map((value) => value.trim().toLowerCase());
  const indexes = assetHeaders.map((header) =>
    normalized.indexOf(header.toLowerCase()),
  );
  const missing = ["Asset Tag", "Product", "Category"].filter(
    (header) => !normalized.includes(header.toLowerCase()),
  );
  if (missing.length)
    throw new Error(
      `Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    );
  const records: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = rowValues(row);
    if (!values.some((value) => value.trim())) return;
    records.push(
      Object.fromEntries(
        fields.map((field, index) => [
          field,
          indexes[index] < 0 ? "" : values[indexes[index]]?.trim() || "",
        ]),
      ),
    );
  });
  return records;
}

export async function downloadAssetTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "AssetFlow Enterprise";
  const sheet = workbook.addWorksheet("Asset Import", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.addRow([...assetHeaders]);
  sheet.addRow([
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
    25000,
    new Date(2026, 7, 20),
    new Date(2026, 7, 21),
    new Date(2027, 7, 20),
    "",
    "Optional notes",
  ]);
  sheet.columns.forEach((column, index) => {
    column.width = Math.min(34, Math.max(14, assetHeaders[index].length + 3));
  });
  const header = sheet.getRow(1);
  header.height = 26;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF173B62" },
  };
  header.alignment = { vertical: "middle" };
  sheet.autoFilter = `A1:Q2`;
  [13, 14, 15, 16].forEach((column) => {
    sheet.getColumn(column).numFmt = "yyyy-mm-dd";
  });
  sheet.getRow(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF4F7FB" },
  };
  sheet.getRow(2).alignment = { vertical: "middle", wrapText: true };
  const output = await workbook.xlsx.writeBuffer();
  saveWorkbook("asset-import-template.xlsx", output);
}

function rowValues(row: ExcelJS.Row) {
  return Array.from(
    { length: Math.max(row.cellCount, assetHeaders.length) },
    (_, index) => {
      const value = row.getCell(index + 1).value;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      if (value && typeof value === "object") {
        if ("text" in value) return String(value.text ?? "");
        if ("result" in value) return String(value.result ?? "");
      }
      return String(value ?? "");
    },
  );
}

function saveWorkbook(name: string, buffer: ExcelJS.Buffer) {
  const blob = new Blob([buffer as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
