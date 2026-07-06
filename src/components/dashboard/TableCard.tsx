import { Link } from "react-router-dom";
import { Table } from "@/types/pos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TableCardProps {
  table: Table;
  linkTo?: string;
  onEdit?: (table: Table) => void;
  onDelete?: (table: Table) => void;
  showActions?: boolean;
  /** Current user's employee ID — used to block other waiters' locked tables. */
  viewerEmployeeId?: string;
  /** When true, tables locked to another waiter cannot be opened. */
  enforceTableLock?: boolean;
}

function isLockedToOther(
  table: Table,
  viewerEmployeeId: string | undefined,
  enforceTableLock: boolean
): boolean {
  if (!enforceTableLock || !table.lockedByEmployeeId) return false;
  if (!viewerEmployeeId) return true;
  return table.lockedByEmployeeId.toUpperCase() !== viewerEmployeeId.toUpperCase();
}

export function TableCard({
  table,
  linkTo,
  onEdit,
  onDelete,
  showActions,
  viewerEmployeeId,
  enforceTableLock = false,
}: TableCardProps) {
  const blocked = isLockedToOther(table, viewerEmployeeId, enforceTableLock);
  const inUse = table.status === "occupied" || !!table.lockedByEmployeeId;
  const isAvailable = !inUse;

  const handleBlockedClick = () => {
    toast.error(
      table.lockedByName
        ? `This table is being handled by ${table.lockedByName}.`
        : "This table is in use by another waiter."
    );
  };

  const cardContent = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-lg">{table.name}</span>
        <span
          className={cn(
            "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
            isAvailable
              ? "bg-success/20 text-success"
              : "bg-destructive/20 text-destructive"
          )}
        >
          {isAvailable ? "Available" : "In use"}
        </span>
      </div>
      <div className="min-h-[1.25rem] mt-1 text-xs text-muted-foreground">
        {table.lockedByName ? (
          <>Server: {table.lockedByName}</>
        ) : !isAvailable && table.currentOrderId ? (
          <>Order: {table.currentOrderId}</>
        ) : (
          <span className="invisible" aria-hidden>—</span>
        )}
      </div>
      {showActions && (onEdit || onDelete) && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          {onEdit && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur-sm"
              title="Edit table"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onEdit(table);
              }}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}
          {onDelete && isAvailable && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-7 w-7 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Remove table"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(table);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      )}
    </>
  );

  const wrapperClass = cn(
    "group relative p-4 rounded-lg border-2 transition-all duration-200 min-h-[88px] flex flex-col justify-between",
    blocked
      ? "border-border bg-muted/30 opacity-70 cursor-not-allowed"
      : isAvailable
        ? "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
        : "border-destructive/30 bg-destructive/5 hover:border-destructive/50 cursor-pointer"
  );

  if (blocked) {
    return (
      <button type="button" className={cn(wrapperClass, "w-full text-left")} onClick={handleBlockedClick}>
        {cardContent}
      </button>
    );
  }

  if (linkTo) {
    return (
      <Link to={linkTo} className="block">
        <div className={wrapperClass}>{cardContent}</div>
      </Link>
    );
  }

  return <div className={wrapperClass}>{cardContent}</div>;
}
