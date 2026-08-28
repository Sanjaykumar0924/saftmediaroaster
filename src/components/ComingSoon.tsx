import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Info } from "lucide-react";

export function ComingSoon({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Info className="h-6 w-6" /></div>
          <div className="text-lg font-semibold text-foreground">Coming next</div>
          <p className="max-w-md text-sm">
            {children ?? "This section is scaffolded. The full UI will be built in a follow-up turn."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
