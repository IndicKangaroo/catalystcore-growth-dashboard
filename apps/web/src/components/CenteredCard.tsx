import type { ReactNode } from 'react';
import { Card } from './Card';

/** A card in the middle of an empty page: sign-in, loading, and the "something went wrong" states. */
export function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <Card className="w-full max-w-md p-6">
        <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
        <div className="mt-3 flex flex-col gap-4">{children}</div>
      </Card>
    </main>
  );
}
