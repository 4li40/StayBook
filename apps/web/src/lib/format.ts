const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

const stayDateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const stayDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "numeric",
});

export function formatCents(cents: number) {
  return moneyFormatter.format(cents / 100);
}

export function formatStayDate(value: string) {
  return stayDateFormatter.format(new Date(`${value}T00:00:00`));
}

export function formatTimestamp(value: string) {
  return stayDateFormatter.format(new Date(value));
}

export function formatStayDateTime(value: string) {
  return stayDateTimeFormatter.format(new Date(value));
}
