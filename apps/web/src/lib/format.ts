const moneyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number) {
  return moneyFormatter.format(cents / 100);
}
