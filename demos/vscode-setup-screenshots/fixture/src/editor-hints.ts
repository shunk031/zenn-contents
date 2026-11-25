function formatLabel(value: string, suffix: string): string {
  return value + suffix;
}

const label = formatLabel(greeting, "!");
label;
