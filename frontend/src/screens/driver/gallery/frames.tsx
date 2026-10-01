import type { GalleryFrame } from "../../../field/gallery/StateGallery";
import { MeScreen } from "../me/MeScreen";
import { renderDriverFrame } from "./renderFrame";

/**
 * Every Driver frame (`/driver/_states`), registered as its screens land (field conventions
 * section 10, driver prompt 3 section 9). `?frame=ID` renders one at its Figma size.
 */
export const DRIVER_FRAMES: GalleryFrame[] = [
  {
    frameId: "R1.9",
    figmaNodeId: "442:56149",
    name: "R1.9 · Me tab, sunlight screen toggle",
    width: 390,
    height: 844,
    clock: { date: "2026-09-29", time: "05:10" },
    render: () => renderDriverFrame(<MeScreen storageOverride="3.2 MB used" />, { theme: "dark" }),
  },
];
