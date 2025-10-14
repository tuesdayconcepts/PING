// Time utility functions for hotspot status calculations

export function getHotspotStatus(startDate: string, endDate: string): string {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check if expired
  if (now > end) {
    return 'Expired';
  }

  // Check if not started yet
  if (now < start) {
    const timeDiff = start.getTime() - now.getTime();
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    if (days > 0) {
      return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    return `Starts in ${hours} hour${hours !== 1 ? 's' : ''}`;
  }

  // Currently running
  const timeDiff = now.getTime() - start.getTime();
  const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `Running ${days} day${days !== 1 ? 's' : ''}, ${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `Running ${hours} hour${hours !== 1 ? 's' : ''}, ${minutes} min`;
  }
  return `Running ${minutes} min`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

