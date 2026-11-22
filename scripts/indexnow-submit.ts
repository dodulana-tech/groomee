/**
 * Push URLs to IndexNow (Bing, Yandex, Seznam).
 *
 * ChatGPT Search is built on Bing's index, so a page Bing has not seen cannot
 * be cited in a ChatGPT answer however well it ranks on Google. Google ignores
 * IndexNow; Search Console covers Google. Run after each deploy that adds or
 * changes public pages.
 *
 * Usage:
 *   npm run indexnow                              every URL in the live sitemap
 *   npm run indexnow -- /lagos/knotless-braids    specific paths
 *   npm run indexnow -- --dry-run
 */
const KEY = process.env.INDEXNOW_KEY ?? "464cb6d1b7ad2c38abfd2db9e4014216";
const BASE = (process.env.SITE_URL ?? "https://groomeeapp.com").replace(/\/+$/, "");
const HOST = new URL(BASE).host;
const DRY = process.argv.includes("--dry-run");

async function urlsFromSitemap(): Promise<string[]> {
  const res = await fetch(`${BASE}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function main() {
  const keyRes = await fetch(`${BASE}/${KEY}.txt`);
  if (!keyRes.ok || (await keyRes.text()).trim() !== KEY) {
    throw new Error(`key file ${BASE}/${KEY}.txt is not live yet (HTTP ${keyRes.status}); deploy first`);
  }

  const explicit = process.argv.slice(2).filter((a) => a.startsWith("/"));
  const urlList = explicit.length > 0 ? explicit.map((p) => `${BASE}${p}`) : await urlsFromSitemap();

  console.log(`Host: ${HOST}`);
  console.log(`Submitting ${urlList.length} URLs${DRY ? " (dry run)" : ""}`);
  if (DRY) {
    urlList.slice(0, 10).forEach((u) => console.log(`  ${u}`));
    if (urlList.length > 10) console.log(`  … and ${urlList.length - 10} more`);
    return;
  }

  const BATCH = 500;
  for (let i = 0; i < urlList.length; i += BATCH) {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `${BASE}/${KEY}.txt`,
        urlList: urlList.slice(i, i + BATCH),
      }),
    });
    const ok = res.status === 200 || res.status === 202;
    console.log(`  batch ${i / BATCH + 1}: HTTP ${res.status} ${ok ? "accepted" : await res.text()}`);
    if (!ok) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
