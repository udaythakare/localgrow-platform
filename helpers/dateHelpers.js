// app/coupons/utils/dateUtils.ts
export function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Returns a deterministic IST wall-clock timestamp string in YYYY-MM-DDTHH:mm:ss format.
 * Matches database TIMESTAMP WITHOUT TIME ZONE column formatting without using toISOString()
 * or locale string parsing that depends on commas.
 */
export function getCurrentISTTimestamp(date = new Date()) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });
    const parts = {};
    for (const p of fmt.formatToParts(date)) {
        parts[p.type] = p.value;
    }
    const hour = parts.hour === '24' ? '00' : parts.hour;
    return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}`;
}

/**
 * Returns an IST wall-clock timestamp string for a point in the future (e.g. 24 hours from now).
 * 
 * @param {number} hours - Number of hours to add
 * @param {Date} [fromDate=new Date()] - Reference date
 * @returns {string} Timestamp formatted as YYYY-MM-DDTHH:mm:ss
 */
export function getFutureISTTimestamp(hours = 24, fromDate = new Date()) {
    const futureDate = new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
    return getCurrentISTTimestamp(futureDate);
}
