/** Floor servers take orders; cashiers/managers handle payments on any table. */
export function isFloorWaiter(hasPermission: (name: string) => boolean): boolean {
  return hasPermission("create_orders") && !hasPermission("accept_payments");
}
