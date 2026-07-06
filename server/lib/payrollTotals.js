/** Parse incentives_breakdown JSON array and sum manual line amounts. */
export function sumIncentivesBreakdown(breakdown) {
  if (!breakdown) return 0;
  try {
    const b = typeof breakdown === "string" ? JSON.parse(breakdown) : breakdown;
    return Array.isArray(b) ? b.reduce((s, x) => s + Number(x.amount || 0), 0) : 0;
  } catch {
    return 0;
  }
}

/** Gross = allowance + commission + incentives + manual breakdown + adjustments. */
export function computePayslipGross(row) {
  const allowance = Number(row.allowance ?? 0);
  const commission = Number(row.commission ?? 0);
  const incentives = Number(row.incentives ?? 0);
  const adjustments = Number(row.adjustments ?? 0);
  const breakdownSum = sumIncentivesBreakdown(row.incentives_breakdown ?? row.incentivesBreakdown);
  return allowance + commission + incentives + breakdownSum + adjustments;
}

export function computePayslipNet(row) {
  return computePayslipGross(row) - Number(row.deductions ?? 0);
}
