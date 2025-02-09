import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import initSqlJs from "sql.js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface DatabaseManagerProps {
  data?: {
    headers: string[];
    rows: any[][];
  };
  onLoadTable?: (headers: string[], rows: any[][], tableName?: string) => void;
  onSaveChanges?: (tableName: string, headers: string[], rows: any[][]) => void;
}

export default function DatabaseManager({
  data,
  onLoadTable,
}: DatabaseManagerProps) {
  const { toast } = useToast();
  const [db, setDb] = useState<any>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [newTableName, setNewTableName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initSqlJs({
      locateFile: (file) => `/${file}`,
    }).then((SQL) => {
      let database;
      const savedDb = localStorage.getItem("excelViewerDb");

      if (savedDb) {
        const dbData = new Uint8Array(JSON.parse(savedDb));
        database = new SQL.Database(dbData);
      } else {
        database = new SQL.Database();
      }

      setDb(database);
      loadTables(database);
    });

    return () => {
      if (db) {
        const data = db.export();
        const arr = Array.from(data);
        localStorage.setItem("excelViewerDb", JSON.stringify(arr));
      }
    };
  }, []);

  const loadTables = (database: any) => {
    try {
      const result = database.exec(
        "SELECT name FROM sqlite_master WHERE type='table'",
      );
      const tableNames = result[0]?.values.map((row: any[]) => row[0]) || [];
      setTables(tableNames);
    } catch (err) {
      setError("Error loading tables");
    }
  };

  const createTable = () => {
    if (!newTableName) {
      setError("Please enter a table name");
      return;
    }

    if (!data || !data.headers || !data.rows) {
      setError("No data available to create table");
      return;
    }

    try {
      const columns = data.headers
        .map((header) => `${header.replace(/\W/g, "_")} TEXT`)
        .join(", ");

      db.run(`CREATE TABLE ${newTableName} (${columns})`);

      const placeholders = data.headers.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${newTableName} VALUES (${placeholders})`,
      );

      data.rows.forEach((row) => {
        stmt.run(row);
      });

      stmt.free();
      loadTables(db);

      // Save to localStorage
      const dbData = db.export();
      const arr = Array.from(dbData);
      localStorage.setItem("excelViewerDb", JSON.stringify(arr));

      toast({
        title: "Table Created",
        description: "New table has been created successfully",
        duration: 2000,
        className: "bg-primary/20 border-primary/30 text-primary-foreground",
      });
      setError(null);
      setNewTableName("");
      setSelectedTable("");
    } catch (err) {
      console.error(err);
      setError("Error creating table");
    }
  };

  const loadSelectedTable = () => {
    if (!selectedTable || !onLoadTable) {
      setError("Please select a table");
      return;
    }

    try {
      // Get table structure
      const tableInfo = db.exec(`PRAGMA table_info(${selectedTable})`)[0]
        .values;
      const headers = tableInfo.map((col: any[]) => col[1]);

      // Get table data
      const result = db.exec(`SELECT * FROM ${selectedTable}`);
      const rows = result[0]?.values || [];

      onLoadTable(headers, rows, selectedTable);
      toast({
        title: "Table Loaded",
        description: "Table has been loaded successfully",
        duration: 2000,
        className: "bg-primary/20 border-primary/30 text-primary-foreground",
      });
      setError(null);
    } catch (err) {
      setError("Error loading table");
    }
  };

  const appendToTable = () => {
    if (!selectedTable) {
      setError("Please select a table");
      return;
    }

    try {
      // Get existing table structure
      const tableInfo = db.exec(`PRAGMA table_info(${selectedTable})`)[0]
        .values;
      const tableColumns = tableInfo.map((col: any[]) => col[1]);

      // Check if columns match
      if (!data?.headers || tableColumns.length !== data.headers.length) {
        setError("Column count does not match the selected table");
        return;
      }

      const placeholders = data.headers.map(() => "?").join(", ");
      const stmt = db.prepare(
        `INSERT INTO ${selectedTable} VALUES (${placeholders})`,
      );

      data.rows.forEach((row) => {
        stmt.run(row);
      });

      stmt.free();

      // Save to localStorage
      const dbData = db.export();
      const arr = Array.from(dbData);
      localStorage.setItem("excelViewerDb", JSON.stringify(arr));

      toast({
        title: "Data Appended",
        description: "Data has been appended successfully",
        duration: 2000,
        className: "bg-primary/20 border-primary/30 text-primary-foreground",
      });
      setError(null);
      setSelectedTable("");
    } catch (err) {
      setError("Error appending data");
    }
  };

  return (
    <div className="space-y-4 p-4 bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 shadow-md">
      <div className="space-y-4">
        {data && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-primary-foreground">
              Create New Table
            </h3>
            <div className="flex gap-2">
              <Input
                value={newTableName}
                onChange={(e) => setNewTableName(e.target.value)}
                placeholder="Enter table name"
                className="max-w-sm bg-background/50"
              />
              <Button onClick={createTable} variant="secondary">
                Create
              </Button>
            </div>
          </div>
        )}

        {tables.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-primary-foreground">
              {data ? "Append to Existing Table" : "Load Existing Table"}
            </h3>
            <div className="flex gap-2">
              <Select value={selectedTable} onValueChange={setSelectedTable}>
                <SelectTrigger className="w-[180px] bg-background/50">
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  onClick={data ? appendToTable : loadSelectedTable}
                  variant="secondary"
                >
                  {data ? "Append" : "Load"}
                </Button>
                {!data && (
                  <Button
                    onClick={() => {
                      if (!selectedTable) {
                        setError("Please select a table");
                        return;
                      }
                      try {
                        db.run(`DROP TABLE IF EXISTS ${selectedTable}`);
                        const dbData = db.export();
                        const arr = Array.from(dbData);
                        localStorage.setItem(
                          "excelViewerDb",
                          JSON.stringify(arr),
                        );
                        loadTables(db);
                        setSelectedTable("");
                        toast({
                          title: "Table Deleted",
                          description: "Table has been deleted successfully",
                          duration: 2000,
                          className:
                            "bg-destructive/20 border-destructive/30 text-destructive-foreground",
                        });
                      } catch (err) {
                        setError("Error deleting table");
                      }
                    }}
                    variant="destructive"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
