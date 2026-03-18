import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, parseISO, isToday,
} from "date-fns";

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: string;
}

interface Props {
  tasks: Task[];
  onTaskClick: (id: string) => void;
}

export function TaskCalendarView({ tasks, onTaskClick }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.due_date) {
        const key = t.due_date;
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    });
    return map;
  }, [tasks]);

  const statusDot = (status: string) => {
    if (status === "complete") return "bg-primary";
    if (status === "in_progress") return "bg-secondary";
    return "bg-muted-foreground";
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="font-display text-lg font-semibold text-foreground">
            {format(currentMonth, "MMMM yyyy")}
          </h3>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayTasks = tasksByDate[key] || [];
            const inMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={key}
                className={`min-h-[80px] md:min-h-[100px] p-1 border border-border/50 ${
                  !inMonth ? "opacity-30" : ""
                } ${today ? "bg-accent/20" : ""}`}
              >
                <span className={`text-xs font-medium ${today ? "text-primary font-bold" : "text-foreground"}`}>
                  {format(day, "d")}
                </span>
                <div className="mt-1 space-y-0.5">
                  {dayTasks.slice(0, 3).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onTaskClick(t.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] md:text-xs truncate hover:bg-muted">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(t.status)}`} />
                        <span className="truncate text-foreground">{t.title}</span>
                      </div>
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
