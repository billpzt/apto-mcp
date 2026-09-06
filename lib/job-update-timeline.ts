import type { SerializedJobUpdate } from "./types";
import { formatCalendarDate } from "./date";

function compareJobUpdateDates(a: SerializedJobUpdate, b: SerializedJobUpdate): number {
  return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
}

export function getJobUpdateTimelinePreview(
  updates: SerializedJobUpdate[],
  limit = 3
): SerializedJobUpdate[] {
  return [...updates].sort(compareJobUpdateDates).slice(0, limit);
}

export function formatJobUpdateOccurredAt(occurredAt: string): string {
  return formatCalendarDate(occurredAt, { month: "short", day: "numeric" });
}
