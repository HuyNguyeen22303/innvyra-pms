import { Grid } from "antd";

/** Ant Design's md/xl thresholds are shared by both application shells and content. */
export function useResponsiveLayout() {
  const screens = Grid.useBreakpoint();
  return { screens, isMobile: !screens.md, isCompact: !screens.xl };
}
