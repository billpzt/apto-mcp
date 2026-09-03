export type SerializedContact = {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  email: string | null;
  linkedin: string | null;
  notes: string | null;
  linkedJobs: Array<{
    id: string;
    title: string;
    company: string;
    status: string;
    role: string;
  }>;
  openActionItemsCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SerializedJob = {
  id: string;
  title: string;
  company: string;
  url: string | null;
  canonicalUrl: string | null;
  titleFamily: string | null;
  remoteScope: string | null;
  eligibleFromBrazil: string | null;
  eligibilityEvidence: string | null;
  postedAt: string | null;
  lastVerifiedAt: string | null;
  status: string;
  location: string | null;
  salary: string | null;
  jobType: string | null;
  notes: string | null;
  resumeSent: string | null;
  jdText: string | null;
  jdAnalysis: string | null;
  score: string | null;
  followUpDate: string | null;
  lastContactDate: string | null;
  appliedAt: string | null;
  nextAction: string | null;
  priority: string | null;
  sourceType: string | null;
  sourceContactId: string | null;
  sourceNotes: string | null;
  closedReason: string | null;
  sourceContact: SerializedContact | null;
  latestUpdate: SerializedJobUpdate | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedJobUpdate = {
  id: string;
  jobId: string;
  occurredAt: string;
  kind: string;
  summary: string;
  details: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedActionItem = {
  id: string;
  title: string;
  kind: string;
  status: string;
  dueDate: string | null;
  completedAt: string | null;
  jobId: string | null;
  contactId: string | null;
  notes: string | null;
  job?: Pick<SerializedJob, "id" | "company" | "title" | "status" | "score" | "priority"> | null;
  contact?: Pick<SerializedContact, "id" | "name" | "company"> | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedDirectoryItem = {
  id: string;
  name: string;
  url: string | null;
  category: string;
  status: string;
  checkFrequencyDays: number | null;
  lastCheckedAt: string | null;
  nextAction: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedAiProviderConfig = {
  id: string;
  provider: string;
  model: string | null;
  apiKeyName: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};
