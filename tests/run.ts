import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  createSessionToken,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "../lib/session";
import { ACTION_STATUSES, JOB_STATUSES, KANBAN_STATUSES, STATUS_CONFIG } from "../lib/constants";
import { calendarDateToIso, formatCalendarDate, parseOptionalDate, isoToCalendarDate } from "../lib/date";
import { deriveFunnelCounts, responseRate } from "../lib/funnel";
import { buildActionCreatePayload, buildDashboard } from "../lib/dashboard";
import { createImportedJobDraftFromParams } from "../lib/job-import";
import {
  buildJobUpdatesMarkdown,
  getJobUpdatesMarkdownPath,
} from "../lib/job-updates";
import {
  formatJobUpdateOccurredAt,
  getJobUpdateTimelinePreview,
} from "../lib/job-update-timeline";
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
import { isOriginAllowed } from "../lib/origin";
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

test("calendarDateToIso round-trips through dayKeyInTimeZone for a normal date", () => {
  const iso = calendarDateToIso("2026-06-15");
  assert.equal(dayKeyInTimeZone(new Date(iso), "America/Sao_Paulo"), "2026-06-15");
});

test("calendarDateToIso round-trips through dayKeyInTimeZone near a DST boundary", () => {
  const iso = calendarDateToIso("2026-02-15");
  assert.equal(dayKeyInTimeZone(new Date(iso), "America/Sao_Paulo"), "2026-02-15");
});

test("calendarDateToIso produces the exact ISO instant for a fixed date", () => {
  const iso = calendarDateToIso("2026-09-05");
  assert.equal(iso, "2026-09-05T03:00:00.000Z");
  assert.equal(dayKeyInTimeZone(new Date(iso), "America/Sao_Paulo"), "2026-09-05");
});

test("calendarDateToIso throws on malformed calendar dates", () => {
  assert.throws(() => calendarDateToIso("05/09/2026"), /Invalid calendar date/);
  assert.throws(() => calendarDateToIso("2026-9-5"), /Invalid calendar date/);
  assert.throws(() => calendarDateToIso(""), /Invalid calendar date/);
});

test("response rate is null when nothing has been submitted", () => {
  assert.equal(responseRate(0, 0), null);
});

test("a rejection with a submission date counts as a response", () => {
  const { submittedCount, respondedCount } = deriveFunnelCounts([
    { status: "REJECTED", appliedAt: "2026-06-01T12:00:00.000Z" },
  ]);
  assert.equal(submittedCount, 1);
  assert.equal(respondedCount, 1);
});

test("response rate cannot exceed 100% even when most applications were rejected", () => {
  const { submittedCount, respondedCount } = deriveFunnelCounts([
    { status: "REJECTED", appliedAt: "2026-06-01T12:00:00.000Z" },
    { status: "REJECTED", appliedAt: "2026-06-02T12:00:00.000Z" },
    { status: "REJECTED", appliedAt: "2026-06-03T12:00:00.000Z" },
    { status: "REJECTED", appliedAt: "2026-06-04T12:00:00.000Z" },
    { status: "APPLIED", appliedAt: "2026-06-05T12:00:00.000Z" },
  ]);
  assert.equal(submittedCount, 5);
  assert.equal(respondedCount, 4);
  assert.equal(responseRate(submittedCount, respondedCount), 80);
});

test("stalled and withdrawn jobs count as submitted but not as responses", () => {
  const { submittedCount, respondedCount } = deriveFunnelCounts([
    { status: "STALLED", appliedAt: "2026-06-01T12:00:00.000Z" },
    { status: "WITHDRAWN", appliedAt: "2026-06-02T12:00:00.000Z" },
  ]);
  assert.equal(submittedCount, 2);
  assert.equal(respondedCount, 0);
});

