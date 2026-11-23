export const minimumPasswordLength = 6;
export function passwordError(password: string, confirm: string): string {
  if ([...password].length < minimumPasswordLength)
    return "Use at least 6 characters. Letters, numbers or symbols are allowed; a mixture is not required.";
  if (password !== confirm) return "Passwords do not match.";
  return "";
}
export function isPasswordRoute(path: string) {
  return [
    "/setup-password",
    "/reset-password",
    "/change-password",
    "/forgot-password",
  ].includes(path);
}

export function passwordMode(
  path: string,
  required: boolean,
  hasSession: boolean,
  recovery: boolean,
): "setup" | "reset" | "change" | "forgot" {
  if (required) return "setup";
  if (path === "/forgot-password") return "forgot";
  if (path === "/change-password") return "change";
  if (hasSession && !recovery) return "change";
  return path === "/setup-password" ? "setup" : "reset";
}
