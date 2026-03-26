import { formatDate, formatShortDate } from "@/lib/timezone";

interface Props {
  date: string | Date | null | undefined;
  short?: boolean;
  className?: string;
}

export function FormattedDate({ date, short, className }: Props) {
  if (!date) return <span className={className}>—</span>;
  const text = short ? formatShortDate(date) : formatDate(date);
  return <span className={className}>{text}</span>;
}
