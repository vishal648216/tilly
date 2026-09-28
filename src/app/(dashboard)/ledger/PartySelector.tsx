"use client";

type Party = { id: string; name: string; type: string };

export default function PartySelector({
  parties,
  selectedPartyId,
}: {
  parties: Party[];
  selectedPartyId?: string;
}) {
  return (
    <select
      defaultValue={selectedPartyId || ""}
      className="input"
      onChange={(e) => {
        if (e.target.value) {
          window.location.search = `?partyId=${e.target.value}`;
        }
      }}
    >
      <option value="">— Choose Party —</option>
      {parties.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name} ({p.type})
        </option>
      ))}
    </select>
  );
}
