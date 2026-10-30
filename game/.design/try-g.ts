export const G = (kind: string, seq: string, cost?: number) => ({ kind, seq: seq.split(" "), ...(cost ? { cost } : {}) });
export const O = (item: string, n = 1, extra: { after?: number; reward?: string } = {}) => ({ item, n, ...extra });
