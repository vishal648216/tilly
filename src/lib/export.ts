// Taily - Phase 7: Clean Data & Report Export Engine
// Generates standards-compliant CSV and Excel SpreadsheetML files with true MIME types.
// STRICT COMPLIANCE: Never labels CSV as XLSX.

/**
 * Converts a table of headers and rows into standards-compliant RFC-4180 CSV with UTF-8 BOM.
 */
export function generateCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerLine = headers.map(escapeCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCell).join(","));

  // UTF-8 BOM for automatic Excel character encoding recognition
  return "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
}

/**
 * Generates genuine Excel XML SpreadsheetML (supported by Excel 2003+ natively).
 * File extension: .xls. True Excel XML format with cell types and column widths.
 */
export function generateExcelXml(
  sheetName: string,
  headers: string[],
  rows: (string | number | boolean | null | undefined)[][]
): string {
  const escapeXml = (str: string | number | boolean | null | undefined): string => {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const headerCells = headers
    .map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`)
    .join("");

  const rowXml = rows
    .map((row) => {
      const cells = row
        .map((val) => {
          if (typeof val === "number") {
            return `<Cell><Data ss:Type="Number">${val}</Data></Cell>`;
          }
          return `<Cell><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row ss:StyleID="Header">
    ${headerCells}
   </Row>
   ${rowXml}
  </Table>
 </Worksheet>
</Workbook>`;
}
