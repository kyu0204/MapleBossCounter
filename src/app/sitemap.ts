import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";
import { listPosts } from "@/lib/db/queries/board";

// 모집글 목록을 DB 에서 읽으므로 빌드 시점 고정 대신 요청마다 생성
export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/bosses/tiers`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/board`, lastModified: now, changeFrequency: "hourly", priority: 0.7 },
    { url: `${base}/lookup`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
  const posts = listPosts({}, 500).map((p) => ({ url: `${base}/board/${p.id}`, lastModified: new Date(p.updatedAt), changeFrequency: "daily" as const, priority: 0.5 }));
  return [...fixed, ...posts];
}
