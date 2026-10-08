export function formatDate(value) {
    return new Date(Number(value) || value).toLocaleString([], { hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit' });
}