test("a job with no appliedAt is excluded from the denominator even when rejected", () => {
  const { submittedCount, respondedCount } = deriveFunnelCounts([
    { status: "REJECTED", appliedAt: null },
  ]);
  assert.equal(submittedCount, 0);
  assert.equal(respondedCount, 0);
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

// Every path the app writes pipeline data to must be gitignored. The whole
// local-first promise is that a job search never leaves the machine, and a
// user who runs `git add .` should not be able to publish one by accident.
// The session cookie is the only thing between a deployed instance and the
// whole pipeline, so these cover the three ways it can go wrong: a forged
// signature, a token outliving its expiry, and a rotated password failing to
// revoke anything.
async function sessionTokensRoundTrip() {
  const token = await createSessionToken("correct horse battery staple");
  assert.equal(await verifySessionToken(token, "correct horse battery staple"), true);

  assert.equal(await verifySessionToken(token, "a different password"), false);
  // Flip the last character to a different one rather than to a fixed value,
  // which silently passed whenever the signature already ended in that value.
  const lastCharacter = token.slice(-1);
  const tampered = token.slice(0, -1) + (lastCharacter === "0" ? "1" : "0");
  assert.notEqual(tampered, token);
  assert.equal(await verifySessionToken(tampered, "correct horse battery staple"), false);
  assert.equal(await verifySessionToken("not-a-token", "correct horse battery staple"), false);
  assert.equal(await verifySessionToken(undefined, "correct horse battery staple"), false);
}

async function sessionTokensExpire() {
  const issuedAt = Date.now();
  const token = await createSessionToken("hunter2", issuedAt);
  const oneSecondBeforeExpiry = issuedAt + SESSION_MAX_AGE_SECONDS * 1000 - 1000;
  const oneSecondAfterExpiry = issuedAt + SESSION_MAX_AGE_SECONDS * 1000 + 1000;

  assert.equal(await verifySessionToken(token, "hunter2", oneSecondBeforeExpiry), true);
  assert.equal(await verifySessionToken(token, "hunter2", oneSecondAfterExpiry), false);
}

test("generated pipeline data paths are gitignored", () => {
  const generatedPaths = [
    getJobUpdatesMarkdownPath("Northwind Systems", "Field Delivery Engineer"),
  ];
  for (const generated of generatedPaths) {
    const result = spawnSync("git", ["check-ignore", "-q", generated], {
      cwd: process.cwd(),
    });
    assert.equal(result.status, 0, `${generated} is not gitignored`);
  }
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

test("a job update's calendar date round-trips to the same day, and the timeline formatter renders that same day", () => {
  // This is the exact regression audit finding #11 reported: a date-input
  // value converted with calendarDateToIso must land back on the same
  // calendar day (via dayKeyInTimeZone), and formatJobUpdateOccurredAt must
  // display that same day, not the day before, for a viewer in the
  // configured time zone.
  const occurredAt = calendarDateToIso("2026-09-05");
  assert.equal(occurredAt, "2026-09-05T03:00:00.000Z");
  assert.equal(dayKeyInTimeZone(new Date(occurredAt), "America/Sao_Paulo"), "2026-09-05");
  assert.equal(formatJobUpdateOccurredAt(occurredAt), "Sep 5");
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

test("isOriginAllowed rejects an unlisted origin", () => {
  assert.equal(isOriginAllowed("https://evil.example.com", ["https://apto-rho.vercel.app"]), false);
});

test("isOriginAllowed allows a listed origin", () => {
  assert.equal(isOriginAllowed("https://apto-rho.vercel.app", ["https://apto-rho.vercel.app"]), true);
});

test("isOriginAllowed allows a request with no Origin header at all", () => {
  // Hosted MCP connectors call server to server and send no Origin header.
  // This must stay allowed or the deployed connector breaks.
  assert.equal(isOriginAllowed(null, ["https://apto-rho.vercel.app"]), true);
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

test("the audit's own round trip: a stored calendar date renders as the day it was picked, not a day early", () => {
  const iso = calendarDateToIso("2026-09-05");
  assert.equal(formatJobUpdateOccurredAt(iso), "Sep 5");
});

test("the timezone pin holds when the runtime clock sits west of Sao Paulo", () => {
  const originalTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const iso = calendarDateToIso("2026-09-05");
    assert.equal(formatCalendarDate(iso), "Sep 5");
  } finally {
    process.env.TZ = originalTz;
  }
});

test("a January 1 calendar date does not render as December 31 across the year boundary", () => {
  const originalTz = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    const iso = calendarDateToIso("2026-01-01");
    assert.equal(
      formatCalendarDate(iso, { month: "short", day: "numeric", year: "numeric" }),
      "Jan 1, 2026"
    );
  } finally {
    process.env.TZ = originalTz;
  }
});

// Run async tests (subprocess-based checks that must run after sync tests)
(async () => {
  await runAsyncTest("session tokens round-trip and reject tampering", sessionTokensRoundTrip);
  await runAsyncTest("session tokens stop verifying after they expire", sessionTokensExpire);
  await runAsyncTest(
    "stdio bridge exposes exactly the tools in lib/assistant-tools.ts",
    checkMcpParity
  );
})().catch(() => {
  process.exit(1);
});

test("a calendar date survives the edit-form round trip in a zone ahead of UTC", () => {
  // The form-to-API-to-form loop: what the user picked, what gets stored, and what
  // the edit form pre-fills when the job is re-opened. Europe/Berlin is deliberate:
  // Sao Paulo sits behind UTC, which hides this bug, and the app is self-hostable.
  const picked = "2026-09-05";
  const stored = calendarDateToIso(picked, "Europe/Berlin");
  assert.equal(stored, "2026-09-04T22:00:00.000Z");
  assert.equal(isoToCalendarDate(stored, "Europe/Berlin"), picked);
});

test("the edit-form pre-fill round trips in the configured Sao Paulo zone too", () => {
  const picked = "2026-09-05";
  assert.equal(isoToCalendarDate(calendarDateToIso(picked)), picked);
});

test("the edit-form pre-fill holds across a year boundary", () => {
  const picked = "2026-01-01";
  assert.equal(isoToCalendarDate(calendarDateToIso(picked)), picked);
});
