import { RoleRoot } from "../../shared/RoleRoot";
import styles from "./ShellPlaceholder.module.css";

/**
 * A route of the app shell with no screen yet. The router lands first so the shared file
 * changes once; each phase of the shell replaces one of these with its screen.
 */
export function ShellPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <RoleRoot theme="light">
      <main className={styles.screen}>
        <h1 className={styles.heading}>{title}</h1>
        <p className={styles.note}>{note}</p>
      </main>
    </RoleRoot>
  );
}
