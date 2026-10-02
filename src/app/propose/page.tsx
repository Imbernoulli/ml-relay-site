import Link from "next/link";

export const metadata = { title: "ML-Relay · Propose a new task" };

/** Old links land on the form itself. */
export default function ProposeRedirect() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <meta httpEquiv="refresh" content="0;url=new/" />
      <p className="text-sm">
        Opening the proposal form…{" "}
        <Link href="/propose/new/" className="underline">
          Continue
        </Link>
      </p>
    </div>
  );
}
