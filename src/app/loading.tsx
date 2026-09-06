export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Cargando"
      className="min-h-screen bg-[#f6f7f3] p-5 text-[#20231f]"
    >
      <div className="mx-auto grid w-full max-w-6xl gap-4">
        <div className="h-9 w-56 animate-pulse rounded-lg bg-[#e6eae1]" />
        <div className="grid gap-3 md:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-24 animate-pulse rounded-lg border border-[#e2e6df] bg-white"
              key={item}
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-lg border border-[#e2e6df] bg-white" />
      </div>
    </main>
  );
}
