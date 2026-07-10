export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-10 font-mono text-stone-900">
      <h1 className="mb-4 text-3xl font-bold">Lift Prog Privacy Policy</h1>
      <p className="mb-4 text-stone-700">Last updated July 2, 2026.</p>
      <p className="mb-4">
        Lift Prog stores your account email, workout history, exercise notes,
        body weight values you enter or import from Apple Health, and basic
        diagnostic error reports needed to run and improve the app.
      </p>
      <p className="mb-4">
        Health data is used only for workout logging features you enable, such
        as reading recent body weight or saving a completed strength-training
        workout to Apple Health. Lift Prog does not sell personal data.
      </p>
      <p className="mb-4">
        You can request support or account deletion from the app settings or by
        emailing <a className="underline" href="mailto:makon@hey.com">makon@hey.com</a>.
      </p>
    </main>
  );
}
