/** Mientras carga una seccion: el sidebar del layout sigue en pantalla. */
export default function PanelLoading() {
  return (
    <div aria-busy="true" aria-label="Cargando">
      <div className="border-b border-line bg-white px-5 py-4">
        <div className="h-3 w-24 animate-pulse rounded bg-line" />
        <div className="mt-2 h-7 w-56 animate-pulse rounded-lg bg-line" />
      </div>
      <div className="grid gap-4 p-5">
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
    </div>
  );
}
