/** 넥슨 Open API 에러. code 는 OPENAPI000xx. */
export class NexonApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly endpoint: string,
    public readonly status: number,
  ) {
    super(`[${code}] ${message} (${endpoint})`);
    this.name = "NexonApiError";
  }

  /** 호출 한도 초과 (5건/초 또는 일일) */
  get isThrottled() {
    return this.code === "OPENAPI00007";
  }
  /** 키 무효 */
  get isInvalidKey() {
    return this.code === "OPENAPI00005";
  }
  /** 잘못된 파라미터 — 스케줄러 date 조회에서 "기록 없음" 의미로도 옴 */
  get isInvalidParam() {
    return this.code === "OPENAPI00004";
  }
  /** 점검/준비중 */
  get isMaintenance() {
    return ["OPENAPI00009", "OPENAPI00010", "OPENAPI00011"].includes(this.code);
  }
}

/** 계정 한정 엔드포인트인데 유저 키가 없을 때 */
export class NoCredentialError extends Error {
  constructor(message = "넥슨 API 키가 등록되지 않았습니다") {
    super(message);
    this.name = "NoCredentialError";
  }
}

export function userMessageFor(e: unknown): string {
  if (e instanceof NexonApiError) {
    if (e.isThrottled) return "넥슨 API 호출 한도에 걸렸습니다. 잠시 후 다시 시도해주세요.";
    if (e.isInvalidKey) return "넥슨 API 키가 유효하지 않습니다. 설정에서 다시 등록해주세요.";
    if (e.isMaintenance) return "넥슨 API 점검 중입니다.";
    return e.message;
  }
  if (e instanceof NoCredentialError) return e.message;
  return e instanceof Error ? e.message : String(e);
}
