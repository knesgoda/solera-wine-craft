-- Extend backup_schedules frequency CHECK constraint to support daily and biweekly
ALTER TABLE public.backup_schedules
  DROP CONSTRAINT IF EXISTS backup_schedules_frequency_check;

ALTER TABLE public.backup_schedules
  ADD CONSTRAINT backup_schedules_frequency_check
  CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly'));
