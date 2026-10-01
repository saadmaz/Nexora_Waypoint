import { RoleRoot } from "../../../shared/RoleRoot";
import { DRIVER_FRAMES } from "./frames";
import { StateGallery } from "../../../field/gallery/StateGallery";

export function DriverGallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");
  return (
    <StateGallery
      title="Driver"
      frames={DRIVER_FRAMES}
      frameId={frameId}
      wrap={(children) => (
        <RoleRoot theme="dark" fill={false}>
          {children}
        </RoleRoot>
      )}
    />
  );
}
