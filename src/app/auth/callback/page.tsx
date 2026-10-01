import Callback from "./Callback";

export const metadata = { title: "ML-Relay · Signing in", robots: { index: false, follow: false } };

export default function CallbackPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
      <Callback />
    </div>
  );
}
