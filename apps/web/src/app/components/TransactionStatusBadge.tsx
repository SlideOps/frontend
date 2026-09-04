import type { TransactionStatus } from '@slideops/api-client';
import { cn } from '@slideops/design-system';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from '@slideops/icons';

/*
 * Payment-specific status language, everywhere a transaction's status shows:
 * "Pending Payment", "Payment Successful", never a generic "Pending" or
 * "Transaction status", and always the same words the Admin transaction
 * surface uses for the same status -- one status vocabulary, not two.
 */

const STATUS_LABEL: Record<TransactionStatus, string> = {
  pending: 'Pending Payment',
  success: 'Payment Successful',
  failed: 'Payment Failed',
  cancelled: 'Payment Cancelled',
  refunded: 'Payment Refunded',
  disputed: 'Payment Disputed',
};

const STATUS_ICON: Record<TransactionStatus, LucideIcon> = {
  pending: Clock,
  success: CheckCircle2,
  failed: XCircle,
  cancelled: Circle,
  refunded: RotateCcw,
  disputed: AlertTriangle,
};

const STATUS_TONE: Record<TransactionStatus, string> = {
  pending: 'text-warning',
  success: 'text-success',
  failed: 'text-danger',
  cancelled: 'text-ink-muted',
  refunded: 'text-info',
  disputed: 'text-danger',
};

export function transactionStatusLabel(status: TransactionStatus): string {
  return STATUS_LABEL[status] ?? status;
}

/** An icon-plus-label status badge, sized for a compact card row. Pending
 *  is deliberately the most visually distinct: it is the one status that
 *  represents an unfinished action the Operator can still do something about. */
export function TransactionStatusBadge({
  status,
  className,
}: {
  status: TransactionStatus;
  className?: string;
}) {
  const Icon = STATUS_ICON[status] ?? Circle;
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium', STATUS_TONE[status], className)}>
      <Icon width={15} height={15} aria-hidden />
      {transactionStatusLabel(status)}
    </span>
  );
}
