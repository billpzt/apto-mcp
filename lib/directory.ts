import type { SerializedDirectoryItem } from "./types";

function directorySortKey(item: SerializedDirectoryItem): [string, string] {
  return [item.status, item.name.toLowerCase()];
}

export function sortDirectoryItems(items: SerializedDirectoryItem[]): SerializedDirectoryItem[] {
  return [...items].sort((a, b) => {
    const [statusA, nameA] = directorySortKey(a);
    const [statusB, nameB] = directorySortKey(b);
    if (statusA !== statusB) return statusA.localeCompare(statusB);
    return nameA.localeCompare(nameB);
  });
}
