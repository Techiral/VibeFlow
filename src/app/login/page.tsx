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
  // Check environment variables FIRST
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("Supabase URL or Anon Key is missing. Environment variables might not be configured properly.");
    // Return an error state directly instead of relying on redirect after potential error
    return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Configuration Error</CardTitle>
                    <CardDescription>
                        The application is missing necessary configuration (Supabase URL or Key). Please contact the administrator.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
  }


   let supabase;
   try {
     supabase = createClient();
   } catch (error: any) {
     console.error("Error creating Supabase client:", error.message);
      // Redirect or handle error appropriately
      // Using redirect here might still cause issues if client creation fails partially.
      // Displaying an error is generally safer.
      return (
        <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
            <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                <CardHeader>
                    <CardTitle>Connection Error</CardTitle>
                    <CardDescription>
                        Could not connect to the database. Please contact the administrator. Error: {error.message}
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
      );
   }


  const signIn = async (formData: FormData) => {
    "use server";

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = createClient(); // Safe to call here due to checks above

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
    const supabase = createClient(); // Safe to call here due to checks above

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

  // Check user session *after* confirming Supabase client is created
  let user = null;
  try {
      const { data } = await supabase.auth.getUser();
      user = data.user;
  } catch (error: any) { // Catch potential errors from getUser itself
      console.error("Error fetching Supabase user:", error.message);
      // Display error or redirect with a specific message
       return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
             <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                 <CardHeader>
                     <CardTitle>Authentication Error</CardTitle>
                     <CardDescription>
                         Could not verify user session. Please try again later or contact support. Error: {error.message}
                     </CardDescription>
                 </CardHeader>
             </Card>
         </div>
       );
  }

  if (user) {
    return redirect("/");
  }


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
