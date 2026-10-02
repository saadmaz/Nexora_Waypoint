import { ShellPlaceholder } from "./ShellPlaceholder";

/** `/auth/_states`: the dev-only state gallery for the app shell. Every frame joins it as it is built. */
export function AuthGallery() {
  return <ShellPlaceholder title="App shell states" note="No frames are registered yet. Each sign-in and role picker frame is added as it is built." />;
}
