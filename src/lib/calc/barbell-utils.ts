export const AVAILABLE_PLATES = [45, 35, 25, 10, 5, 2.5];

export const BAR_WEIGHT = 45;

export const getAllPossibleWeights = (): number[] => {
  const weights = new Set<number>();
  const generate = (index: number, weightPerSide: number) => {
    if (index >= AVAILABLE_PLATES.length) {
      const total = Math.round((BAR_WEIGHT + weightPerSide * 2) * 100) / 100;
      weights.add(total);
      return;
    }
    const plate = AVAILABLE_PLATES[index]!;
    for (let count = 0; count <= 10; count++) {
      generate(index + 1, weightPerSide + count * plate);
    }
  };
  generate(0, 0);
  return Array.from(weights).sort((a, b) => a - b);
};

export const getNextValidWeight = (
  current: number,
  direction: "up" | "down",
): number => {
  const possible = getAllPossibleWeights();
  if (direction === "up") {
    return possible.find((w) => w > current) ?? current;
  }
  for (let i = possible.length - 1; i >= 0; i--) {
    const w = possible[i];
    if (w !== undefined && w < current) return w;
  }
  return current;
};

export const getClosestValidWeight = (target: number): number => {
  const possible = getAllPossibleWeights();
  return possible.reduce((prev, curr) =>
    Math.abs(curr - target) < Math.abs(prev - target) ? curr : prev,
  );
};
