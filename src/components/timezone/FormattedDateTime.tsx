import { formatDateTime } from "@/lib/timezone";

interface Props {
  date: string | Date | null | undefined;
  format?: "full" | "short" | "date" | "time" | "relative";
  className?: string;
}

export function FormattedDateTime({ date, format = "short", className }: Props) {
  if (!date) return <span className={className}>—</span>;
  return <span className={className}>{formatDateTime(date, { format })}</span>;
}
