"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { loginAction, type LoginActionState } from "@/app/login/actions";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Geçerli bir e-posta girin."),
  password: z.string().min(1, "Şifre gereklidir."),
});

type LoginValues = z.infer<typeof loginSchema>;

const initialLoginState: LoginActionState = {};

const fieldClass =
  "h-11 rounded-xl border-border/80 bg-background/80 pl-10 text-base shadow-sm transition-[box-shadow,border-color] placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/25 md:text-sm";

export function LoginForm() {
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    const fd = new FormData();
    fd.append("email", values.email);
    fd.append("password", values.password);
    const result = await loginAction(initialLoginState, fd);
    if (result?.error) {
      form.setError("root", { message: result.error });
    }
  }

  return (
    <div className="w-full max-w-[420px]">
      <div
        className={cn(
          "rounded-[1.35rem] border border-border/60 bg-card/80 p-6 shadow-[0_24px_48px_-12px_rgba(15,23,42,0.12)] backdrop-blur-sm",
          "dark:border-border/50 dark:bg-card/70 dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.45)]"
        )}
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md ring-4 ring-primary/10">
            <GraduationCap className="size-8" strokeWidth={1.75} aria-hidden />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Ders Takip
          </h1>
          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-muted-foreground">
            Hesabınıza giriş yaparak görev ve ilerlemenizi görüntüleyin.
          </p>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">
                    E-posta
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="ad@ornek.com"
                        className={fieldClass}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel className="text-sm font-medium">Şifre</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className={fieldClass}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {form.formState.errors.root?.message && (
              <div
                className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive dark:bg-destructive/15"
                role="alert"
              >
                {form.formState.errors.root.message}
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              className="h-11 w-full rounded-xl text-base font-semibold shadow-sm"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  Giriş yapılıyor…
                </>
              ) : (
                "Giriş yap"
              )}
            </Button>
          </form>
        </Form>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          Öğrenci veya öğretmen hesabınızla giriş yapabilirsiniz.
        </p>
      </div>
    </div>
  );
}
