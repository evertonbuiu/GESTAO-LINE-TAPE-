import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BulkActionsBarProps {
  selectedCount: number;
  onDelete: () => void;
  onCancel: () => void;
  isDeleting?: boolean;
  className?: string;
}

export function BulkActionsBar({
  selectedCount,
  onDelete,
  onCancel,
  isDeleting = false,
  className
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
      "bg-background border shadow-lg rounded-lg px-4 py-3",
      "flex items-center gap-4 animate-in slide-in-from-bottom-4",
      className
    )}>
      <span className="text-sm font-medium">
        {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
      </span>
      
      <div className="flex items-center gap-2">
        <Button
          variant="destructive"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          {isDeleting ? 'Excluindo...' : 'Excluir Selecionados'}
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isDeleting}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
