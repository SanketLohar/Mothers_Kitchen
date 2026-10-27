import * as XLSX from "xlsx";

/**
 * Generates and triggers download of a genuine .xlsx workbook file.
 * 
 * @param {Array<object>} data Array of objects to export
 * @param {string} fileName Desired download filename (without extension)
 * @param {string} sheetName WorkSheet tab name
 */
export function exportToExcel(data, fileName = "export", sheetName = "Data") {
  if (!data || !data.length) {
    throw new Error("No data available to export");
  }

  // Create worksheet from json data
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto-fit column widths
  const columnKeys = Object.keys(data[0] || {});
  const colWidths = columnKeys.map((key) => {
    let maxLen = key.length;
    data.forEach((row) => {
      const val = row[key];
      if (val !== null && val !== undefined) {
        const strLen = String(val).length;
        if (strLen > maxLen) maxLen = strLen;
      }
    });
    return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
  });
  worksheet["!cols"] = colWidths;

  // Create workbook and append worksheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Write file and trigger browser download
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}
