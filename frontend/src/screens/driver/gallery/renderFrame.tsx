import type { ReactNode } from "react";
import { RoleRoot, type Theme } from "../../../shared/RoleRoot";
import { DriverProvider } from "../context/DriverProvider";
import type { MockDriverApiOptions } from "../api/mockDriverApi";
import type { DriverSettings } from "../types";

/**
 * Wraps one state-gallery frame in its own theme and settings, independent of every other frame
 * on the page (field conventions section 10). Runs inside the frame's own fixed `ClockProvider`,
 * set up by `StateGallery`.
 */
export function renderDriverFrame(
  node: ReactNode,
  options: { theme?: Theme; settings?: Partial<DriverSettings>; apiOptions?: MockDriverApiOptions } = {},
): ReactNode {
  const { theme = "dark", settings, apiOptions } = options;
  return (
    <RoleRoot theme={theme} fill={false}>
      <DriverProvider initialSettings={settings ?? {}} apiOptions={apiOptions}>
        {node}
      </DriverProvider>
    </RoleRoot>
  );
}
