export enum ErrorCode {
  OK = 200,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  InternalError = 500,

  // Custom AList/OpenList codes
  InvalidConfig = 1001,
  InvalidStorage = 1002,
  StorageNotReady = 1003,
  PathNotFound = 1004,
  AccountNotFound = 1005,
  TaskNotFound = 1006,
}

export class StorlaneError extends Error {
  constructor(
    public code: ErrorCode,
    public message: string,
    public originalError?: any,
  ) {
    super(message)
    this.name = "StorlaneError"
  }
}

export const Errs = {
  PathNotFound: new StorlaneError(ErrorCode.PathNotFound, "Path not found"),
  NotReady: new StorlaneError(ErrorCode.StorageNotReady, "Storage not ready"),
  InvalidConfig: new StorlaneError(
    ErrorCode.InvalidConfig,
    "Invalid configuration",
  ),
  Unauthorized: new StorlaneError(
    ErrorCode.Unauthorized,
    "Unauthorized access",
  ),
  Forbidden: new StorlaneError(ErrorCode.Forbidden, "Permission denied"),
}

/**
 * 错误信息脱敏：对外返回错误时避免暴露内部实现细节（路径、堆栈、驱动内部）。
 * 只保留错误类型/API 层信息，敏感内容替换为通用描述。
 */
export function safeErrorMessage(
  e: any,
  fallback = "Internal server error",
): string {
  if (!e) return fallback
  const raw = typeof e === "string" ? e : e?.message || String(e)
  if (!raw) return fallback
  const s = String(raw)
  // 截断超长信息（防止堆栈/大对象泄露）
  if (s.length > 200) return fallback
  // 屏蔽明显的绝对路径（Windows 与 POSIX）
  if (
    /[A-Za-z]:[\\/][^\\/\s]|[\\/][A-Za-z0-9_.-]+[\\/][A-Za-z0-9_.-]/.test(s) &&
    /\.(ts|js|mjs|cjs|json|toml|yml|yaml)/i.test(s)
  ) {
    return fallback
  }
  // 屏蔽堆栈特征
  if (/at .*\(|at [A-Za-z0-9_.-]+:[0-9]+:[0-9]+/.test(s)) {
    return fallback
  }
  return s
}
