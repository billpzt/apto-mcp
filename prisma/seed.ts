/**
 * Apto demo seed.
 *
 * Everything in this file is invented. The companies, people, salaries and
 * notes are fictional and exist only so a fresh clone opens onto a populated
 * board instead of an empty one.
 *
 * Do not put a real pipeline in here. This file is committed to git, and a
 * job search contains other people's names, your own rejection history and
 * your compensation numbers. Keep real data in the database, which is
 * gitignored, and edit it through the UI or the MCP tools.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const daysFromNow = (n: number) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000);

async function main() {
  console.log("🌱 Seeding Apto with demo data...");

  // Wipe existing data in FK-safe order (child tables first)
  await db.jobContact.deleteMany();
  await db.actionItem.deleteMany();
  await db.job.deleteMany();
  await db.contact.deleteMany();
  await db.skill.deleteMany();
  await db.resumeVersion.deleteMany();
  await db.directoryItem.deleteMany();
  await db.aiProviderConfig.deleteMany();
  console.log("  ↺ Cleared existing data");

  // ── JOBS ────────────────────────────────────────────────────────────────
  const jobs = [
    {
      title: "Forward Deployed Engineer",
      company: "Northwind Robotics",
      url: "https://example.com/jobs/fde",
      canonicalUrl: "https://example.com/jobs/fde",
      status: "APPLIED",
      location: "Remote (worldwide)",
      salary: "$6,000/mo",
      jobType: "Full-time",
      titleFamily: "forward_deployed_engineering",
      remoteScope: "worldwide",
      eligibleFromBrazil: "eligible",
      eligibilityEvidence:
        "Posting states 'open to candidates in any timezone with 4h overlap with CET'.",
      score: "A",
      priority: "high",
      sourceType: "referral",
      appliedAt: daysFromNow(-6),
      lastContactDate: daysFromNow(-6),
      followUpDate: daysFromNow(1),
      notes:
        "Demo record. Strongest match in this fictional pipeline: the core requirements are Python, debugging production systems and talking to customers, all of which are on the demo profile.",
      nextAction: "Follow up if there is no reply by the follow-up date.",
    },
    {
      title: "Senior Backend Engineer, Platform",
      company: "Cobalt Systems",
      url: "https://example.com/jobs/backend-platform",
      status: "ASSESSMENT",
      location: "Remote (EU)",
      salary: "€70,000/yr",
      jobType: "Full-time",
      titleFamily: "backend_engineering",
      remoteScope: "eu",
      eligibleFromBrazil: "uncertain",
      eligibilityEvidence:
        "Posting says 'Remote, Europe'. No explicit statement about contractors outside the EU. Flagged rather than assumed.",
      score: "B",
      priority: "medium",
      sourceType: "job_board",
      appliedAt: daysFromNow(-19),
      lastContactDate: daysFromNow(-3),
      followUpDate: daysFromNow(4),
      notes:
        "Demo record. Second conversation scheduled. Note the eligibility flag: this one is 'uncertain', so it stays out of the application-ready queue until someone confirms.",
      nextAction: "Prepare a walkthrough of one production incident.",
    },
    {
      title: "AI Solutions Engineer",
      company: "Marlowe Data",
      url: "https://example.com/jobs/ai-solutions",
      status: "BACKLOG",
      location: "Remote (LatAm)",
      salary: null,
      jobType: "Full-time",
      titleFamily: "ai_engineering",
      remoteScope: "latam",
      eligibleFromBrazil: "eligible",
      eligibilityEvidence: "Posting lists Brazil among the hiring countries.",
      score: "B",
      priority: "medium",
      sourceType: "job_board",
      notes:
        "Demo record. No salary band published, so the number has to come up early rather than late.",
    },
    {
      title: "Automation Engineer",
      company: "Halden Logistics",
      url: "https://example.com/jobs/automation",
      status: "REJECTED",
      location: "Remote",
      salary: "$4,500/mo",
      jobType: "Contract",
      titleFamily: "automation_engineering",
      remoteScope: "worldwide",
      eligibleFromBrazil: "eligible",
      eligibilityEvidence: "Posting states 'contractors welcome, any location'.",
      score: "C",
      priority: "low",
      sourceType: "job_board",
      appliedAt: daysFromNow(-28),
      lastContactDate: daysFromNow(-21),
      closedReason:
        "Screened out at the technical stage. The gap was SQL, which is now on the practice list.",
      notes:
        "Demo record. Kept in the board on purpose: rejections are data, and the closed reason is what feeds the gap analysis.",
    },
    {
      title: "Full Stack Developer",
      company: "Ridley Interactive",
      url: "https://example.com/jobs/fullstack",
      status: "STALLED",
      location: "Hybrid, Lisbon",
      salary: null,
      jobType: "Full-time",
      titleFamily: "fullstack_engineering",
      remoteScope: "onsite",
      eligibleFromBrazil: "ineligible",
      eligibilityEvidence:
        "Posting requires three days a week onsite in Lisbon. Recorded as ineligible rather than deleted, so the same posting is not re-imported next rotation.",
      score: "D",
      priority: "low",
      sourceType: "job_board",
      notes:
        "Demo record. Shows what an ineligible role looks like: it stays visible, flagged, and out of the ranked queue.",
    },
  ];

  const createdJobs: Record<string, { id: string }> = {};

  for (const job of jobs) {
    const created = await db.job.create({ data: job });
    createdJobs[job.company] = created;
  }
  console.log(`  ✓ ${jobs.length} demo jobs inserted`);

  // ── CONTACTS ────────────────────────────────────────────────────────────
  const recruiter = await db.contact.create({
    data: {
      name: "Sam Rivera",
      title: "Technical Recruiter",
      company: "Northwind Robotics",
      notes: "Fictional contact. First point of contact on the FDE role.",
    },
  });

  const referrer = await db.contact.create({
    data: {
      name: "Alex Moreau",
      title: "Staff Engineer",
      company: "Northwind Robotics",
      notes:
        "Fictional contact. Made the referral. Note the field that matters in a real pipeline: how long the referrer has been at the company, because a brand new employee gets you read, not argued for.",
    },
  });

  await db.contact.create({
    data: {
      name: "Priya Raman",
      title: "Engineering Manager",
      company: "Cobalt Systems",
      notes: "Fictional contact. Runs the second interview.",
    },
  });

  // ── LINK SOURCE CONTACTS & JOB CONTACTS ─────────────────────────────────
  await db.job.update({
    where: { id: createdJobs["Northwind Robotics"].id },
    data: { sourceContactId: referrer.id },
  });

  await db.jobContact.create({
    data: {
      jobId: createdJobs["Northwind Robotics"].id,
      contactId: referrer.id,
      role: "referral",
      notes: "Passed the profile to the hiring manager directly.",
    },
  });

  await db.jobContact.create({
    data: {
      jobId: createdJobs["Northwind Robotics"].id,
      contactId: recruiter.id,
      role: "recruiter",
      notes: "Owns the scheduling and the offer conversation.",
    },
  });

  console.log("  ✓ Contacts and links created");

  // ── ACTION ITEMS ────────────────────────────────────────────────────────
  await db.actionItem.createMany({
    data: [
      {
        title: "Follow up on the Northwind application",
        kind: "follow_up",
        status: "open",
        dueDate: daysFromNow(1),
        jobId: createdJobs["Northwind Robotics"]?.id,
        notes: "Keep it short. One question, no pressure.",
      },
      {
        title: "Prepare the incident walkthrough for Cobalt",
        kind: "prep",
        status: "open",
        dueDate: daysFromNow(3),
        jobId: createdJobs["Cobalt Systems"]?.id,
        notes:
          "One story, told out loud, timed. Written notes are not rehearsal.",
      },
      {
        title: "Confirm whether Cobalt can contract outside the EU",
        kind: "research",
        status: "open",
        dueDate: daysFromNow(2),
        jobId: createdJobs["Cobalt Systems"]?.id,
        notes: "Blocks any further work on this role. Ask before tailoring.",
      },
    ],
  });
  console.log("  ✓ 3 action items inserted");

  // ── DIRECTORY ITEMS ─────────────────────────────────────────────────────
  // Public job boards and platforms. Add your own; these are just starting points.
  await db.directoryItem.createMany({
    data: [
      {
        name: "LinkedIn Jobs",
        url: "https://www.linkedin.com/jobs/",
        category: "job_board",
        status: "active",
        checkFrequencyDays: 2,
        nextAction: "Check saved searches and warm network leads.",
      },
      {
        name: "Get on Board",
        url: "https://www.getonbrd.com",
        category: "job_board",
        status: "active",
        checkFrequencyDays: 3,
        nextAction: "Filter by remote and language requirements.",
      },
      {
        name: "Wellfound",
        url: "https://wellfound.com",
        category: "platform",
        status: "active",
        checkFrequencyDays: 14,
        nextAction: "Keep the profile visible to recruiters.",
      },
      {
        name: "Himalayas",
        url: "https://himalayas.app",
        category: "job_board",
        status: "active",
        checkFrequencyDays: 7,
        nextAction: "Remote-only aggregator, good timezone filters.",
      },
      {
        name: "Remotive",
        url: "https://remotive.com",
        category: "job_board",
        status: "active",
        checkFrequencyDays: 7,
        nextAction: "Check the engineering category.",
      },
      {
        name: "Greenhouse job boards",
        url: "https://boards.greenhouse.io",
        category: "company_jobs",
        status: "active",
        checkFrequencyDays: 7,
        nextAction:
          "Go direct to target companies' boards rather than through aggregators.",
      },
    ],
  });
  console.log("  ✓ 6 directory items inserted");

  // ── AI PROVIDER CONFIG ──────────────────────────────────────────────────
  await db.aiProviderConfig.create({
    data: {
      provider: "manual",
      model: "Configure a provider in Settings",
      apiKeyName: null,
      isDefault: true,
    },
  });
  console.log("  ✓ 1 AI provider config inserted");

  // ── SKILLS ──────────────────────────────────────────────────────────────
  // Levels are 1 (Beginner) to 5 (Expert). Replace these with your own.
  const skills = [
    { name: "Python", category: "Languages", level: 4, yearsExp: 4, featured: true, notes: "Demo entry." },
    { name: "TypeScript", category: "Languages", level: 4, yearsExp: 3, featured: true, notes: "Demo entry." },
    { name: "SQL", category: "Languages", level: 2, yearsExp: 2, featured: false, notes: "Demo entry. Flagged as a gap by the Halden rejection." },
    { name: "Bash", category: "Languages", level: 3, yearsExp: 3, featured: false, notes: null },
    { name: "REST APIs", category: "Backend", level: 4, yearsExp: 4, featured: true, notes: "Demo entry." },
    { name: "Playwright", category: "Automation", level: 4, yearsExp: 2, featured: false, notes: "Demo entry." },
    { name: "Next.js", category: "Frameworks", level: 4, yearsExp: 2, featured: true, notes: "Demo entry." },
    { name: "React", category: "Frameworks", level: 3, yearsExp: 2, featured: false, notes: "Demo entry." },
    { name: "Tailwind CSS", category: "Frameworks", level: 4, yearsExp: 2, featured: false, notes: null },
    { name: "Prisma", category: "Databases", level: 3, yearsExp: 1, featured: false, notes: "Demo entry." },
    { name: "PostgreSQL", category: "Databases", level: 3, yearsExp: 2, featured: false, notes: "Demo entry." },
    { name: "Docker", category: "DevOps", level: 3, yearsExp: 2, featured: false, notes: null },
    { name: "Git", category: "DevOps", level: 4, yearsExp: 5, featured: false, notes: null },
    { name: "LLM tool use", category: "AI", level: 4, yearsExp: 2, featured: true, notes: "Demo entry. Structured outputs, tool schemas, agent loops." },
    { name: "Prompt engineering", category: "AI", level: 4, yearsExp: 2, featured: false, notes: "Demo entry." },
    { name: "Debugging unfamiliar codebases", category: "Practice", level: 4, yearsExp: 4, featured: true, notes: "Demo entry." },
  ];

  for (const skill of skills) {
    await db.skill.create({ data: skill });
  }
  console.log(`  ✓ ${skills.length} demo skills inserted`);

  // ── RESUME VERSIONS ─────────────────────────────────────────────────────
  // Placeholder only. Paste your own resume in the Resume tab; it is stored in
  // the database, which is gitignored, and never in this file.
  await db.resumeVersion.createMany({
    data: [
      {
        name: "Demo resume (replace me)",
        isDefault: true,
        content: [
          "# Your Name",
          "",
          "Role you are targeting | City, Country | your@email.example",
          "",
          "## Summary",
          "",
          "Two or three sentences. This placeholder exists so the resume-to-skills",
          "sync has something to parse on a fresh install.",
          "",
          "## Experience",
          "",
          "### Job Title, Company | Start - End | Location",
          "",
          "- What you were responsible for, in your own words.",
          "- Something you can talk about out loud for two minutes without notes.",
          "",
          "## Skills",
          "",
          "List the ones you would be comfortable being tested on.",
          "",
          "## Education",
          "",
          "Programme, institution, years.",
        ].join("\n"),
      },
    ],
  });
  console.log("  ✓ 1 placeholder resume version inserted");

  console.log(
    "\n✅ Demo seed complete. Run `npm run db:studio` to inspect the data.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
