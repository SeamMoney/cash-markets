// cashoutStore.ts
let cashoutMultiplier: number | null = null;

export const setCashoutMultiplier = (value: number) => {
  cashoutMultiplier = value;
};

export const getCashoutMultiplier = () => cashoutMultiplier;
