export function formatDuration(ms) {
    if (!ms || isNaN(ms) || ms < 0)
        return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
export function truncate(str, maxLen = 100) {
    if (!str)
        return '';
    if (str.length <= maxLen)
        return str;
    return str.substring(0, maxLen - 3) + '...';
}
export function progressBar(current, total, length = 15) {
    if (!current || !total || isNaN(current) || isNaN(total)) {
        return '▬'.repeat(length);
    }
    const percentage = Math.min(Math.max(current / total, 0), 1);
    const progress = Math.round(length * percentage);
    const emptyProgress = length - progress;
    const progressText = '▬'.repeat(progress);
    const emptyProgressText = '▬'.repeat(emptyProgress);
    return `${progressText}🔘${emptyProgressText}`;
}
export function formatNumber(num) {
    if (!num)
        return '0';
    if (num >= 1000000)
        return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000)
        return (num / 1000).toFixed(1) + 'k';
    return num.toString();
}
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
export function timeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1)
        return interval + " years ago";
    interval = Math.floor(seconds / 2592000);
    if (interval > 1)
        return interval + " months ago";
    interval = Math.floor(seconds / 86400);
    if (interval > 1)
        return interval + " days ago";
    interval = Math.floor(seconds / 3600);
    if (interval > 1)
        return interval + " hours ago";
    interval = Math.floor(seconds / 60);
    if (interval > 1)
        return interval + " minutes ago";
    return Math.floor(seconds) + " seconds ago";
}
export function discordTimestamp(date, style = 'R') {
    const timestamp = Math.floor(new Date(date).getTime() / 1000);
    return `<t:${timestamp}:${style}>`;
}
export function sanitizeMarkdown(str, maxLen = 100) {
    if (!str)
        return '';
    let sanitized = str.replace(/([_*~`|\\<>:[\]()])/g, '\\$1');
    return truncate(sanitized, maxLen);
}
const Formatters = {
    formatDuration,
    truncate,
    progressBar,
    formatNumber,
    formatBytes,
    timeAgo,
    discordTimestamp,
    sanitizeMarkdown
};
export default Formatters;
