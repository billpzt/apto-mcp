import type { Job, Contact, JobUpdate, DirectoryItem } from "@prisma/client";
import { serializeDate } from "./date";
import type { SerializedContact, SerializedDirectoryItem, SerializedJob, SerializedJobUpdate } from "./types";

type JobWithContact = Job & {
  sourceContact: Contact | null;
  updates?: JobUpdate[];
};

export function serializeJobUpdate(update: JobUpdate): SerializedJobUpdate {
  return {
    id: update.id,
    jobId: update.jobId,
    occurredAt: update.occurredAt.toISOString(),
    kind: update.kind,
    summary: update.summary,
    details: update.details,
    createdAt: update.createdAt.toISOString(),
    updatedAt: update.updatedAt.toISOString(),
  };
}

export function serializeJob(j: JobWithContact): SerializedJob {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    url: j.url,
    canonicalUrl: j.canonicalUrl,
    titleFamily: j.titleFamily,
    remoteScope: j.remoteScope,
    eligibleFromBrazil: j.eligibleFromBrazil,
    eligibilityEvidence: j.eligibilityEvidence,
    postedAt: serializeDate(j.postedAt),
    lastVerifiedAt: serializeDate(j.lastVerifiedAt),
    status: j.status,
    location: j.location,
    salary: j.salary,
    jobType: j.jobType,
    notes: j.notes,
    resumeSent: j.resumeSent,
    jdText: j.jdText,
    jdAnalysis: j.jdAnalysis,
    score: j.score,
    followUpDate: serializeDate(j.followUpDate),
    lastContactDate: serializeDate(j.lastContactDate),
    appliedAt: serializeDate(j.appliedAt),
    nextAction: j.nextAction,
    priority: j.priority,
    sourceType: j.sourceType,
    sourceContactId: j.sourceContactId,
    sourceNotes: j.sourceNotes,
    closedReason: j.closedReason,
    sourceContact: j.sourceContact
      ? {
          id: j.sourceContact.id,
          name: j.sourceContact.name,
          title: j.sourceContact.title,
          company: j.sourceContact.company,
          email: j.sourceContact.email,
          linkedin: j.sourceContact.linkedin,
          notes: j.sourceContact.notes,
          linkedJobs: [],
          openActionItemsCount: 0,
          createdAt: j.sourceContact.createdAt.toISOString(),
          updatedAt: j.sourceContact.updatedAt.toISOString(),
        }
      : null,
    latestUpdate: j.updates?.[0] ? serializeJobUpdate(j.updates[0]) : null,
    createdAt: j.createdAt.toISOString(),
    updatedAt: j.updatedAt.toISOString(),
  };
}

// Include shape for Prisma Contact queries used by the contacts page
export type PrismaContactInclude = {
  jobContacts: Array<{
    role: string;
    job: {
      id: string;
      title: string;
      company: string;
      status: string;
    };
  }>;
  actionItems: Array<{
    status: string;
  }>;
};

export function serializeContact(
  c: PrismaContactInclude & {
    id: string;
    name: string;
    title: string | null;
    company: string | null;
    email: string | null;
    linkedin: string | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): SerializedContact {
  return {
    id: c.id,
    name: c.name,
    title: c.title || null,
    company: c.company || null,
    email: c.email || null,
    linkedin: c.linkedin || null,
    notes: c.notes || null,
    linkedJobs: c.jobContacts.map((jc) => ({
      id: jc.job.id,
      title: jc.job.title,
      company: jc.job.company,
      status: jc.job.status,
      role: jc.role,
    })),
    openActionItemsCount: c.actionItems.filter((a) => a.status === "open").length,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeDirectoryItem(item: DirectoryItem): SerializedDirectoryItem {
  return {
    id: item.id,
    name: item.name,
    url: item.url,
    category: item.category,
    status: item.status,
    checkFrequencyDays: item.checkFrequencyDays,
    lastCheckedAt: serializeDate(item.lastCheckedAt),
    nextAction: item.nextAction,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
