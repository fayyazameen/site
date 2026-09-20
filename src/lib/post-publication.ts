import moment from "moment";
import type { PostSource } from "@/types";

export function getPublicationDetails(
  date: string,
  time?: string,
  source?: string,
) {
  const day = moment.utc(date, "MM-DD-YYYY", true);
  if (typeof date !== "string" || !day.isValid()) {
    throw new Error('Blog dates must use "MM-DD-YYYY".');
  }

  if (time !== undefined && typeof time !== "string") {
    throw new Error('Quote blog times, for example time: "4:07pm".');
  }
  const timeText = time?.trim().toLowerCase();
  const clock = timeText
    ? moment.utc(timeText, ["h:mma", "h:mm a", "H:mm"], true)
    : null;
  if (clock && (!clock.isValid() || /^24:/.test(timeText!))) {
    throw new Error(
      'Blog times must use a format such as "4:07pm" or "16:07".',
    );
  }

  return {
    // Preserve the author's local wall-clock time; no timezone was supplied.
    dateTime:
      day.format("YYYY-MM-DD") + (clock ? clock.format("[T]HH:mm:ss") : ""),
    time: clock?.format("h:mma"),
    source: (source === "medium" ? "medium" : "original") as PostSource,
  };
}
