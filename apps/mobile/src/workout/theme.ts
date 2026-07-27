export const palette = {
  canvas: "#fafaf8",
  ink: "#1d1d1b",
  muted: "#686863",
  tertiary: "#8b8b84",
  soft: "#f0f0ed",
  softStrong: "#e5e5e1",
  line: "#d5d5cf",
  raised: "#ffffff",
  active: "#30302d",
  disabled: "#b8b8b1",
  danger: "#a33131",
  complete: "#e6ece7",
  completeLine: "#455c49",
  timerProgress: "#4b98cc",
  scrim: "rgba(29, 29, 27, 0.54)",
};

export const monoFont = "Courier";

export const space = {
  hairline: 1,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  page: 20,
  section: 24,
  region: 32,
} as const;

export const radius = {
  control: 5,
  field: 7,
  surface: 8,
  dialog: 10,
  sheet: 14,
  pill: 999,
} as const;

export const controlSize = {
  compact: 30,
  field: 42,
  row: 44,
  primary: 48,
} as const;

export const typeScale = {
  caption: 13,
  metadata: 15,
  body: 16,
  row: 17,
  input: 18,
  primary: 20,
  section: 22,
  title: 28,
  screenTitle: 32,
} as const;

export const layout = {
  maxContentWidth: 430,
  pageGutter: space.page,
  listInset: space.lg,
  sheetInset: space.lg,
} as const;
