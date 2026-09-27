import { buildRobotsTxt } from "@/lib/robots"

export const dynamic = "force-dynamic"

export function GET() {
  return new Response(buildRobotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  })
}
