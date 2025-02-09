import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import initSqlJs from "sql.js";
import { Button } from "@/components/ui/button";
import { DatabaseIcon } from "lucide-react";
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
import { useToast } from "@/components/ui/use-toast";

interface ExcelData {
  headers: string[];
  rows: any[][];
  tableName?: string;
}

interface CustomColumn {
  name: string;
  formula: string;
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
  const [newColumnFormula, setNewColumnFormula] = useState("");
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
      const allHeaders = [
        ...excelData.headers,
        ...customColumns.map((col) => col.name),
      ];
      const columns = allHeaders
        .map((header) => `${header.replace(/\W/g, "_")} TEXT`)
        .join(", ");

      db.run(`CREATE TABLE ${excelData.tableName} (${columns})`);

      // Insert all rows including custom columns
      const placeholders = allHeaders.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${excelData.tableName} VALUES (${placeholders})`,
      );

      const allRows = excelData.rows.map((row) => {
        const customValues = customColumns.map((col) =>
          col.formula ? evaluateFormula(col.formula, row) : "",
        );
        return [...row, ...customValues];
      });

      allRows.forEach((row) => {
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
  const evaluateFormula = (formula: string, row: any[]) => {
    try {
      // Replace column references (e.g., $1, $2) with actual values
      const evaluatedFormula = formula.replace(/\$\d+/g, (match) => {
        const columnIndex = parseInt(match.slice(1)) - 1;
        return row[columnIndex]?.toString() || "0";
      });
      // Use Function constructor to safely evaluate the formula
      return new Function(`return ${evaluatedFormula}`)();
    } catch (err) {
      return "Error";
    }
  };

  const addCustomColumn = () => {
    if (!newColumnName) {
      setError("Please provide a name for the custom column");
      return;
    }
    setCustomColumns([
      ...customColumns,
      { name: newColumnName, formula: newColumnFormula },
    ]);
    setNewColumnName("");
    setNewColumnFormula("");
    setShowCustomColumnDialog(false);
    setError(null);
  };

  const processedRows =
    excelData?.rows.map((row) => {
      const customValues = customColumns.map((col) =>
        col.formula ? evaluateFormula(col.formula, row) : "",
      );
      return [...row, ...customValues];
    }) || [];

  const currentRows = processedRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card py-12 border-b">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Excel Viewer
          </h1>
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
              <Button onClick={() => setShowCustomColumnDialog(true)}>
                Add Custom Column
              </Button>
              {excelData && (
                <DatabaseManager
                  data={{
                    headers: [
                      ...excelData.headers,
                      ...customColumns.map((col) => col.name),
                    ],
                    rows: processedRows,
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
                  <div className="space-y-2">
                    <Label>Formula</Label>
                    <Input
                      value={newColumnFormula}
                      onChange={(e) => setNewColumnFormula(e.target.value)}
                      placeholder="e.g., $1 + $2 (use $n for nth column)"
                    />
                  </div>
                  <Button onClick={addCustomColumn}>Add Column</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="rounded-lg border bg-card">
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        {[
                          ...excelData.headers,
                          ...customColumns.map((col) => col.name),
                        ].map((header, index) => (
                          <th
                            key={index}
                            className="p-2 text-left text-muted-foreground font-medium sticky top-0 bg-card z-10"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {currentRows?.map((row, rowIndex) => (
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
    </div>
  );
}
