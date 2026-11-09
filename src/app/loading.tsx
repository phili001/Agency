export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Cargando"
      className="min-h-screen bg-paper-2 p-5 text-ink"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-line" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-24 animate-pulse rounded-lg border border-line bg-white"
              key={item}
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-lg border border-line bg-white" />
      </div>
    </main>
  );
}
