import type { ReactNode } from "react";
import type { Theme } from "../../../shared/RoleRoot";
import { SignInScreen, type SignInLayout, type SignInScreenProps } from "../SignInScreen";

/**
 * One Figma frame of the app shell, as a state of a screen (field conventions section 3). The
 * `render` function draws the real screen with fixed props; the registry never holds a copy of a
 * frame's markup. Frames are drawn in the theme Figma shows, which is not always the theme the
 * live page picks: the live sign-in is Dark at phone width, while G1.2 and G1.4 are drawn Light.
 */
export type AuthFrame = {
  /** The id used in `?frame=` and in compare file names, for example "G1.4". */
  frameId: string;
  /** The Figma node ID, shown under the label. */
  figmaNodeId: string;
  /** The frame name as Figma has it. */
  name: string;
  width: number;
  height: number;
  theme: Theme;
  render: () => ReactNode;
};

const noop = () => undefined;

function signIn(layout: SignInLayout, props: Partial<SignInScreenProps> = {}): ReactNode {
  return (
    <SignInScreen
      layout={layout}
      email=""
      password=""
      onEmailChange={noop}
      onPasswordChange={noop}
      onSubmit={noop}
      onPickAccount={noop}
      fill={false}
      {...props}
    />
  );
}

export const AUTH_FRAMES: AuthFrame[] = [
  {
    frameId: "G1.1",
    figmaNodeId: "442:67261",
    name: "G1.1 Sign-in, desktop",
    width: 1440,
    height: 900,
    theme: "light",
    render: () => signIn("desktop", { focusOnMount: "password" }),
  },
  {
    frameId: "G1.2",
    figmaNodeId: "442:67336",
    name: "G1.2 Sign-in, phone (Light)",
    width: 390,
    height: 844,
    theme: "light",
    render: () => signIn("phone", { focusOnMount: "password" }),
  },
  {
    frameId: "G1.3",
    figmaNodeId: "442:67411",
    name: "G1.3 Sign-in, phone (Dark · pre-dawn)",
    width: 390,
    height: 844,
    theme: "dark",
    render: () => signIn("phone", { focusOnMount: "password" }),
  },
  {
    frameId: "G1.4",
    figmaNodeId: "442:67486",
    name: "G1.4 Sign-in, wrong password",
    width: 390,
    height: 844,
    theme: "light",
    render: () => signIn("phone", { email: "driver@waypoint.demo", password: "wrongpwd", wrongPassword: true }),
  },
  {
    frameId: "G1.5",
    figmaNodeId: "442:67568",
    name: "G1.5 Sign-in, offline",
    width: 390,
    height: 844,
    theme: "dark",
    render: () => signIn("phone", { offline: true }),
  },
];
