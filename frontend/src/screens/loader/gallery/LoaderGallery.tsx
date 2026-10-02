import { RoleRoot } from "../../../shared/RoleRoot";
import { LOADER_FRAMES } from "./frames";
import { StateGallery } from "../../../field/gallery/StateGallery";

export function LoaderGallery() {
  const frameId = new URLSearchParams(window.location.search).get("frame");
  return (
    <StateGallery
      title="Waypoint Load"
      frames={LOADER_FRAMES}
      frameId={frameId}
      wrap={(children) => (
        <RoleRoot theme="dark" fill={false}>
          {children}
        </RoleRoot>
      )}
    />
  );
}
