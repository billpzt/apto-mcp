import assert from "node:assert/strict";
import { ACTION_STATUSES, JOB_STATUSES, KANBAN_STATUSES, STATUS_CONFIG } from "../lib/constants";
import { parseOptionalDate } from "../lib/date";
import { buildActionCreatePayload, buildDashboard } from "../lib/dashboard";
import { createImportedJobDraftFromParams } from "../lib/job-import";
import {
  buildJobUpdatesMarkdown,
  getJobUpdatesMarkdownPath,
} from "../lib/job-updates";
import { getJobUpdateTimelinePreview } from "../lib/job-update-timeline";
import { sortDirectoryItems } from "../lib/directory";
import { serializeDirectoryItem } from "../lib/serialize";
import {
  buildCoverLetterPrompts,
  countWords,
  normalizeCoverLetterInput,
  validateCoverLetterInput,
  type CoverLetterJobContext,
} from "../lib/cover-letter";
import { buildDailyApplicationQueue, dayKeyInTimeZone } from "../lib/daily-search";
import { candidateFingerprint, normalizeCandidate, normalizeJobUrl } from "../lib/job-candidate";
import { parseJdAnalysis } from "../lib/jd-analysis";
import {
  assertKnownAssistantAction,
  ASSISTANT_ACTION_TYPES,
  normalizeRecordApplication,
} from "../lib/assistant-contracts";
import { checkMcpParity } from "./mcp-parity";
import type {
  SerializedActionItem,
  SerializedDirectoryItem,
  SerializedJob,
  SerializedJobUpdate,
} from "../lib/types";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const baseJob: SerializedJob = {
  id: "job_1",
  title: "Automation Engineer",
  company: "Example Co",
  url: null,
  canonicalUrl: null,
  titleFamily: null,
  remoteScope: null,
  eligibleFromBrazil: null,
  eligibilityEvidence: null,
  postedAt: null,
  lastVerifiedAt: null,
  status: "APPLIED",
  location: null,
  salary: null,
  jobType: null,
  notes: null,
  resumeSent: null,
  jdText: null,
  jdAnalysis: null,
  score: null,
  followUpDate: null,
  lastContactDate: "2026-06-01T12:00:00.000Z",
  appliedAt: "2026-06-01T12:00:00.000Z",
  nextAction: null,
  priority: null,
  sourceType: null,
  sourceContactId: null,
  sourceNotes: null,
  closedReason: null,
  sourceContact: null,
  latestUpdate: null,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

const baseAction: SerializedActionItem = {
  id: "action_1",
  title: "Follow up",
  kind: "follow_up",
  status: "open",
  dueDate: "2026-06-18T12:00:00.000Z",
  completedAt: null,
  jobId: "job_1",
  contactId: null,
  notes: null,
  createdAt: "2026-06-17T12:00:00.000Z",
  updatedAt: "2026-06-17T12:00:00.000Z",
};

const baseDirectoryItem: SerializedDirectoryItem = {
  id: "dir_1",
  name: "Wellfound",
  url: null,
  category: "platform",
  status: "active",
  checkFrequencyDays: 14,
  lastCheckedAt: "2026-06-01T12:00:00.000Z",
  nextAction: "Check matches",
  notes: null,
  createdAt: "2026-06-01T12:00:00.000Z",
  updatedAt: "2026-06-01T12:00:00.000Z",
};

const coverLetterJob: CoverLetterJobContext = {
  id: "job_cover_letter",
  title: "Automation Engineer",
  company: "Acme",
  location: "Remote",
  salary: "$4,000/month",
  jobType: "Full-time",
  notes: "Focus on RPA and Python work.",
  jdText: "We need Python automation, Playwright, and strong stakeholder communication.",
  jdAnalysis: JSON.stringify({
    grade: "A",
    fitNote: "Strong fit.",
    salary: "$4,000/month",
    location: "remote",
    matched: ["Python", "Playwright"],
    gaps: ["Kubernetes"],
    keyReqs: ["Python", "Playwright", "Communication"],
    redFlags: [],
    practiceRecs: ["Review Kubernetes basics"],
    atsCheck: { present: ["Python"], missing: ["Communication"], score: 50, total: 2 },
  }),
};

test("job status constants include every configured status", () => {
  assert.deepEqual([...JOB_STATUSES].sort(), Object.keys(STATUS_CONFIG).sort());
  assert.ok(JOB_STATUSES.includes("WITHDRAWN"));
});

test("action statuses use the skipped value accepted by the UI", () => {
  assert.ok(ACTION_STATUSES.includes("skipped"));
});

test("kanban statuses keep directory-only profiles out but include terminal choices", () => {
  assert.equal(KANBAN_STATUSES.includes("PROFILE_LIVE"), false);
  assert.ok(KANBAN_STATUSES.includes("WITHDRAWN"));
});

test("parseOptionalDate rejects invalid date strings", () => {
  assert.throws(() => parseOptionalDate("not-a-date"), /Invalid date/);
});

test("cover letter input normalization trims fields and applies defaults", () => {
  assert.deepEqual(
    normalizeCoverLetterInput({
      jobId: " job_1 ",
      emphasis: " Python automation ",
      avoid: " generic claims ",
      writingSample: " I write directly. ",
    }),
    {
      jobId: "job_1",
      tone: "professional",
      length: "standard",
      language: "english",
      emphasis: "Python automation",
      avoid: "generic claims",
      writingSample: "I write directly.",
    }
  );
});

test("cover letter input normalization rejects unsupported enum values", () => {
  assert.deepEqual(
    normalizeCoverLetterInput({
      jobId: "job_2",
      tone: "polite" as never,
      length: "long" as never,
      language: "spanish" as never,
    }),
    {
      jobId: "job_2",
      tone: "professional",
      length: "standard",
      language: "english",
      emphasis: "",
      avoid: "",
      writingSample: "",
    }
  );
});

test("cover letter input validation rejects unsupported enum values", () => {
  assert.throws(
    () =>
      validateCoverLetterInput({
        jobId: "job_1",
        tone: "casual",
        length: "standard",
        language: "english",
        emphasis: "",
        avoid: "",
        writingSample: "",
      } as never),
    /Invalid tone/
  );
});

test("cover letter prompt builder includes selected controls and job context", () => {
  const prompts = buildCoverLetterPrompts({
    input: {
      jobId: "job_cover_letter",
      tone: "enthusiastic",
      length: "brief",
      language: "portuguese",
      emphasis: "Meu background em RPA",
      avoid: "Linguagem vaga",
      writingSample: "Eu escrevo de forma objetiva e calorosa.",
    },
    job: coverLetterJob,
    resumeContent: "Bill built Python and Playwright automations for operations teams.",
  });

  assert.match(prompts.systemPrompt, /enthusiastic/i);
  assert.match(prompts.systemPrompt, /portuguese/i);
  assert.match(prompts.userPrompt, /Automation Engineer/);
  assert.match(prompts.userPrompt, /Acme/);
  assert.match(prompts.userPrompt, /Meu background em RPA/);
  assert.match(prompts.userPrompt, /Linguagem vaga/);
  assert.match(prompts.userPrompt, /Python automation/);
});

test("cover letter prompt builder falls back cleanly when jd text is missing", () => {
  const prompts = buildCoverLetterPrompts({
    input: {
      jobId: "job_cover_letter",
      tone: "professional",
      length: "standard",
      language: "auto",
      emphasis: "",
      avoid: "",
      writingSample: "",
    },
    job: {
      ...coverLetterJob,
      jdText: null,
    },
    resumeContent: "Bill built Python and Playwright automations.",
  });

  assert.match(prompts.userPrompt, /JD text is not available/i);
  assert.doesNotMatch(prompts.userPrompt, /Writing sample:/i);
});

test("cover letter word count ignores repeated whitespace", () => {
  assert.equal(countWords("Hello   world\n\nfrom Apto"), 4);
  assert.equal(countWords(""), 0);
});

test("cover letter word count handles generated preview text with punctuation", () => {
  assert.equal(countWords("Hello, Bill.\nThis is a generated draft."), 7);
});

test("dashboard counts all stale jobs even when display list is capped", () => {
  const jobs = Array.from({ length: 10 }, (_, index) => ({
    ...baseJob,
    id: `job_${index}`,
    company: `Company ${index}`,
  }));
  const dashboard = buildDashboard(
    { jobs, actions: [baseAction], directoryItems: [baseDirectoryItem] },
    new Date("2026-06-18T12:00:00.000Z")
  );

  assert.equal(dashboard.staleOpportunities.length, 8);
  assert.equal(dashboard.summary.staleJobs, 10);
  assert.equal(dashboard.todayActions.length, 7);
  assert.ok(dashboard.todayActions.some((action) => action.source === "action_item"));
  assert.ok(dashboard.todayActions.some((action) => action.source === "stale_job"));
  assert.equal(dashboard.directoryDue.length, 1);
});

test("dashboard derives command actions from job follow-ups and assessments", () => {
  const followUpJob: SerializedJob = {
    ...baseJob,
    id: "job_follow_up",
    company: "Northwind Systems",
    status: "STANDBY",
    priority: "high",
    sourceType: "recruiter_inbound",
    followUpDate: "2026-06-18T12:00:00.000Z",
    nextAction: "Send Riya a concise check-in.",
  };
  const assessmentJob: SerializedJob = {
    ...baseJob,
    id: "job_assessment",
    company: "Meridian Software",
    status: "ASSESSMENT",
    followUpDate: null,
    nextAction: null,
  };

  const dashboard = buildDashboard(
    { jobs: [followUpJob, assessmentJob], actions: [], directoryItems: [] },
    new Date("2026-06-18T12:00:00.000Z")
  );

  assert.equal(dashboard.todayActions.length, 2);
  assert.equal(dashboard.todayActions[0].source, "job_follow_up");
  assert.equal(dashboard.todayActions[0].canTrack, true);
  assert.equal(dashboard.todayActions[0].title, "Send Riya a concise check-in.");
  assert.equal(dashboard.todayActions[1].source, "job_prep");
  assert.match(dashboard.todayActions[1].title, /Meridian Software/);
});

test("derived dashboard actions can become tracked action items", () => {
  const dashboard = buildDashboard(
    {
      jobs: [{
        ...baseJob,
        id: "job_follow_up",
        company: "Northwind Systems",
        status: "STANDBY",
        followUpDate: "2026-06-18T12:00:00.000Z",
        nextAction: "Send Riya a concise check-in.",
      }],
      actions: [],
      directoryItems: [],
    },
    new Date("2026-06-18T12:00:00.000Z")
  );

  assert.deepEqual(buildActionCreatePayload(dashboard.todayActions[0]), {
    title: "Send Riya a concise check-in.",
    kind: "follow_up",
    status: "open",
    dueDate: "2026-06-18T12:00:00.000Z",
    jobId: "job_follow_up",
    contactId: null,
    notes: "Derived from dashboard: Job follow-up date is due",
  });
});

test("LinkedIn import params produce a stable backlog draft", () => {
  const params = new URLSearchParams({
    import: "1",
    title: "Senior RPA Engineer",
    company: "Acme",
    url: "https://www.linkedin.com/jobs/view/123",
  });

  assert.deepEqual(createImportedJobDraftFromParams(params), {
    title: "Senior RPA Engineer",
    company: "Acme",
    url: "https://www.linkedin.com/jobs/view/123",
    status: "BACKLOG",
    sourceType: "linkedin",
  });
});

test("LinkedIn import ignores empty imports", () => {
  assert.equal(createImportedJobDraftFromParams(new URLSearchParams("import=1")), null);
});

test("job updates markdown path uses a stable slug", () => {
  assert.equal(
    getJobUpdatesMarkdownPath("Northwind Systems", "Field Delivery Engineer"),
    "data/job-updates/northwind-systems-field-delivery-engineer.md"
  );
});

test("job updates markdown renders dated timeline entries", () => {
  const markdown = buildJobUpdatesMarkdown(
    {
      id: "job_1",
      company: "Northwind Systems",
      title: "Field Delivery Engineer",
      status: "CLOSED",
      lastContactDate: "2026-06-18T12:00:00.000Z",
      followUpDate: null,
      nextAction: null,
      closedReason: "Role closed by recruiter",
    },
    [
      {
        id: "update_2",
        jobId: "job_1",
        occurredAt: "2026-06-10T12:00:00.000Z",
        kind: "contact",
        summary: "Riya said the client was still deciding.",
        details: null,
        createdAt: "2026-06-10T12:00:00.000Z",
        updatedAt: "2026-06-10T12:00:00.000Z",
      },
      {
        id: "update_1",
        jobId: "job_1",
        occurredAt: "2026-06-18T12:00:00.000Z",
        kind: "status_change",
        summary: "Riya confirmed the position is closed.",
        details: "Closed after recruiter follow-up.",
        createdAt: "2026-06-18T12:00:00.000Z",
        updatedAt: "2026-06-18T12:00:00.000Z",
      },
    ]
  );

  assert.match(markdown, /# Northwind Systems - Field Delivery Engineer/);
  assert.match(markdown, /Status: CLOSED/);
  assert.match(markdown, /Closed reason: Role closed by recruiter/);
  assert.match(markdown, /## Updates/);
  assert.match(markdown, /2026-06-18 \| status_change \| Riya confirmed the position is closed\./);
  assert.match(markdown, /2026-06-10 \| contact \| Riya said the client was still deciding\./);
});

test("job update timeline preview keeps newest entries first and caps the list", () => {
  const updates: SerializedJobUpdate[] = [
    {
      id: "update_old",
      jobId: "job_1",
      occurredAt: "2026-06-10T12:00:00.000Z",
      kind: "contact",
      summary: "Older update",
      details: null,
      createdAt: "2026-06-10T12:00:00.000Z",
      updatedAt: "2026-06-10T12:00:00.000Z",
    },
    {
      id: "update_new",
      jobId: "job_1",
      occurredAt: "2026-06-18T12:00:00.000Z",
      kind: "status_change",
      summary: "Newer update",
      details: null,
      createdAt: "2026-06-18T12:00:00.000Z",
      updatedAt: "2026-06-18T12:00:00.000Z",
    },
    {
      id: "update_mid",
      jobId: "job_1",
      occurredAt: "2026-06-14T12:00:00.000Z",
      kind: "note",
      summary: "Middle update",
      details: null,
      createdAt: "2026-06-14T12:00:00.000Z",
      updatedAt: "2026-06-14T12:00:00.000Z",
    },
  ];

  assert.deepEqual(getJobUpdateTimelinePreview(updates, 2).map((update) => update.id), [
    "update_new",
    "update_mid",
  ]);
});

test("directory items serialize date fields for the client", () => {
  const item = serializeDirectoryItem({
    id: "dir_1",
    name: "Wellfound",
    url: "https://wellfound.com",
    category: "platform",
    status: "active",
    checkFrequencyDays: 14,
    lastCheckedAt: new Date("2026-06-18T12:00:00.000Z"),
    nextAction: "Check matches",
    notes: "Passive profile",
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    updatedAt: new Date("2026-06-18T12:00:00.000Z"),
  });

  assert.deepEqual(item, {
    id: "dir_1",
    name: "Wellfound",
    url: "https://wellfound.com",
    category: "platform",
    status: "active",
    checkFrequencyDays: 14,
    lastCheckedAt: "2026-06-18T12:00:00.000Z",
    nextAction: "Check matches",
    notes: "Passive profile",
    createdAt: "2026-06-01T12:00:00.000Z",
    updatedAt: "2026-06-18T12:00:00.000Z",
  });
});

test("directory items stay sorted by status then name", () => {
  const items = sortDirectoryItems([
    {
      ...baseDirectoryItem,
      id: "dir_c",
      name: "Zeta",
      status: "paused",
    },
    {
      ...baseDirectoryItem,
      id: "dir_a",
      name: "Alpha",
      status: "active",
    },
    {
      ...baseDirectoryItem,
      id: "dir_b",
      name: "Beta",
      status: "active",
    },
  ]);

  assert.deepEqual(items.map((item) => item.id), ["dir_a", "dir_b", "dir_c"]);
});

test("daily application floor counts only explicit submissions", () => {
  const jobs: SerializedJob[] = [
    { ...baseJob, id: "a", appliedAt: "2026-07-13T13:00:00.000Z" },
    { ...baseJob, id: "b", status: "BACKLOG", appliedAt: null },
    { ...baseJob, id: "c", status: "BACKLOG", appliedAt: null },
  ];
  const result = buildDailyApplicationQueue(
    jobs,
    new Date("2026-07-13T15:00:00.000Z")
  );
  assert.equal(result.submittedToday, 1);
  assert.equal(result.remainingToFloor, 2);
  assert.equal(result.minimumComplete, false);
});

test("daily queue is uncapped after Today's Three", () => {
  const ready = Array.from({ length: 5 }, (_, index): SerializedJob => ({
    ...baseJob,
    id: `ready_${index}`,
    status: "BACKLOG",
    url: `https://example.com/jobs/${index}`,
    canonicalUrl: `https://example.com/jobs/${index}`,
    eligibleFromBrazil: "eligible",
    score: index === 0 ? "A" : "B",
    appliedAt: null,
  }));
  const result = buildDailyApplicationQueue(ready, new Date("2026-07-13T15:00:00.000Z"));
  assert.equal(result.todayThree.length, 3);
  assert.equal(result.moreStrongMatches.length, 2);
});

test("ineligible jobs never enter the application queue", () => {
  const result = buildDailyApplicationQueue([{
    ...baseJob,
    status: "BACKLOG",
    url: "https://example.com/ineligible",
    canonicalUrl: "https://example.com/ineligible",
    eligibleFromBrazil: "ineligible",
    score: "A",
    appliedAt: null,
  }]);
  assert.equal(result.todayThree.length, 0);
  assert.equal(result.needsDecision.length, 0);
});

test("uncertain or unscored jobs require a quick decision", () => {
  const result = buildDailyApplicationQueue([{
    ...baseJob,
    status: "BACKLOG",
    url: "https://example.com/uncertain",
    canonicalUrl: "https://example.com/uncertain",
    eligibleFromBrazil: "uncertain",
    score: null,
    appliedAt: null,
  }]);
  assert.equal(result.todayThree.length, 0);
  assert.equal(result.needsDecision.length, 1);
});

test("Sao Paulo day keys respect timezone boundaries", () => {
  assert.equal(
    dayKeyInTimeZone(new Date("2026-07-14T01:00:00.000Z"), "America/Sao_Paulo"),
    "2026-07-13"
  );
});

test("job URL normalization removes tracking and fragments", () => {
  assert.equal(
    normalizeJobUrl("https://Example.com/jobs/42/?utm_source=x&ref=mail#apply"),
    "https://example.com/jobs/42"
  );
});

test("assistant candidate normalization validates enums and dates", () => {
  const candidate = normalizeCandidate({
    title: " Senior Python Engineer ",
    company: " Acme ",
    url: "https://acme.example/jobs/1?utm_campaign=test",
    sourceType: "job_board",
    eligibleFromBrazil: "eligible",
    score: "A",
    priority: "high",
    postedAt: "2026-07-12T10:00:00.000Z",
  });
  assert.equal(candidate.title, "Senior Python Engineer");
  assert.equal(candidate.canonicalUrl, "https://acme.example/jobs/1");
  assert.equal(candidate.postedAt?.toISOString(), "2026-07-12T10:00:00.000Z");
});

test("candidate fingerprint is case and whitespace insensitive", () => {
  assert.equal(
    candidateFingerprint("Acme Inc", "Python Engineer"),
    candidateFingerprint(" acme   inc ", "PYTHON ENGINEER")
  );
});

test("candidate normalization rejects missing identity", () => {
  assert.throws(() => normalizeCandidate({ title: "", company: "" }), /title is required/);
});

test("application recording requires an explicit submission timestamp", () => {
  assert.throws(
    () => normalizeRecordApplication({ jobId: "job_1", submittedAt: null }),
    /submittedAt must be a valid ISO date/
  );
});

test("application recording normalizes explicit submission data", () => {
  const input = normalizeRecordApplication({
    jobId: " job_1 ",
    submittedAt: "2026-07-13T15:00:00.000Z",
    followUpDate: "2026-07-20T15:00:00.000Z",
    resumeSent: " Python FDE CV ",
  });
  assert.equal(input.jobId, "job_1");
  assert.equal(input.submittedAt.toISOString(), "2026-07-13T15:00:00.000Z");
  assert.equal(input.resumeSent, "Python FDE CV");
});

test("assistant action registry contains exactly the eleven dispatchable actions", () => {
  assert.deepEqual([...ASSISTANT_ACTION_TYPES].sort(), [
    "add_action_item",
    "add_job",
    "add_job_update",
    "add_note",
    "complete_action_item",
    "import_job_candidates",
    "log_practice",
    "record_application",
    "record_job_analysis",
    "record_learning",
    "update_job",
  ]);
});

test("assertKnownAssistantAction accepts every registered action", () => {
  for (const action of ASSISTANT_ACTION_TYPES) {
    assert.doesNotThrow(() => assertKnownAssistantAction(action));
  }
});

test("assertKnownAssistantAction rejects unknown actions with the embedded-chat message", () => {
  assert.throws(
    () => assertKnownAssistantAction("bogus_action"),
    /Unknown action type: bogus_action/
  );
});

const validJdAnalysisFixture = JSON.stringify({
  grade: "b",
  fitNote: "Strong Python and Playwright fit.",
  salary: "$5,000/month",
  location: "Remote (Brazil)",
  matched: ["Python", "Playwright", "TypeScript"],
  gaps: ["Kubernetes"],
  keyReqs: ["Python", "Playwright", "Communication"],
  redFlags: [],
  practiceRecs: ["Review Kubernetes basics"],
});

test("parseJdAnalysis returns null for empty or malformed input", () => {
  assert.equal(parseJdAnalysis(null), null);
  assert.equal(parseJdAnalysis(undefined), null);
  assert.equal(parseJdAnalysis(""), null);
  assert.equal(parseJdAnalysis("not valid json"), null);
});

test("parseJdAnalysis uppercases the grade and preserves valid analyses", () => {
  const result = parseJdAnalysis(validJdAnalysisFixture);
  assert.ok(result);
  assert.equal(result.grade, "B");
  assert.equal(result.fitNote, "Strong Python and Playwright fit.");
  assert.deepEqual(result.matched, ["Python", "Playwright", "TypeScript"]);
  assert.deepEqual(result.gaps, ["Kubernetes"]);
});

test("parseJdAnalysis returns null when required fields are missing or wrong type", () => {
  const withoutFitNote = JSON.stringify({ ...JSON.parse(validJdAnalysisFixture), fitNote: undefined });
  assert.equal(parseJdAnalysis(withoutFitNote), null);
  const badMatched = JSON.stringify({ ...JSON.parse(validJdAnalysisFixture), matched: "Python" });
  assert.equal(parseJdAnalysis(badMatched), null);
});

test("parseJdAnalysis defaults atsCheck to empty when absent", () => {
  const result = parseJdAnalysis(validJdAnalysisFixture);
  assert.ok(result);
  assert.deepEqual(result.atsCheck, { present: [], missing: [], score: 0, total: 0 });
});

// Async test runner for subprocess-based checks
async function runAsyncTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// Run async tests (subprocess-based checks that must run after sync tests)
(async () => {
  await runAsyncTest(
    "stdio bridge exposes exactly the tools in lib/assistant-tools.ts",
    checkMcpParity
  );
})().catch(() => {
  process.exit(1);
});
