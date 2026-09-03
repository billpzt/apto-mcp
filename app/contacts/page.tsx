import { db } from "@/lib/db";
import { serializeContact } from "@/lib/serialize";
import ContactsBoard from "@/components/ContactsBoard";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  let contacts;
  try {
    contacts = await db.contact.findMany({
      orderBy: { name: "asc" },
      include: {
        jobContacts: {
          include: {
            job: {
              select: { id: true, title: true, company: true, status: true },
            },
          },
        },
        actionItems: {
          select: { status: true },
        },
      },
    });
  } catch (e) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <p className="text-lg font-medium">Failed to load contacts</p>
        <p className="text-sm">{(e as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <ContactsBoard initialContacts={contacts.map(serializeContact)} />
    </div>
  );
}
