"use client";

type Account = { id: string; code: string; name: string; type: string };

export default function AccountSelector({
  accounts,
  selectedAccountId,
}: {
  accounts: Account[];
  selectedAccountId?: string;
}) {
  const groups = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];
  return (
    <select
      defaultValue={selectedAccountId || ""}
      className="input"
      onChange={(e) => {
        if (e.target.value) {
          window.location.search = `?accountId=${e.target.value}`;
        }
      }}
    >
      <option value="">— Choose Account —</option>
      {groups.map((group) => (
        <optgroup key={group} label={group + "S"}>
          {accounts
            .filter((a) => a.type === group || a.type === group + "S")
            .map((a) => (
              <option key={a.id} value={a.id}>
                [{a.code}] {a.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
