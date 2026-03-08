// --- Helper Function for Monday ---
function getMonday(d) {
    const date = new Date(d);
    // getDay() returns 0 for Sunday, 1 for Monday...
    // We want Monday (1), so we subtract (getDay() + 6) % 7 days
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(date.setDate(diff));
}

function getLocalDateStringForMonday(dateStr) {
    const [year, month, day] = dateStr.split('-');
    const date = new Date(year, month - 1, day);
    const monday = getMonday(date);
    return getLocalDateString(monday);
}
