import { z } from 'zod';

/**
 * Validates whether a given string is a valid IANA timezone identifier
 * by attempting to construct an Intl.DateTimeFormat with it.
 *
 * @param {string} tz - Timezone string to validate
 * @returns {boolean} True if valid IANA timezone
 */
export function isValidTimezone(tz) {
    if (typeof tz !== 'string' || !tz.trim()) return false;
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
        return true;
    } catch {
        return false;
    }
}

/**
 * Normalizes HH:mm or HH:mm:ss to standard HH:mm:ss format.
 */
export function normalizeTimeString(timeStr) {
    if (!timeStr) return "00:00:00";
    const parts = timeStr.trim().split(":");
    if (parts.length === 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
    }
    if (parts.length === 3) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
    }
    return timeStr;
}

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/;

export const dayScheduleSchema = z.object({
    dayOfWeek: z.number().int().min(1, "Day of week must be between 1 (Monday) and 7 (Sunday)").max(7, "Day of week must be between 1 and 7"),
    openTime: z.string().regex(timeRegex, "Invalid open time format (expected HH:mm or HH:mm:ss)").default("00:00"),
    closeTime: z.string().regex(timeRegex, "Invalid close time format (expected HH:mm or HH:mm:ss)").default("00:00"),
    isClosed: z.boolean().default(false),
    is24Hours: z.boolean().default(false),
}).refine((data) => !(data.isClosed && data.is24Hours), {
    message: "A schedule cannot be both closed and open 24 hours simultaneously",
    path: ["is24Hours"],
}).refine((data) => {
    if (data.isClosed || data.is24Hours) {
        return true;
    }
    // Ordinary hours: opening and closing time must differ
    const openNorm = normalizeTimeString(data.openTime);
    const closeNorm = normalizeTimeString(data.closeTime);
    return openNorm !== closeNorm;
}, {
    message: "Opening and closing times cannot be identical for open shifts. Use 24-hour toggle for all-day service.",
    path: ["closeTime"],
});

export const operatingHoursUpdateSchema = z.object({
    locationId: z.string().uuid("Invalid location ID format"),
    timezone: z.string().refine(isValidTimezone, {
        message: "Invalid IANA timezone identifier",
    }),
    schedule: z.array(dayScheduleSchema)
        .length(7, "Schedule must contain exactly 7 day entries (Monday through Sunday)")
        .refine((items) => {
            const days = items.map((i) => i.dayOfWeek);
            const uniqueDays = new Set(days);
            return uniqueDays.size === 7 && [1, 2, 3, 4, 5, 6, 7].every((d) => uniqueDays.has(d));
        }, {
            message: "Schedule must contain each day of the week (1 to 7) exactly once with no duplicates or missing days",
            path: ["schedule"],
        }),
});
