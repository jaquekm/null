import { LoginForm } from "./login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const nextValue = typeof next === "string" ? next : undefined;

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Entrar no Hub
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Use seu e-mail e senha.
        </p>
      </div>
      <LoginForm next={nextValue} />
    </div>
  );
}
