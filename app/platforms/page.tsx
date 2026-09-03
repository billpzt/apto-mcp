import { db } from "@/lib/db";
import { DirectoryBoard } from "@/components/DirectoryBoard";
import { serializeDirectoryItem } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export default async function DirectoryPage() {
  const items = await db.directoryItem.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return <DirectoryBoard initialItems={items.map(serializeDirectoryItem)} />;
}
