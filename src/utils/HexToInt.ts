export function HexToInt(hex: string): number {
  const str = hex.replace(/^#/, '');
  return parseInt(str, 16);
}

export function RoundNumber(number: number, percision: number): number {
  return parseFloat(number.toFixed(percision));
}
