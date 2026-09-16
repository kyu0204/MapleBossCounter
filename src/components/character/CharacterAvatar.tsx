/**
 * 넥슨 캐릭터 이미지(300×300 PNG, 투명 배경)에서 캐릭터가 그려진 부분만 보여준다.
 *
 * 실측(캐릭터 5개의 불투명 픽셀 경계 상자):
 *   x 85~194, y 125~210 / 크기 90~98 × 75~85 / 중심 x 130~146, y 164~171
 * 나머지는 전부 투명 여백이라 그대로 두면 캐릭터가 작게 박힌다.
 *
 * 그래서 중심을 박스 한가운데에 맞추고, 캐릭터가 박스 안에 들어가도록 배율을 잡는다.
 */

/** 실측 중심의 평균 */
const SRC_CENTER = { x: 135, y: 168 };

/**
 * 배율 기준. 캐릭터 최대 폭(98px)이 박스의 약 83%를 차지하도록 잡은 값이다.
 *
 * 예전에는 배율 하한이 1이라 박스가 118 보다 작으면 원본을 1:1 로 그렸고,
 * 98px 짜리 캐릭터가 48~72px 박스에 들어가지 못해 얼굴이 잘렸다.
 */
const CONTENT_BOX = 118;

export function CharacterAvatar({ src, alt = "", size = 112, className = "" }: { src: string | null | undefined; alt?: string; size?: number; className?: string }) {
  const box = { width: size, height: size };
  if (!src) return <div className={`rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 ${className}`} style={box} />;

  const scale = size / CONTENT_BOX;
  const ox = size / 2 - SRC_CENTER.x * scale;
  const oy = size / 2 - SRC_CENTER.y * scale;
  return (
    <div className={`relative overflow-hidden rounded-lg bg-zinc-50 dark:bg-zinc-800/60 shrink-0 ${className}`} style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={300}
        height={300}
        // 확대할 때만 픽셀 그대로 키운다. 축소에 pixelated 를 쓰면 계단현상이 생긴다.
        className={`absolute max-w-none select-none ${scale >= 1 ? "[image-rendering:pixelated]" : ""}`}
        style={{ width: 300 * scale, height: 300 * scale, left: ox, top: oy }}
        draggable={false}
      />
    </div>
  );
}
