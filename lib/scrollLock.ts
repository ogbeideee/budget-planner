let lockCount = 0;

export function lockBodyScroll(): void {
  if (typeof document === "undefined") return;
  lockCount += 1;
  document.body.style.overflow = "hidden";
}

export function unlockBodyScroll(): void {
  if (typeof document === "undefined") return;
  if (lockCount > 0) lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = "";
  }
}