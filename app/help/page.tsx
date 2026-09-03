import {
  Briefcase,
  Star,
  Globe,
  Users,
  FileText,
  RefreshCw,
  Zap,
  BookOpen,
  Target,
  Settings,
  ChevronRight,
} from "lucide-react";

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center">
          <Icon size={14} className="text-indigo-600" />
        </div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="ml-9">{children}</div>
    </div>
  );
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 leading-relaxed">
      {children}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
            <Zap size={13} className="text-white" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Apto — Help & Reference</h1>
        </div>
        <p className="text-sm text-gray-500">
          Apto is your personal job search command center. Track applications, manage skills, analyze job descriptions, and keep everything in one place.
        </p>
      </div>

      {/* Jobs — Kanban Board */}
      <Section icon={Briefcase} title="Jobs">
        <p className="text-sm text-gray-600 mb-4">
          The main kanban board. Every job lead lives here, organized by status. Click any card to view details or move it to a new column.
        </p>

        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status meanings</h3>
        <div className="flex flex-col gap-2 mb-5">
          {[
            { label: "BACKLOG", color: "bg-gray-50 text-gray-600 border-gray-200", desc: "Intend to pursue — haven't started yet." },
            { label: "APPLIED", color: "bg-blue-50 text-blue-700 border-blue-200", desc: "CV sent, waiting for response." },
            { label: "ASSESSMENT", color: "bg-violet-50 text-violet-700 border-violet-200", desc: "Test or coding challenge pending." },
            { label: "STANDBY", color: "bg-amber-50 text-amber-700 border-amber-200", desc: "On hold — waiting on recruiter or client." },
            { label: "STALLED", color: "bg-orange-50 text-orange-700 border-orange-200", desc: "Paused, ghosted, or unclear next step." },
            { label: "CLOSED", color: "bg-emerald-50 text-emerald-700 border-emerald-200", desc: "Engagement completed (e.g. paid consulting)." },
            { label: "REJECTED", color: "bg-red-50 text-red-700 border-red-200", desc: "Formal rejection received." },
            { label: "WITHDRAWN", color: "bg-gray-50 text-gray-500 border-gray-200", desc: "You withdrew the application." },
            { label: "PROFILE_LIVE", color: "bg-indigo-50 text-indigo-700 border-indigo-200", desc: "Passive platform profile — shown in Directory, not the main board." },
          ].map(({ label, color, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <StatusBadge label={label} color={color} />
              <span className="text-sm text-gray-500 pt-0.5">{desc}</span>
            </div>
          ))}
        </div>

        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Check a job</h3>
        <Card>
          Paste a job description into any job card to automatically extract required skills, identify gaps against your profile, and assign an A–F match score. Extracted skills appear as color-coded pills on the card: green (you have it), yellow (partial), red (gap).
        </Card>
      </Section>

      {/* Directory */}
      <Section icon={Globe} title="Directory">
        <Card>
          Shows all jobs with status <strong>PROFILE_LIVE</strong> — platforms where you have a passive profile (Wellfound, Strider, Revelo, etc.). Filtered out of the main kanban to keep it clean. Check periodically for inbound matches.
        </Card>
      </Section>

      {/* Skills */}
      <Section icon={Star} title="Skills">
        <p className="text-sm text-gray-600 mb-4">
          Three tabs: Skills, Practice Log, and Gap Analysis.
        </p>
        <div className="flex flex-col gap-3">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Star size={13} className="text-indigo-500" />
              <span className="font-medium text-gray-900">Skills</span>
            </div>
            Your tracked skills with proficiency levels (1 Beginner to 5 Expert), organized by category. Starred skills are featured on your profile. Two sync buttons: <em>Sync from Resume</em> extracts skills from your stored resume; <em>Sync AtomLearn</em> pulls mastery scores from AtomLearn.
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={13} className="text-indigo-500" />
              <span className="font-medium text-gray-900">Practice Log</span>
            </div>
            Log study sessions manually. Track platform, topic, number of problems, duration, and difficulty. Linked to skills so progress shows up in gap analysis.
          </Card>
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <Target size={13} className="text-indigo-500" />
              <span className="font-medium text-gray-900">Gap Analysis</span>
            </div>
            Automatically splits your skills into strengths (level 4+) and gaps (level 1–2), with practice recommendations for each gap area.
          </Card>
        </div>
      </Section>

      {/* Contacts */}
      <Section icon={Users} title="Contacts">
        <Card>
          CRM for recruiters, hiring managers, and referrals. Link contacts to job cards to keep track of who you talked to and when. Active threads visible at a glance.
        </Card>
      </Section>

      {/* Resume */}
      <Section icon={FileText} title="Resume">
        <Card>
          Stores your resume versions. The default resume (seeded from <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">cv.md</code>) is used by the <em>Sync from Resume</em> feature to extract skills automatically.
        </Card>
      </Section>

      {/* Integrations */}
      <Section icon={RefreshCw} title="Integrations">
        <div className="flex flex-col gap-3">
          <Card>
            <div className="font-medium text-gray-900 mb-1">AtomLearn Sync</div>
            Pulls your mastery scores from <a href="https://atomlearn.dev" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">atomlearn.dev</a> and updates skill levels automatically. Configure in Settings: generate a sync key, enter your AtomLearn API URL and Supabase user ID. Run from the Skills page.
          </Card>
          <Card>
            <div className="font-medium text-gray-900 mb-1">Resume Sync</div>
            Analyzes your stored resume text with AI, extracts mentioned skills and implied proficiency levels, and upserts them into your Skills list. Run from the Skills page.
          </Card>
          <Card>
            <div className="font-medium text-gray-900 mb-1">Workspace Sync</div>
            Pushes job search data from your markdown workspace (maintained in Claude / Cowork sessions) directly into Apto via API. Claude reads your workspace files and sends structured job, skill, and contact data in one shot. Configure in Settings: generate a workspace sync key and share it with Claude. Last sync timestamp shown in Settings and the dashboard.
          </Card>
          <Card>
            <div className="font-medium text-gray-900 mb-1">AI Providers</div>
            Apto supports multiple AI backends for job analysis, cover letter drafting and resume parsing. Configure in Settings under <em>AI Providers</em>. Supported providers: DeepSeek (default, cost-efficient), OpenRouter (access to many models), Anthropic Claude (requires separate API billing). Only one provider is active at a time.
          </Card>
        </div>
      </Section>

      {/* Settings */}
      <Section icon={Settings} title="Settings">
        <div className="flex flex-col gap-2 text-sm text-gray-600">
          {[
            ["AI Providers", "Add API keys and set the active AI backend."],
            ["AtomLearn Integration", "Generate sync key, enter your AtomLearn API URL and Supabase user ID."],
            ["Workspace Sync", "Generate a sync key to authorize Claude to push workspace data into Apto."],
            ["Change Password", "Update your Apto login password."],
          ].map(([label, desc]) => (
            <div key={label} className="flex items-start gap-2">
              <ChevronRight size={14} className="text-gray-300 mt-0.5 shrink-0" />
              <span><strong className="text-gray-800">{label}</strong> — {desc}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="border-t border-gray-100 pt-6 text-xs text-gray-400 text-center">
        Apto beta
        {process.env.NEXT_PUBLIC_OWNER_NAME ? ` — built by ${process.env.NEXT_PUBLIC_OWNER_NAME}` : ""}
      </div>
    </div>
  );
}
