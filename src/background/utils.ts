
export function findDates(content : string) : Date[] {
    const regex = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?/g;
    const dateStrings = content.match(regex) || [];
    return dateStrings.map(dateStr => {
        const normalized = dateStr.replace(' ', 'T');
        const date = new Date(`${normalized}+09:00`);
        if (!Number.isFinite(date.getTime())) return null;
        const roundTrip = new Date(date.getTime() + 9 * 3600_000).toISOString();
        return roundTrip.startsWith(normalized) ? date : null;
    }).filter((date): date is Date => date !== null);
}

export function getLaterDate(dates : Date[]) : Date | null {
    if (dates.length == 0) return null;
    return new Date(Math.max(...dates.map(d=>d.getTime())));
}
