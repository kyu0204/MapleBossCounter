import { SkeletonPage } from "@/components/ui/Skeleton";

/** 캘린더는 스냅샷 한 달치와 파티·만료·공지를 한 번에 읽는다. */
export default function Loading() {
  return <SkeletonPage cards={2} lines={8} />;
}
