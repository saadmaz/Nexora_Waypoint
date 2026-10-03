/** "in 3 h 45 min", "in 56 min": a departure countdown (L1 vehicle cards). Never negative; callers clamp. */
export function formatCountdown(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  const h = Math.floor(whole / 60);
  const m = whole % 60;
  return h > 0 ? `in ${h} h ${m} min` : `in ${m} min`;
}

/** "1st", "2nd", "3rd", "4th", "11th": the load position on L2 ("Load 1st · Stop 2"). */
export function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
