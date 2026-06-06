import * as XLSX from "xlsx";

export function exportToExcel(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert("Tidak ada data untuk diekspor");
    return;
  }
  
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
  
  // Create buffer and save
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
}
