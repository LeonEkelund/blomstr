import { PageHeader } from "@/components/layout/page-header"

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Nothing here yet.
      </div>
    </>
  )
}
