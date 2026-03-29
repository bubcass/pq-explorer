import { writeJson } from "./utils.js";

function getLastMembership(member) {
  const memberships = member?.memberships ?? [];
  if (!memberships.length) return null;
  return memberships[memberships.length - 1]?.membership ?? null;
}

function buildCommitteeList(membership) {
  const committees = membership?.committees ?? [];

  return committees.map((c) => {
    const name = c?.committeeName?.[0]?.nameEn ?? "Unnamed Committee";
    const role = c?.role?.title;
    return role ? `${name} (${role})` : name;
  });
}

function buildLookup(rows) {
  const lookup = {};

  for (const row of rows) {
    const member = row?.member;
    const membership = getLastMembership(member);
    if (!member || !membership) continue;

    const memberCode = member?.memberCode;
    if (!memberCode) continue;

    const constituency = membership?.represents?.[0]?.represent?.showAs ?? null;
    const constituencyCode =
      membership?.represents?.[0]?.represent?.representCode ?? null;

    const party = membership?.parties?.at(-1)?.party?.showAs ?? null;
    const partyCode = membership?.parties?.at(-1)?.party?.partyCode ?? null;

    lookup[memberCode] = {
      memberCode,
      memberName: member?.fullName ?? null,
      house: membership?.house?.showAs ?? null,
      constituency,
      constituencyCode,
      party,
      partyCode,
      committees: buildCommitteeList(membership),
      memberUrl: `https://www.oireachtas.ie/en/members/member/${memberCode}/`,
    };
  }

  return lookup;
}

export async function buildMembersLookup() {
  const url =
    "https://api.oireachtas.ie/v1/members?date_start=2024-11-15&chamber=dail&house_no=34&skip=0&limit=5000";

  console.log("Fetching members API data...");

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch members API: ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.results ?? [];

  const lookup = buildLookup(rows);

  await writeJson("src/data/pq/members-lookup.json", lookup);

  console.log("✓ members-lookup.json written");
}
