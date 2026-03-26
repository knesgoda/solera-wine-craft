import { formatTime } from "@/lib/timezone";

interface Props {
  date: string | Date | null | undefined;
  showZone?: boolean;
  className?: string;
}

export function FormattedTime({ date, showZone, className }: Props) {
  if (!date) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {formatTime(date, { includeZone: showZone })}
    </span>
  );
}
