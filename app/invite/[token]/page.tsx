"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth, SignInButton } from "@clerk/nextjs";
import { setActiveWorkspaceAction } from "@/lib/actions";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { isLoaded, userId } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const { token } = use(params);

  const handleAccept = async () => {
    setIsAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      await setActiveWorkspaceAction(data.workspaceId);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsAccepting(false);
    }
  };

  if (!isLoaded) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-md p-6 bg-[var(--panel)] border border-[var(--border)] rounded-xl shadow-lg">
        <h1 className="text-xl font-semibold mb-4">Accept Invitation</h1>
        
        {!userId ? (
          <div>
            <p className="text-[var(--muted)] mb-6">
              You must be signed in to accept this invitation.
            </p>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-[var(--accent)] text-[var(--bg)] font-medium rounded hover:bg-[var(--accent-hover)] transition w-full">
                Sign In
              </button>
            </SignInButton>
          </div>
        ) : (
          <div>
            {error && (
              <div className="mb-4 p-3 rounded bg-red-500/10 border border-red-500/50 text-red-500 text-sm">
                {error}
              </div>
            )}
            <p className="text-[var(--text)] mb-6">
              You have been invited to join a workspace.
            </p>
            <button
              onClick={handleAccept}
              disabled={isAccepting}
              className="px-4 py-2 bg-[var(--accent)] text-[var(--bg)] font-medium rounded hover:bg-[var(--accent-hover)] transition w-full disabled:opacity-50"
            >
              {isAccepting ? "Accepting..." : "Accept Invitation"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
