export default function Loading() {
  return (
    <main className="min-h-dvh bg-[#f2f7f4] px-5 py-8" aria-busy="true" aria-label="Loading page">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-12 w-44 rounded-xl bg-[#d8e9e4]" />
        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="h-4 w-36 rounded bg-[#c8dfd9]" />
            <div className="mt-5 h-14 w-full max-w-lg rounded-xl bg-[#d8e9e4]" />
            <div className="mt-3 h-14 w-4/5 rounded-xl bg-[#d8e9e4]" />
            <div className="mt-8 h-16 w-full max-w-md rounded-2xl bg-[#b8dcd3]" />
          </div>
          <div className="aspect-[4/3] rounded-3xl bg-[#d8e9e4]" />
        </div>
      </div>
      <span className="sr-only">BP Passport is loading.</span>
    </main>
  );
}
