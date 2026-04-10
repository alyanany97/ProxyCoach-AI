export default function UnauthorizedPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-2 px-6">
      <h1 className="text-2xl font-semibold">Not authorized</h1>
      <p className="text-sm text-muted-foreground">
        You are signed in, but you don&apos;t have access to this page.
      </p>
    </main>
  );
}


