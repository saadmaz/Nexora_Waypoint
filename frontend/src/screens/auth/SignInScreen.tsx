import { useEffect, useId, useRef, type FormEvent } from "react";
import { Button } from "../../shared/ui/Button";
import { Icon, type IconName } from "../../shared/ui/Icon";
import type { Role } from "../../domain/status";
import { ACCOUNTS } from "./AuthApi";
import { ROLE_LABEL, SIGN_IN_STRINGS as S } from "./signInStrings";
import type { Account } from "./types";
import styles from "./SignInScreen.module.css";

export type SignInLayout = "desktop" | "phone";

export type SignInScreenProps = {
  /** G1.1 is the desktop card; G1.2 to G1.5 are the phone layout. */
  layout: SignInLayout;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  /** A tap on a demo account row. */
  onPickAccount: (account: Account) => void;
  /** A request is in flight: the form is disabled and the button is busy, with no change of size. */
  busy?: boolean;
  /** The last attempt failed (G1.4). Names the problem under the password and keeps the email. */
  wrongPassword?: boolean;
  /** The device has no connection (G1.5). A new sign-in is blocked; nothing else changes. */
  offline?: boolean;
  /**
   * The device is online but the server did not answer (API mode only). Shows the same notice as G1.5, since no frame
   * draws another, but the button stays enabled: there is nothing to wait for, so the person can simply try again.
   */
  serverDown?: boolean;
  /** Which field takes focus on mount. The gallery uses it to draw the focus ring the frames show. */
  focusOnMount?: "email" | "password";
  /** Fill the viewport height. The gallery draws frames at their own size and turns this off. */
  fill?: boolean;
};

const ROLE_ICON: Record<Role, IconName> = {
  dispatcher: "calendar",
  loader: "package",
  driver: "truck",
  store: "store",
};

/**
 * Sign-in, the screen behind frames G1.1 to G1.5 (PRD v3 section 3). One component draws every
 * frame: the props pick the layout and the state. Nothing here knows how to authenticate;
 * `SignInRoute` owns the state and talks to the AuthApi.
 */
export function SignInScreen({
  layout,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onPickAccount,
  busy = false,
  wrongPassword = false,
  offline = false,
  serverDown = false,
  focusOnMount,
  fill = true,
}: SignInScreenProps) {
  const ids = { email: useId(), password: useId(), error: useId(), demo: useId() };
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const wasBusy = useRef(false);

  // Only on mount: a later change of this prop must not pull focus out of a field.
  useEffect(() => {
    if (focusOnMount) (focusOnMount === "password" ? passwordRef : emailRef).current?.focus();
  }, []); // oxlint-disable-line react-hooks/exhaustive-deps

  // After a failed attempt the form is enabled again: put the cursor back in the password.
  useEffect(() => {
    if (wasBusy.current && !busy && wrongPassword) passwordRef.current?.focus();
    wasBusy.current = busy;
  }, [busy, wrongPassword]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <main className={[styles.page, fill && styles.fill].filter(Boolean).join(" ")} data-layout={layout}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden>
            <span className={styles.diamond} />
          </span>
          <span className={styles.brandName}>{S.brand}</span>
        </div>

        <h1 className={styles.title}>{S.title}</h1>

        {(offline || serverDown) && (
          <div className={styles.notice} role="status">
            <span className={styles.noticeIcon}>
              <Icon name="wifi-off" size={20} />
            </span>
            <div className={styles.noticeText}>
              <p className={styles.noticeTitle}>{S.offlineTitle}</p>
              <p className={styles.noticeBody}>{S.offlineBody}</p>
            </div>
          </div>
        )}

        <form className={styles.form} onSubmit={submit} noValidate aria-busy={busy}>
          <fieldset className={styles.fields} disabled={busy}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.email}>
                {S.emailLabel}
              </label>
              <input
                ref={emailRef}
                id={ids.email}
                className={[styles.input, styles.emailInput].join(" ")}
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={S.emailPlaceholder}
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor={ids.password}>
                {S.passwordLabel}
              </label>
              <input
                ref={passwordRef}
                id={ids.password}
                className={styles.input}
                type="password"
                autoComplete="current-password"
                value={password}
                aria-invalid={wrongPassword || undefined}
                aria-describedby={wrongPassword ? ids.error : undefined}
                onChange={(event) => onPasswordChange(event.target.value)}
              />
              {wrongPassword && (
                <p id={ids.error} className={styles.error} role="alert">
                  <Icon name="alert-circle" size={14} />
                  {S.wrongPassword}
                </p>
              )}
            </div>

            <Button type="submit" size={layout === "desktop" ? "medium" : "large"} busy={busy} disabled={offline || busy}>
              {S.submit}
            </Button>
          </fieldset>
        </form>

        <hr className={styles.divider} />

        <section className={styles.demo} aria-labelledby={ids.demo}>
          <div className={styles.demoHead}>
            <h2 id={ids.demo} className={styles.demoHeading}>
              {S.demoHeading}
            </h2>
            <span className={styles.tag}>{S.demoTag}</span>
          </div>
          <ul className={styles.rows}>
            {ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button type="button" className={styles.row} disabled={busy} onClick={() => onPickAccount(account)}>
                  <span className={styles.rowIcon}>
                    <Icon name={ROLE_ICON[account.role]} size={20} />
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowName}>
                      {account.role === "loader" ? `${account.displayName} · ${ROLE_LABEL[account.role]}` : ROLE_LABEL[account.role]}
                    </span>
                    <span className={styles.rowEmail}>{account.email}</span>
                  </span>
                  <span className={styles.rowChevron}>
                    <Icon name="chevron-right" size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
