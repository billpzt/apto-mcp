export function IncomeContextPanel() {
  const incomeItems = [
    { label: "Aion", status: "Active client", detail: "R$2k/month retainer" },
    { label: "Freedom3", status: "Client project", detail: "Prototype approved, implementation pending" },
    { label: "AtomLearn", status: "Product", detail: "Goal: 200 paying customers" },
    { label: "Services site", status: "Live", detail: "Portfolio and WhatsApp funnel" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">Income Context</h2>
      <div className="space-y-3">
        {incomeItems.map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">{item.label}</div>
              <div className="text-xs text-gray-500">{item.detail}</div>
            </div>
            <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
