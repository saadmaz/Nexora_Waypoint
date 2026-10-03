import type { ReactNode } from "react";
import type { Role } from "../../domain/status";
import { ProfileMenu } from "../../shared/chrome/ProfileMenu";
import { Button } from "../../shared/ui/Button";
import { ROLE_LABEL, accountName } from "./accountName";
import { useLogOut } from "./useLogOut";

/** The profile circle for a web app bar, with Log out last. `children` are the role's own items. */
export function AccountMenu({ role, children }: { role: Role; children?: ReactNode }) {
  const { requestLogOut, dialog } = useLogOut(role);
  return (
    <>
      <ProfileMenu name={accountName(role)} roleLabel={ROLE_LABEL[role]} onLogOut={requestLogOut}>
        {children}
      </ProfileMenu>
      {dialog}
    </>
  );
}

/** The Log out button on a phone's Me tab. */
export function LogOutButton({ role, label = "Log out" }: { role: Role; label?: string }) {
  const { requestLogOut, dialog } = useLogOut(role);
  return (
    <>
      <Button variant="dangerOutline" icon="log-out" onClick={requestLogOut}>
        {label}
      </Button>
      {dialog}
    </>
  );
}
