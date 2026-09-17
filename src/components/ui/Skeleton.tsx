/**
 * 로딩 자리표시자.
 *
 * 이 앱은 페이지마다 DB 를 여러 번 읽는다. loading.tsx 가 없으면 그 질의가 다 끝날
 * 때까지 브라우저가 이전 화면에 멈춰 있어서, 눌러도 아무 일도 안 일어나는 것처럼 보인다.
 * 골격을 먼저 띄우면 이동 자체는 즉시 일어난다.
 *
 * Neon 무료 등급은 쉬다 깨어날 때 첫 질의가 1~2초 걸려서 이 차이가 특히 크다.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-zinc-200/70 dark:bg-zinc-800 ${className}`} />;
}

/** 카드 한 장 모양. 줄 수로 높이를 맞춘다. */
export function SkeletonCard({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card space-y-2 ${className}`}>
      <Skeleton className="h-5 w-40" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-1/2" : "w-full"}`} />
      ))}
    </div>
  );
}

/** 제목 + 카드 몇 장. 대부분의 화면이 이 모양이다. */
export function SkeletonPage({ cards = 3, lines = 3 }: { cards?: number; lines?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <Skeleton className="h-7 w-48" />
      <div className="space-y-3">
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonCard key={i} lines={lines} />
        ))}
      </div>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
