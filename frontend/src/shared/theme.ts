import { createContext, useContext } from "react";

/** The three colour modes of the Figma collection "Waypoint colour" (field conventions section 6). */
export type Theme = "light" | "dark" | "field";

/**
 * The theme of the nearest RoleRoot. Radix portals render outside the role's root element, so a
 * sheet or dialog reads this and sets `data-theme` on itself; otherwise it would fall back to Light.
 */
export const ThemeContext = createContext<Theme>("light");

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
