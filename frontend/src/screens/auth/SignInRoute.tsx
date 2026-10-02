import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RoleRoot } from "../../shared/RoleRoot";
import { DEMO_PASSWORD, ROLE_HOME } from "./AuthApi";
import { getAuthApi } from "./authClient";
import { SignInScreen, type SignInLayout } from "./SignInScreen";
import type { Account } from "./types";
import { useIsPhone } from "./useIsPhone";
import { useSignInConnectivity } from "./useSignInConnectivity";

/**
 * `/sign-in` (PRD v3 section 3, frames G1.1 to G1.5). Theme follows the working environment, not
 * the role (PRD v3 section 6): Light · office on a desktop, Dark · pre-dawn at phone width, where
 * a sign-in at the dock or in a cab happens before dawn.
 */
export function SignInRoute() {
  const phone = useIsPhone();
  return (
    <RoleRoot theme={phone ? "dark" : "light"}>
      <SignInForm layout={phone ? "phone" : "desktop"} />
    </RoleRoot>
  );
}

function SignInForm({ layout }: { layout: SignInLayout }) {
  const navigate = useNavigate();
  const api = useMemo(() => getAuthApi(), []);
  const connected = useSignInConnectivity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [wrongPassword, setWrongPassword] = useState(false);
  // The server did not answer. The existing offline notice covers it (no frame draws another), the button stays enabled to retry.
  const [unreachable, setUnreachable] = useState(false);

  async function attempt(emailValue: string, passwordValue: string) {
    // Offline blocks a new sign-in only. Nothing is cleared, so the person loses nothing.
    if (busy || !connected) return;
    setWrongPassword(false);
    setUnreachable(false);
    if (!emailValue.trim() || !passwordValue) {
      setWrongPassword(true);
      return;
    }
    setBusy(true);
    const result = await api.signIn(emailValue, passwordValue);
    setBusy(false);
    if (result.ok) {
      navigate(ROLE_HOME[result.session.role], { replace: true });
    } else if (result.reason === "invalid_credentials") {
      // The email stays; the password is cleared and the screen puts focus back on it.
      setPassword("");
      setWrongPassword(true);
    } else if (result.reason === "unavailable") {
      setUnreachable(true);
    }
    // "offline": the notice is already showing, driven by the connectivity store.
  }

  function pickAccount(account: Account) {
    setEmail(account.email);
    setPassword(DEMO_PASSWORD);
    void attempt(account.email, DEMO_PASSWORD);
  }

  return (
    <SignInScreen
      layout={layout}
      email={email}
      password={password}
      onEmailChange={(value) => {
        setUnreachable(false);
        setEmail(value);
      }}
      onPasswordChange={(value) => {
        setUnreachable(false);
        setPassword(value);
      }}
      onSubmit={() => void attempt(email, password)}
      onPickAccount={pickAccount}
      busy={busy}
      wrongPassword={wrongPassword}
      offline={!connected}
      serverDown={unreachable}
      focusOnMount={layout === "desktop" ? "email" : undefined}
    />
  );
}
