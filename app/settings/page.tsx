import { db } from "@/lib/db";
import { serializeDate } from "@/lib/date";
import { AiSettingsForm } from "@/components/AiSettingsForm";
import { AtomLearnSettingsForm } from "@/components/AtomLearnSettingsForm";
import { AdzunaSettingsForm } from "@/components/AdzunaSettingsForm";
import { WorkspaceSyncSettingsForm } from "@/components/WorkspaceSyncSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const configs = await db.aiProviderConfig.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  const serialized = configs.map((c) => ({
    id: c.id,
    provider: c.provider,
    model: c.model,
    apiKeyName: c.apiKeyName,
    isDefault: c.isDefault,
    createdAt: serializeDate(c.createdAt),
    updatedAt: serializeDate(c.updatedAt),
  }));

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl space-y-10">

      {/* AI Provider */}
      <section>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">AI Provider</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure which AI powers the chat assistant.
          </p>
        </div>
        <AiSettingsForm />
        {serialized.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Saved Configurations</h2>
            <div className="space-y-2">
              {serialized.map((c) => (
                <div key={c.id} className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 flex items-center justify-between">
                  <span>
                    <span className="font-medium text-gray-900">{c.provider}</span>
                    {c.model && <span className="text-gray-500 ml-1">({c.model})</span>}
                    {c.isDefault && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">default</span>}
                  </span>
                  {c.apiKeyName && <span className="text-xs font-mono text-gray-400">{c.apiKeyName}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <hr className="border-gray-200" />

      {/* AtomLearn Integration */}
      <section>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">AtomLearn Integration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sync your AtomLearn mastery scores to Apto skill levels automatically.
          </p>
        </div>
        <AtomLearnSettingsForm />
      </section>

      <hr className="border-gray-200" />

      {/* Adzuna Integration */}
      <section>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Adzuna Integration</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-discover job listings from Adzuna and sync them into your Job Tracker.
          </p>
        </div>
        <AdzunaSettingsForm />
      </section>

      <hr className="border-gray-200" />

      {/* Workspace Sync */}
      <section>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Workspace Sync</h1>
          <p className="text-sm text-gray-500 mt-1">
            Let Claude in Cowork push job search data from your workspace markdown files into Apto.
          </p>
        </div>
        <WorkspaceSyncSettingsForm />
      </section>

      <hr className="border-gray-200" />

      {/* Password */}
      <section>
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-gray-900">Security</h1>
        </div>
        <p className="text-sm text-gray-600">
          Access is gated by the <code className="rounded bg-gray-100 px-1">APP_PASSWORD</code>{" "}
          environment variable. Change it there and restart to rotate it, which signs every
          existing session out. There is no in-app password change: sessions are verified at the
          edge without a database round trip, so a password stored in the database could be
          changed without any existing session losing access.
        </p>
      </section>

    </div>
  );
}
