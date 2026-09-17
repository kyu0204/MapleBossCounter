import { SkeletonPage } from "@/components/ui/Skeleton";

/** 캐릭터 목록은 캐릭터마다 스냅샷을 읽어 가장 오래 걸리는 화면이다. */
export default function Loading() {
  return <SkeletonPage cards={4} lines={4} />;
}
