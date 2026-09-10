import { Reveal } from "@/components/reveal"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SECTIONS } from "@/lib/config"

/*
  Collaboration, explained through the workflow rather than a permission
  matrix.

  These are the product's four actual workspace roles. The brief sketched a
  creator / editor / designer / guest line-up, but designer and creator are
  not roles Blomstr has, and inviting people to a role that does not exist is
  the same problem as inventing a feature.
*/
const ROLES = [
  {
    name: "Owner",
    person: "Maya Lund",
    responsibility: "Runs the workspace and has the final say on what ships.",
  },
  {
    name: "Admin",
    person: "Ola Nyberg",
    responsibility: "Approves versions and requests changes alongside the owner.",
  },
  {
    name: "Editor",
    person: "Ines Roth",
    responsibility: "Creates the work, uploads versions and answers feedback.",
  },
  {
    name: "Guest",
    person: "Tomas Berg",
    responsibility: "Invited to a single project, and sees only that project.",
  },
]

export function Collaboration() {
  return (
    <section
      id={SECTIONS.collaboration}
      className="glass-section relative z-10 py-20 sm:py-28"
    >
      <div className="shell">
        <div className="grid gap-12 md:grid-cols-12">
          <Reveal className="md:col-span-5">
            <h2 className="display text-[clamp(2rem,4.4vw,3rem)]">
              Everyone sees what they need. Nothing gets lost.
            </h2>
            <p className="mt-5 max-w-sm leading-relaxed text-muted-foreground">
              Owners, admins, editors and guests can work around the same project while
              comments, decisions and activity remain in context.
            </p>
          </Reveal>

          <div className="md:col-span-6 md:col-start-7">
            <ul className="divide-y divide-border">
              {ROLES.map((role, index) => (
                <Reveal
                  as="li"
                  key={role.name}
                  delay={index * 0.06}
                  className="py-5 first:pt-0 last:pb-0"
                >
                  <div className="flex items-start gap-4">
                    <Avatar name={role.person} className="mt-0.5 size-8 ring-0" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[0.9375rem] font-medium">
                          {role.person}
                        </span>
                        <Badge variant="outline" className="font-normal">
                          {role.name}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {role.responsibility}
                      </p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
