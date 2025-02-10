import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HelpCircle } from "lucide-react";

export default function HelpOverlay() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 h-10 w-10 rounded-full shadow-lg"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>How to Use Excel Viewer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-muted-foreground">
          <div className="space-y-2">
            <h3 className="font-medium text-foreground">1. Import Your Data</h3>
            <p>
              Drag and drop your Excel file into the upload zone, or click to
              browse files.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">
              2. Configure Headers
            </h3>
            <p>
              Choose whether your file contains headers or set custom column
              names.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">3. Edit Your Data</h3>
            <p>
              Click any cell to edit its content. Use the toolbar to add or
              remove columns.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium text-foreground">4. Save & Export</h3>
            <p>
              Save your changes to the database or export to PDF using the
              toolbar options.
            </p>
          </div>

          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium text-foreground">Pro Tip:</p>
            <p>
              Use the database manager to create new tables or append data to
              existing ones.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
