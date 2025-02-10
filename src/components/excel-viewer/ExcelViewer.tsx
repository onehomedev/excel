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
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [showCustomColumnDialog, setShowCustomColumnDialog] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

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
      const newRows = [...prev.rows];
      newRows[rowIndex] = [...newRows[rowIndex]];
      newRows[rowIndex][colIndex] = value;
      return { ...prev, rows: newRows };
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

        if (jsonData.length === 0) {
          setError("The uploaded file is empty");
          return;
        }

        setExcelData({
          headers: [],
          rows: jsonData as any[][],
        });
        setHasHeaders(null); // Prompt user for headers
      } catch (err) {
        setError(
          "Error reading file. Please make sure it's a valid Excel file.",
        );
      }
    };
    reader.readAsArrayBuffer(file);
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
      <div className="bg-card py-12 border-b">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-4xl font-bold tracking-tight">Excel Viewer</h1>
            <ThemeToggle />
          </div>
          {excelData?.tableName && (
            <div className="flex items-center gap-2 mb-2">
              <DatabaseIcon className="h-5 w-5 text-primary" />
              <p className="text-lg font-medium">
                Current Database:{" "}
                <span className="text-primary">{excelData.tableName}</span>
              </p>
            </div>
          )}
          <p className="text-lg text-muted-foreground mb-8">
            Upload Excel files or load from database to view and analyze your
            data.
          </p>
          <div className="flex gap-4">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary" className="gap-2">
                  <DatabaseIcon className="h-4 w-4" />
                  Load from Database
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Load from Database</DialogTitle>
                </DialogHeader>
                <DatabaseManager
                  onLoadTable={(headers, rows, tableName) => {
                    loadTableData(headers, rows, tableName);
                    toast({
                      title: "Success",
                      description: "Table loaded successfully",
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
                  }}
                />
              </DialogContent>
            </Dialog>
            {excelData?.tableName && (
              <Button
                onClick={saveChangesToDatabase}
                variant="secondary"
                className="gap-2"
              >
                <DatabaseIcon className="h-4 w-4" />
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>
      <div className="container mx-auto px-4 py-8 space-y-8">
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
            if (
              file &&
              (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))
            ) {
              const event = {
                target: { files: [file] },
              } as React.ChangeEvent<HTMLInputElement>;
              handleFileUpload(event);
            } else {
              setError("Please upload an Excel file (.xlsx or .xls)");
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
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

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
                <Button onClick={() => setShowCustomColumnDialog(true)}>
                  Add Custom Column
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="secondary">Export to PDF</Button>
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
              {excelData && (
                <DatabaseManager
                  data={{
                    headers: excelData.headers,
                    rows: excelData.rows,
                  }}
                />
              )}
            </div>

            <Dialog
              open={showCustomColumnDialog}
              onOpenChange={setShowCustomColumnDialog}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Custom Column</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Column Name</Label>
                    <Input
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      placeholder="Enter column name"
                    />
                  </div>

                  <Button onClick={addCustomColumn}>Add Column</Button>
                </div>
              </DialogContent>
            </Dialog>

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
                              value={cell || ""}
                              onChange={(e) =>
                                handleCellEdit(
                                  (currentPage - 1) * rowsPerPage + rowIndex,
                                  cellIndex,
                                  e.target.value,
                                )
                              }
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
