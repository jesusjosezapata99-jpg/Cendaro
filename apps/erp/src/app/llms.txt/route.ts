import { siteUrl } from "~/lib/site-env";
import { buildLlmsTxt } from "../_components/landing/llms";

/**
 * Static `/llms.txt` route (llmstxt.org v2 specification).
 * Gives AI search engines and assistants a clean Markdown overview of Cendaro.
 */
export function GET(): Response {
  return new Response(buildLlmsTxt(siteUrl), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
}
