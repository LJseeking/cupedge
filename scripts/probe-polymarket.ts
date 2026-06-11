import { fetchJsonWithFallback } from "../lib/data/http";

const base = (process.env.POLYMARKET_API_BASE || "https://gamma-api.polymarket.com").replace(/\/$/, "");
const urls = [
  `${base}/markets?limit=1`,
  `${base}/markets?active=true&closed=false&limit=5&search=${encodeURIComponent("World Cup Group C Winner")}`,
  `${base}/events?active=true&closed=false&limit=5&search=${encodeURIComponent("World Cup Group C Winner")}`,
  `${base}/events?slug=world-cup-group-c-winner`,
  `${base}/markets?active=true&closed=false&limit=5&search=${encodeURIComponent("世界杯C组冠军")}`
];

async function main() {
  const proxyArg = process.argv.find((arg) => arg.startsWith("--proxy="));
  if (proxyArg) {
    process.env.CUPEDGE_CURL_PROXY = proxyArg.replace("--proxy=", "");
  }
  if (!process.argv.includes("--node-fetch")) {
    process.env.CUPEDGE_HTTP_MODE = "curl-only";
    process.env.CUPEDGE_HTTP_DEBUG = "1";
  }

  for (const url of urls) {
    console.log(`\n=== ${url} ===`);
    const data = await fetchJsonWithFallback<unknown>(url, 8000);
    if (!data) {
      console.log("NO_DATA");
      continue;
    }
    const rows = extractRows(data);
    console.log(`rows=${rows.length}`);
    const first = rows[0];
    if (!first) {
      console.log(`shape=${shape(data)}`);
      continue;
    }
    console.log(`first.keys=${Object.keys(first).slice(0, 30).join(",")}`);
    console.log(`first.slug=${stringValue(first.slug)}`);
    console.log(`first.title=${stringValue(first.title ?? first.question)}`);
    console.log(`first.groupItemTitle=${stringValue(first.groupItemTitle ?? first.group_item_title)}`);
    console.log(`first.volume=${stringValue(first.volume)}`);
    console.log(`first.volume24hr=${stringValue(first.volume24hr)}`);
    console.log(`first.liquidity=${stringValue(first.liquidity)}`);
    const nestedMarkets = parseMaybeJsonArray(first.markets);
    console.log(`nestedMarkets=${nestedMarkets.length}`);
    if (nestedMarkets[0] && typeof nestedMarkets[0] === "object") {
      const nested = nestedMarkets[0] as Record<string, unknown>;
      console.log(`nested.keys=${Object.keys(nested).slice(0, 30).join(",")}`);
      console.log(`nested.slug=${stringValue(nested.slug)}`);
      console.log(`nested.title=${stringValue(nested.title ?? nested.question)}`);
      console.log(`nested.groupItemTitle=${stringValue(nested.groupItemTitle ?? nested.group_item_title)}`);
      console.log(`nested.volume=${stringValue(nested.volume)}`);
      console.log(`nested.liquidity=${stringValue(nested.liquidity)}`);
      console.log(`nested.outcomes=${stringValue(nested.outcomes).slice(0, 240)}`);
      console.log(`nested.outcomePrices=${stringValue(nested.outcomePrices).slice(0, 240)}`);
    }
    console.log(`first.outcomes=${stringValue(first.outcomes).slice(0, 240)}`);
    console.log(`first.outcomePrices=${stringValue(first.outcomePrices).slice(0, 240)}`);
  }
}

function extractRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (!isRecord(data)) return [];
  if (Array.isArray(data.data)) return data.data.filter(isRecord);
  if (Array.isArray(data.markets)) return data.markets.filter(isRecord);
  if (Array.isArray(data.events)) return data.events.filter(isRecord);
  return [data];
}

function parseMaybeJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function shape(value: unknown) {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (isRecord(value)) return `object(${Object.keys(value).join(",")})`;
  return typeof value;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
