import { useNavigate } from "react-router-dom";
import type { Role } from "../../domain/status";
import { RoleRoot } from "../../shared/RoleRoot";
import { Icon, type IconName } from "../../shared/ui/Icon";
import { ACCOUNTS, ROLE_HOME } from "./AuthApi";
import { ROLE_LABEL } from "./accountName";
import { readAllSessions } from "./session";
import styles from "./StartRoute.module.css";

/** What each role's card opens (PRD v3 section 3b: G2.1 opens D1, G2.2 L1, G2.3 R1, G2.4 S1). */
const OPENS: Record<Role, { screen: string; icon: IconName }> = {
  dispatcher: { screen: "Order queue", icon: "clipboard-list" },
  loader: { screen: "Dock", icon: "package" },
  driver: { screen: "Today's run", icon: "truck" },
  store: { screen: "Orders", icon: "store" },
};

/**
 * `/start`: the role picker, frames G2.1 to G2.4 (PRD v3 section 3b). One card per role, saying whether this browser is
 * signed in to it. A signed-in card opens that role's home; a signed-out one goes to sign-in. One browser can hold all
 * four roles at once (per-role sessions), which is how a judge moves between them without signing out.
 */
export function StartRoute() {
  const navigate = useNavigate();
  const sessions = readAllSessions();

  return (
    <RoleRoot theme="light">
      <main className={styles.screen}>
        <header className={styles.header}>
          <h1 className={styles.heading}>Waypoint</h1>
          <p className={styles.note}>Choose a role. Each one keeps its own sign-in on this browser.</p>
        </header>
        <ul className={styles.cards}>
          {ACCOUNTS.map((account) => {
            const session = sessions[account.role];
            const opens = OPENS[account.role];
            return (
              <li key={account.role}>
                <button
                  type="button"
                  className={styles.card}
                  onClick={() => navigate(session ? ROLE_HOME[account.role] : "/sign-in")}
                  aria-label={`${account.appName}, ${session ? `signed in as ${session.displayName}, opens ${opens.screen}` : "signed out, sign in"}`}
                >
                  <span className={styles.icon}>
                    <Icon name={opens.icon} size={24} />
                  </span>
                  <span className={styles.body}>
                    <span className={styles.app}>{account.appName}</span>
                    <span className={styles.who}>
                      {session ? `${session.displayName} · ${ROLE_LABEL[account.role]}` : account.role === "loader" ? `${account.displayName} · ${ROLE_LABEL[account.role]}` : ROLE_LABEL[account.role]}
                    </span>
                    <span className={styles.state}>
                      {session ? (
                        <>
                          <span className={[styles.dot, styles.dotOn].join(" ")} aria-hidden />
                          Signed in · opens {opens.screen}
                        </>
                      ) : (
                        <>
                          <span className={styles.dot} aria-hidden />
                          Signed out · sign in
                        </>
                      )}
                    </span>
                  </span>
                  <Icon name="chevron-right" size={20} />
                </button>
              </li>
            );
          })}
        </ul>
        <button type="button" className={styles.link} onClick={() => navigate("/sign-in")}>
          Sign in to another role
        </button>
      </main>
    </RoleRoot>
  );
}
