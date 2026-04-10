import HideBehindAuth from "@/components/auth/HideBehindAuth";
import { ROLES } from "@/constants/roles";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <HideBehindAuth
      callbackUrl="/admin"
      authorization={{
        roles: [ROLES.ADMIN],
      }}
    >
      {children}
    </HideBehindAuth>
  );
}


