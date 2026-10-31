import { siteUrl } from "~/lib/site-env";
import { buildLlmsFullTxt } from "../_components/landing/llms";

/**
 * Static `/llms-full.txt` route (llmstxt.org v2 specification).
 * Concatenates the complete verified product documentation into a single
 * Markdown response for single-request LLM context ingestion.
 */
export function GET(): Response {
  return new Response(buildLlmsFullTxt(siteUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
}
