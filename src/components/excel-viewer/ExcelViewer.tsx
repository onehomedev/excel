import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import "jspdf-autotable";
import initSqlJs from "sql.js";
import { Button } from "@/components/ui/button";
import { DatabaseIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import HelpOverlay from "@/components/help-overlay";
import DatabaseManager from "./DatabaseManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

interface ExcelData {
  headers: string[];
  rows: any[][];
  tableName?: string;
}

interface CustomColumn {
  name: string;
}

export default function ExcelViewer() {
  const { toast } = useToast();
  const [excelData, setExcelData] = useState<ExcelData | null>(null);
  const [hasHeaders, setHasHeaders] = useState<boolean | null>(null);
  const [customHeaders, setCustomHeaders] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [SQL, setSQL] = useState<any>(null);

  useEffect(() => {
    initSqlJs({
      locateFile: (file) => `/${file}`,
    }).then((sql) => {
      setSQL(sql);
    });
  }, []);

  const rowsPerPage = 25;

  const loadTableData = (
    headers: string[],
    rows: any[][],
    tableName?: string,
  ) => {
    setExcelData({ headers, rows, tableName });
    setHasHeaders(true);
    setCustomColumns([]);
    setCurrentPage(1);
  };

  const handleCellEdit = (
    rowIndex: number,
    colIndex: number,
    value: string,
  ) => {
    setExcelData((prev) => {
      if (!prev) return null;
      const newRows = prev.rows.map((row) => [...row]); // Create deep copy of all rows

      // Ensure the row exists and has the right number of columns
      if (!newRows[rowIndex]) {
        newRows[rowIndex] = new Array(prev.headers.length).fill("");
      } else if (newRows[rowIndex].length < prev.headers.length) {
        // Fill any missing columns with empty strings
        while (newRows[rowIndex].length < prev.headers.length) {
          newRows[rowIndex].push("");
        }
      }

      // Update the cell value
      newRows[rowIndex][colIndex] = value;

      return {
        ...prev,
        rows: newRows,
      };
    });
  };

  const saveChangesToDatabase = () => {
    if (
      !excelData?.tableName ||
      !excelData?.headers ||
      !excelData?.rows ||
      !SQL
    )
      return;

    try {
      // Get existing database content
      const savedDb = localStorage.getItem("excelViewerDb");
      const db = savedDb
        ? new SQL.Database(new Uint8Array(JSON.parse(savedDb)))
        : new SQL.Database();

      // Drop and recreate table with current schema
      db.run(`DROP TABLE IF EXISTS ${excelData.tableName}`);
      const columns = excelData.headers
        .map((header) => `${header.replace(/\W/g, "_")} TEXT`)
        .join(", ");

      db.run(`CREATE TABLE ${excelData.tableName} (${columns})`);

      // Insert all rows
      const placeholders = excelData.headers.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${excelData.tableName} VALUES (${placeholders})`,
      );

      excelData.rows.forEach((row) => {
        stmt.run(row);
      });

      stmt.free();

      // Save to localStorage
      const data = db.export();
      const arr = Array.from(data);
      localStorage.setItem("excelViewerDb", JSON.stringify(arr));

      toast({
        title: "Changes Saved",
        description: "Your changes have been saved successfully",
        duration: 2000,
        className: "bg-primary/20 border-primary/30 text-primary-foreground",
      });
      const closeEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      document
        .querySelector("[data-radix-focus-guard]")
        ?.parentElement?.querySelector('button[type="button"]')
        ?.dispatchEvent(closeEvent);
    } catch (err) {
      setError("Error saving changes");
    }
  };

  const MAX_FILE_SIZE = 100 * 1024; // 100KB in bytes

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "File too large",
        description: `File size must be less than 100KB. Current file size: ${(file.size / 1024).toFixed(2)}KB`,
      });
      return;
    }

    setIsLoading(true);
    setLoadingProgress(0);

    try {
      // Use chunks for large files
      const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
      const fileSize = file.size;
      const chunks = Math.ceil(fileSize / CHUNK_SIZE);
      const arrayBuffer = new ArrayBuffer(fileSize);
      const uint8Array = new Uint8Array(arrayBuffer);

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileSize);
        const chunk = file.slice(start, end);

        const chunkArrayBuffer = await new Promise<ArrayBuffer>(
          (resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(chunk);
          },
        );

        uint8Array.set(new Uint8Array(chunkArrayBuffer), start);
        setLoadingProgress(Math.round((end / fileSize) * 100));
      }

      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

      if (jsonData.length === 0) {
        toast({
          variant: "destructive",
          title: "Empty file",
          description: "The uploaded file is empty",
        });
        return;
      }

      setExcelData({
        headers: [],
        rows: jsonData as any[][],
      });
      setHasHeaders(null); // Prompt user for headers
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error reading file",
        description: "Please make sure it's a valid Excel file.",
      });
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };

  const handleHeadersConfirmation = (hasHeaders: boolean) => {
    setHasHeaders(hasHeaders);
    if (hasHeaders) {
      setExcelData((prev) => ({
        headers: prev?.rows[0] as string[],
        rows: prev?.rows.slice(1) || [],
      }));
    } else {
      const columnCount = excelData?.rows[0]?.length || 0;
      setCustomHeaders(Array(columnCount).fill(""));
    }
  };

  const handleCustomHeaderChange = (index: number, value: string) => {
    setCustomHeaders((prev) => {
      const newHeaders = [...prev];
      newHeaders[index] = value;
      return newHeaders;
    });
  };

  const applyCustomHeaders = () => {
    if (customHeaders.some((header) => !header)) {
      setError("Please provide names for all columns");
      return;
    }
    setExcelData((prev) => ({
      headers: customHeaders,
      rows: prev?.rows || [],
    }));
    setHasHeaders(true);
  };

  const totalPages = Math.ceil((excelData?.rows.length || 0) / rowsPerPage);

  const addCustomColumn = () => {
    if (!newColumnName) {
      setError("Please provide a name for the custom column");
      return;
    }

    if (!excelData) {
      setError("No data loaded");
      return;
    }

    // Create new column
    const newColumn = { name: newColumnName };

    // Create new rows with empty value for new column
    const updatedRows = excelData.rows.map((row) => {
      const newRow = Array.from(row); // Create a new array from the row
      newRow.push(""); // Add empty string for new column
      return newRow;
    });

    // Create new headers array
    const updatedHeaders = [...excelData.headers, newColumn.name];

    // Update state
    setExcelData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        headers: updatedHeaders,
        rows: updatedRows,
        tableName: prev.tableName,
      };
    });

    // Update UI state
    setCustomColumns((prev) => [...prev, newColumn]);
    setNewColumnName("");
    setShowCustomColumnDialog(false);
    setError(null);

    toast({
      title: "Column Added",
      description: `New column "${newColumnName}" has been added successfully`,
      duration: 2000,
      className: "bg-primary/20 border-primary/30 text-primary-foreground",
    });
  };

  const currentRows =
    excelData?.rows.slice(
      (currentPage - 1) * rowsPerPage,
      currentPage * rowsPerPage,
    ) || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b">
        <div className="container mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => (window.location.href = "/")}
                className="hover:bg-muted"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="m12 19-7-7 7-7" />
                  <path d="M19 12H5" />
                </svg>
              </Button>
              <h1 className="text-xl font-semibold">Excel Viewer</h1>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
      <div className="bg-card py-12 border-b">
        <div className="container mx-auto px-4">
          <p className="text-lg text-muted-foreground mb-8">
            Upload Excel files or load from database to view and analyze your
            data.
          </p>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 space-y-8">
        <Dialog open={isLoading} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Loading File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {loadingProgress}% Complete
              </p>
            </div>
          </DialogContent>
        </Dialog>
        <div
          className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-primary cursor-pointer transition-colors max-w-sm bg-muted/5"
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (!file) return;

            if (file.size > MAX_FILE_SIZE) {
              toast({
                variant: "destructive",
                title: "File too large",
                description: `File size must be less than 100KB. Current file size: ${(file.size / 1024).toFixed(2)}KB`,
              });
              return;
            }

            if (
              file &&
              (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))
            ) {
              const event = {
                target: { files: [file] },
              } as React.ChangeEvent<HTMLInputElement>;
              handleFileUpload(event);
            } else {
              toast({
                variant: "destructive",
                title: "Invalid file type",
                description: "Please upload an Excel file (.xlsx or .xls)",
              });
            }
          }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".xlsx,.xls";
            input.onchange = (e) =>
              handleFileUpload(e as React.ChangeEvent<HTMLInputElement>);
            input.click();
          }}
        >
          <div className="space-y-2">
            <p>Drag and drop your Excel file here</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Maximum file size: 100KB
            </p>
          </div>
        </div>

        {success && (
          <Alert>
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {excelData && hasHeaders === null && (
          <div className="space-y-2">
            <p>Does this file contain headers?</p>
            <div className="space-x-2">
              <Button onClick={() => handleHeadersConfirmation(true)}>
                Yes
              </Button>
              <Button onClick={() => handleHeadersConfirmation(false)}>
                No
              </Button>
            </div>
          </div>
        )}

        {excelData && hasHeaders === false && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>Set Column Names</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Set Column Names</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-3 gap-4">
                {customHeaders.map((header, index) => (
                  <div key={index} className="space-y-2">
                    <Label>Column {index + 1}</Label>
                    <Input
                      value={header}
                      onChange={(e) =>
                        handleCustomHeaderChange(index, e.target.value)
                      }
                      placeholder={`Column ${index + 1} name`}
                    />
                  </div>
                ))}
              </div>
              <Button onClick={applyCustomHeaders}>Apply</Button>
            </DialogContent>
          </Dialog>
        )}

        {excelData && hasHeaders === true && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                      Export to PDF
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl w-full">
                    <DialogHeader>
                      <DialogTitle>PDF Preview</DialogTitle>
                    </DialogHeader>
                    <div className="h-[600px] w-full">
                      <iframe
                        className="w-full h-full border rounded"
                        src={(() => {
                          const doc = new jsPDF({
                            orientation: "landscape",
                            unit: "mm",
                          });

                          // Add header
                          doc.setFontSize(16);
                          doc.text(
                            "Created By Excel Viewer",
                            doc.internal.pageSize.getWidth() / 2,
                            20,
                            { align: "center" },
                          );

                          // Add the table
                          doc.autoTable({
                            head: [excelData.headers],
                            body: excelData.rows,
                            startY: 30,
                            styles: { fontSize: 8 },
                            didDrawPage: function (data) {
                              // Footer with page numbers
                              const str =
                                "Page " + doc.internal.getNumberOfPages();
                              doc.setFontSize(10);
                              doc.text(
                                str,
                                doc.internal.pageSize.getWidth() / 2,
                                doc.internal.pageSize.getHeight() - 10,
                                { align: "center" },
                              );
                            },
                          });

                          return URL.createObjectURL(doc.output("blob"));
                        })()}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          const doc = new jsPDF({
                            orientation: "landscape",
                            unit: "mm",
                          });

                          // Add header
                          doc.setFontSize(16);
                          doc.text(
                            "Created By Excel Viewer",
                            doc.internal.pageSize.getWidth() / 2,
                            20,
                            { align: "center" },
                          );

                          // Add the table
                          doc.autoTable({
                            head: [excelData.headers],
                            body: excelData.rows,
                            startY: 30,
                            styles: { fontSize: 8 },
                            didDrawPage: function (data) {
                              // Footer with page numbers
                              const str =
                                "Page " + doc.internal.getNumberOfPages();
                              doc.setFontSize(10);
                              doc.text(
                                str,
                                doc.internal.pageSize.getWidth() / 2,
                                doc.internal.pageSize.getHeight() - 10,
                                { align: "center" },
                              );
                            },
                          });

                          doc.save("excel-viewer-export.pdf");
                        }}
                      >
                        Download PDF
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <div className="rounded-lg border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table
                  className="w-full table-fixed"
                  style={{ minWidth: "max-content" }}
                >
                  <thead>
                    <tr className="border-b bg-muted/10">
                      {excelData.headers.map((header, index) => (
                        <th
                          key={index}
                          className="p-2 text-left text-muted-foreground font-medium sticky top-0 bg-card z-10 group"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{header}</span>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="h-4 w-4"
                                  >
                                    <path d="M3 6h18" />
                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                  </svg>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete Column
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the column "
                                    {header}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={(e) => {
                                      e.preventDefault();
                                      if (!excelData) return;

                                      // Remove the column from headers and all rows
                                      const updatedHeaders =
                                        excelData.headers.filter(
                                          (_, i) => i !== index,
                                        );
                                      const updatedRows = excelData.rows.map(
                                        (row) =>
                                          row.filter((_, i) => i !== index),
                                      );

                                      setExcelData((prev) => ({
                                        ...prev!,
                                        headers: updatedHeaders,
                                        rows: updatedRows,
                                      }));

                                      toast({
                                        title: "Column Deleted",
                                        description: `Column "${header}" has been deleted successfully`,
                                        duration: 2000,
                                        className:
                                          "bg-destructive/20 border-destructive/30 text-destructive-foreground",
                                      });

                                      // Close the dialog
                                      const closeButton =
                                        document.querySelector(
                                          '[role="alertdialog"] button[type="button"]',
                                        );
                                      if (closeButton instanceof HTMLElement) {
                                        closeButton.click();
                                      }
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentRows.map((row, rowIndex) => (
                      <tr
                        key={rowIndex}
                        className="border-b hover:bg-muted/5 transition-colors"
                      >
                        {row.map((cell: any, cellIndex: number) => (
                          <td key={cellIndex} className="p-2">
                            <Input
                              value={
                                cell === null || cell === undefined ? "" : cell
                              }
                              onChange={(e) =>
                                handleCellEdit(
                                  (currentPage - 1) * rowsPerPage + rowIndex,
                                  cellIndex,
                                  e.target.value,
                                )
                              }
                              placeholder="Enter value..."
                              className="border-none focus:ring-1"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end items-center">
              <div className="flex gap-4">
                <Button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      <HelpOverlay />
    </div>
  );
}
