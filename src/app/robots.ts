import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/bosses/", "/board", "/lookup"], disallow: ["/me", "/settings", "/parties", "/planner", "/api/", "/board/new", "/board/mine", "/login"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
