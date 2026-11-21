"use client";
import { useRouter } from "next/navigation";
import { ResetPasswordModal } from "@/components/auth/reset-password-modal";

export function RecoveryForm() {
  const router = useRouter();
  return (
    <ResetPasswordModal
      onClose={() => router.replace("/?auth=login")}
      onSuccess={() =>
        router.replace(
          "/?auth=login&message=" +
            encodeURIComponent("Password updated successfully. Please sign in with your new password.")
        )
      }
    />
  );
}
