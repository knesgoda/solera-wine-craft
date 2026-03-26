import { formatDateTime } from "@/lib/timezone";

interface Props {
  date: string | Date | null | undefined;
  className?: string;
}

export function RelativeTime({ date, className }: Props) {
  if (!date) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {formatDateTime(date, { format: "relative" })}
    </span>
  );
}
