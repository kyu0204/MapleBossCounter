/**
 * 넥슨 캐릭터 이미지(300×300 PNG, 투명 배경)를 잘라 보여준다.
 *
 * 실측 (캐릭터 6개의 불투명 픽셀):
 *   전신   x 85~194, y 125~210
 *   머리   x 108~178, y 125~175  (가로 최대 70, 세로 약 46)
 * 나머지는 전부 투명 여백이라 원본을 그대로 두면 캐릭터가 구석에 작게 박힌다.
 *
 * 두 가지로 자른다.
 *   full — 전신이 다 들어온다. 내 캐릭터 목록·상세처럼 캐릭터를 통째로 보는 곳.
 *   face — 얼굴을 채운다. 파티처럼 작은 칸에 여럿을 늘어놓고 누군지 가려내는 곳.
 */

export type AvatarCrop = "full" | "face";

/**
 * 잘라내기 기준. center 는 박스 한가운데에 놓을 원본 좌표,
 * box 는 박스를 가득 채울 원본 폭(= 배율을 정하는 값)이다.
 */
const CROP: Record<AvatarCrop, { center: { x: number; y: number }; box: number }> = {
  // 전신 중심(135, 168), 폭 118 이면 98px 짜리 캐릭터가 어느 크기에서도 안 잘린다.
  full: { center: { x: 135, y: 168 }, box: 118 },
  // 머리 중심(145, 149), 폭 76. 원본 x 107~183 · y 111~187 이 보이므로 머리는
  // 다 들어오고 다리 쪽만 잘린다. 더 좁히면 머리카락이 잘리기 시작한다.
  face: { center: { x: 145, y: 149 }, box: 76 },
};

export function CharacterAvatar({
  src,
  alt = "",
  size = 112,
  crop = "full",
  className = "",
}: {
  src: string | null | undefined;
  alt?: string;
  size?: number;
  /** 기본은 전신. 작은 칸에서 얼굴을 알아봐야 하면 "face" */
  crop?: AvatarCrop;
  className?: string;
}) {
  const box = { width: size, height: size };
  if (!src) return <div className={`rounded-lg bg-zinc-100 dark:bg-zinc-800 shrink-0 ${className}`} style={box} />;

  const { center, box: content } = CROP[crop];
  const scale = size / content;
  const ox = size / 2 - center.x * scale;
  const oy = size / 2 - center.y * scale;
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
