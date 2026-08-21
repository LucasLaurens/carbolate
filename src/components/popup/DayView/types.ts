import type { SobrietyColor } from "../../../carbon/sobriety";

/** The sobriety palette, plus the neutral hue only the panel's own stats wear. */
export type StatColor = SobrietyColor | "blue";

export type DomainData = { domain: string; totalCo2: number };
