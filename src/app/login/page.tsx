import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react"; // Icon for VibeFlow

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { message: string };
}) {
   const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    return redirect("/");
  }


  const signIn = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return redirect(`/login?message=Could not authenticate user: ${error.message}`);
    }

    return redirect("/");
  };

  const signUp = async (formData: FormData) => {
    "use server";

    const origin = headers().get("origin");
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });

    if (error) {
       // Check if error is due to email rate limit
      if (error.message.includes("Email rate limit exceeded")) {
         return redirect("/login?message=Sign up limit reached. Please try again later.");
      }
      // Check if user already exists
      if (error.message.includes("User already registered")) {
        return redirect("/login?message=User already exists. Please try signing in.");
      }
      return redirect(`/login?message=Could not sign up user: ${error.message}`);
    }

    // Redirect to a confirmation page or show a message
    return redirect("/login?message=Check email to continue sign in process");
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background relative overflow-hidden">
       {/* Animated Gradient Glow */}
       <div className="absolute inset-0 z-0 gradient-glow"></div>

      <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center">
           <div className="flex justify-center items-center mb-4">
             <Zap className="h-8 w-8 text-primary" />
           </div>
          <CardTitle className="text-2xl font-bold text-gradient">VibeFlow</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email below to login or sign up
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
                className="bg-input/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required className="bg-input/50 border-border/50"/>
            </div>
             {searchParams?.message && (
              <p className="mt-4 p-4 bg-destructive/20 text-destructive-foreground border border-destructive rounded-md text-center text-sm">
                {searchParams.message}
              </p>
            )}
            <SubmitButton
              formAction={signIn}
              className="w-full"
              pendingText="Signing In..."
            >
              Sign In
            </SubmitButton>
            <SubmitButton
              formAction={signUp}
              variant="outline"
              className="w-full border-primary/50 text-primary hover:bg-primary/10 hover:text-primary"
              pendingText="Signing Up..."
            >
              Sign Up
            </SubmitButton>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
