import { requireUserId } from "@/auth";
import { listOwnedCharacters } from "@/services/characterSync";
import { kstDateStr } from "@/lib/maple/kst";
import { PartyForm } from "@/components/party/PartyForm";

export const metadata = { title: "파티 등록" };

export default async function NewPartyPage() {
  const userId = await requireUserId();
  const mine = (await listOwnedCharacters(userId)).map((c) => c.name);
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-bold">파티 등록</h1>
      <PartyForm myCharacters={mine} today={kstDateStr()} />
    </div>
  );
}
