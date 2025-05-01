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
   let supabase;
   let initialError: Error | null = null;
   let user = null;

   try {
     supabase = createClient(); // Attempt to create client first

     // Check user session *after* confirming Supabase client is created
      const { data } = await supabase.auth.getUser();
      user = data.user;

   } catch (error: any) { // Catch potential errors from client creation or getUser
     console.error("Error during Supabase initialization or user check:", error.message);
     initialError = error;
     // Don't try to use supabase client further if creation failed
   }

   // If client creation failed, show an error and disable login/signup
   if (initialError) {
      let errorMessage = "Could not connect to the authentication service.";
       if (initialError.message.includes("URL and Key are required")) {
          errorMessage = "Authentication service configuration error: Supabase URL or Key is missing. Please contact the administrator.";
       } else {
           errorMessage = `An unexpected error occurred: ${initialError.message}`;
       }
       return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background relative overflow-hidden p-4">
             <div className="absolute inset-0 z-0 gradient-glow"></div>
             <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                 <CardHeader className="space-y-1 text-center">
                     <div className="flex justify-center items-center mb-4">
                         <Zap className="h-8 w-8 text-primary" />
                     </div>
                     <CardTitle className="text-2xl font-bold text-gradient">VibeFlow</CardTitle>
                     <CardDescription className="text-destructive-foreground font-semibold pt-2">
                         {errorMessage}
                     </CardDescription>
                 </CardHeader>
                 {/* Optionally show disabled form elements or just the message */}
             </Card>
         </div>
       );
   }


  // If user is already logged in (and client creation succeeded), redirect
  if (user) {
    return redirect("/");
  }


  // --- Server Actions ---
  // These should ideally also check if supabase client is available,
  // but createClient() will throw if called when vars are missing.

  const signIn = async (formData: FormData) => {
    "use server";

    let supabaseActionClient;
    try {
      supabaseActionClient = createClient(); // Re-create client in action scope
    } catch (error: any) {
       console.error("Sign In Action Error - Supabase client creation failed:", error.message);
       return redirect(`/login?message=Configuration error prevents sign in. Contact admin.`);
    }

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabaseActionClient.auth.signInWithPassword({
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

    let supabaseActionClient;
     try {
       supabaseActionClient = createClient(); // Re-create client in action scope
     } catch (error: any) {
        console.error("Sign Up Action Error - Supabase client creation failed:", error.message);
        return redirect(`/login?message=Configuration error prevents sign up. Contact admin.`);
     }

    const origin = headers().get("origin");
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;


    const { error } = await supabaseActionClient.auth.signUp({
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


  // Render the login form if no initial error and no user logged in
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background relative overflow-hidden p-4">
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
              <p className={`mt-4 p-4 border rounded-md text-center text-sm ${searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") ? 'bg-destructive/20 text-destructive-foreground border-destructive' : 'bg-primary/10 text-primary-foreground border-primary/30'}`}>
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
