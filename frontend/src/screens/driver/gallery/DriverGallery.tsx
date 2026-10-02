import { DRIVER_FRAMES } from "./frames";
import { StateGallery } from "../../../field/gallery/StateGallery";

/** Each frame wraps itself in its own theme and settings (`renderFrame.tsx`), since R1.9, R1.10 and
 * the Field · sunlight states each need a different one on the same page. */
export function DriverGallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");
  return <StateGallery title="Driver" frames={DRIVER_FRAMES} frameId={frameId} />;
}
