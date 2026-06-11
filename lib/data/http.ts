export async function fetchJsonWithFallback<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  if (process.env.CUPEDGE_HTTP_MODE === "curl-first" || process.env.CUPEDGE_HTTP_MODE === "curl-only") {
    const curlFirst = await fetchJsonWithCurl<T>(url, timeoutMs);
    if (curlFirst !== null) return curlFirst;
    if (process.env.CUPEDGE_HTTP_MODE === "curl-only") return null;
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch (fetchError) {
    const curlResult = await fetchJsonWithCurl<T>(url, timeoutMs);
    if (curlResult !== null) return curlResult;
    throw fetchError;
  }
}

export async function fetchTextWithFallback(url: string, timeoutMs = 8000): Promise<string | null> {
  if (process.env.CUPEDGE_HTTP_MODE === "curl-first" || process.env.CUPEDGE_HTTP_MODE === "curl-only") {
    const curlFirst = await fetchTextWithCurl(url, timeoutMs);
    if (curlFirst !== null) return curlFirst;
    if (process.env.CUPEDGE_HTTP_MODE === "curl-only") return null;
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) return null;
    return await response.text();
  } catch (fetchError) {
    const curlResult = await fetchTextWithCurl(url, timeoutMs);
    if (curlResult !== null) return curlResult;
    throw fetchError;
  }
}

async function fetchJsonWithCurl<T>(url: string, timeoutMs: number): Promise<T | null> {
  const stdout = await fetchTextWithCurl(url, timeoutMs);
  if (stdout === null) return null;
  try {
    return JSON.parse(stdout) as T;
  } catch (error) {
    if (process.env.CUPEDGE_HTTP_DEBUG === "1") {
      console.warn(`[CupEdge] JSON parse failed for ${url}:`, error);
    }
    return null;
  }
}

async function fetchTextWithCurl(url: string, timeoutMs: number): Promise<string | null> {
  if (process.env.CUPEDGE_DISABLE_CURL_FALLBACK === "1") return null;
  if (typeof window !== "undefined") return null;

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    const seconds = Math.max(1, Math.ceil(timeoutMs / 1000));
    const args = [
      "-4",
      "-sS",
      "-L",
      "--connect-timeout",
      String(seconds),
      "--max-time",
      String(seconds + 8)
    ];
    if (process.env.CUPEDGE_CURL_PROXY) {
      args.push("--proxy", process.env.CUPEDGE_CURL_PROXY);
    }
    args.push(url);
    const { stdout } = await execFileAsync(
      "curl",
      args,
      { maxBuffer: 20 * 1024 * 1024 }
    );
    return stdout;
  } catch (error) {
    if (process.env.CUPEDGE_HTTP_DEBUG === "1") {
      console.warn(`[CupEdge] curl fallback failed for ${url}:`, error);
    }
    return null;
  }
}
