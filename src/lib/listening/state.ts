import { db } from "@/lib/db";

// Connector cursors / throttles live in the Settings table under "listening.*".

export async function getState(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key: `listening.${key}` } });
  return row?.value ?? null;
}

export async function setState(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key: `listening.${key}` },
    create: { key: `listening.${key}`, value },
    update: { value },
  });
}

/** True when `key` last ran more than `hours` ago (or never). Caller marks the run. */
export async function isDue(key: string, hours: number): Promise<boolean> {
  const last = await getState(`${key}.lastRun`);
  return !last || Date.now() - Number(last) > hours * 60 * 60 * 1000;
}

export async function markRun(key: string): Promise<void> {
  await setState(`${key}.lastRun`, String(Date.now()));
}
