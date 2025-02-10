import { Button } from "@/components/ui/button";
import { FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ThemeToggle } from "./theme-toggle";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-4 flex justify-end">
        <ThemeToggle />
      </div>
      <div className="container mx-auto px-4 py-24 flex flex-col items-center text-center space-y-8">
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl">
            Transform Your Excel Data
            <span className="text-primary"> Instantly</span>
          </h1>
          <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl">
            A powerful Excel viewer and editor with database capabilities.
            Import, edit, and manage your spreadsheets with ease.
          </p>
        </div>

        <Button
          size="lg"
          onClick={() => navigate("/viewer")}
          className="h-12 px-8 gap-2"
        >
          <FileSpreadsheet className="w-5 h-5" />
          Open Excel Viewer
        </Button>

        <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-8 text-card-foreground">
            <FileSpreadsheet className="h-12 w-12 text-primary mb-4" />
            <h3 className="text-xl font-semibold mb-2">Excel Import</h3>
            <p className="text-muted-foreground">
              Drag and drop your Excel files for instant viewing and editing
            </p>
          </div>
          <div className="rounded-lg border bg-card p-8 text-card-foreground">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-primary mb-4"
            >
              <path d="M20 14.66V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5.34" />
              <polygon points="18 2 22 6 12 16 8 16 8 12 18 2" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Easy Editing</h3>
            <p className="text-muted-foreground">
              Edit your data directly in the browser with a familiar interface
            </p>
          </div>
          <div className="rounded-lg border bg-card p-8 text-card-foreground sm:col-span-2 md:col-span-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-12 w-12 text-primary mb-4"
            >
              <path d="M12 3v13" />
              <path d="m5 10 7 7 7-7" />
              <path d="M19 21H5" />
            </svg>
            <h3 className="text-xl font-semibold mb-2">Export Options</h3>
            <p className="text-muted-foreground">
              Export your data to PDF or save it to a local database
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
