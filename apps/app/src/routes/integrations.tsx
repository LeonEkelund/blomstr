import { HardDrive, Loader2 } from "lucide-react"
import { useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/components/layout/page-header"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useDriveConnection } from "@/hooks/use-drive"
import { useCurrentMember } from "@/hooks/use-members"

export function IntegrationsPage() {
  const { member } = useCurrentMember()
  const { connection, loading, connect, disconnect } = useDriveConnection()
  const [searchParams] = useSearchParams()
  const [confirming, setConfirming] = useState(false)
  const isOwner = member?.role === "owner"
  const result = searchParams.get("drive")
  const callbackMessage = searchParams.get("message")

  return (
    <>
      <PageHeader title="Integrations" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Connected apps</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep large files where your team already works.
            </p>
          </div>

          {result === "connected" && (
            <p className="mt-4 rounded-lg border bg-card px-3 py-2 text-sm">
              Google Drive connected.
            </p>
          )}
          {result === "error" && (
            <p className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {callbackMessage ?? "Could not connect Google Drive. Please try again."}
            </p>
          )}

          <section className="mt-6 rounded-xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <HardDrive className="size-5 text-muted-foreground" strokeWidth={1.5} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-medium">Google Drive</h3>
                  {connection && (
                    <Badge variant="secondary" className="font-normal">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Choose footage and large files from Drive without copying them into
                  Blomstr.
                </p>

                {loading ? (
                  <Skeleton className="mt-4 h-7 w-32" />
                ) : connection ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <p className="min-w-0 truncate text-sm">{connection.email}</p>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto text-muted-foreground"
                        onClick={() => setConfirming(true)}
                      >
                        Disconnect
                      </Button>
                    )}
                  </div>
                ) : isOwner ? (
                  <Button
                    size="sm"
                    className="mt-4"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate()}
                  >
                    {connect.isPending && <Loader2 className="animate-spin" />}
                    Connect Google Drive
                  </Button>
                ) : (
                  <p className="mt-4 text-xs text-muted-foreground">
                    Only the workspace owner can connect Google Drive.
                  </p>
                )}

                {(connect.error || disconnect.error) && (
                  <p className="mt-3 text-sm text-destructive">
                    {(connect.error ?? disconnect.error)?.message}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Google Drive?</AlertDialogTitle>
            <AlertDialogDescription>
              Existing file references stay visible, but no new files can be chosen until
              Drive is connected again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={disconnect.isPending}
              onClick={() =>
                disconnect.mutate(undefined, { onSuccess: () => setConfirming(false) })
              }
            >
              {disconnect.isPending && <Loader2 className="animate-spin" />}
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
