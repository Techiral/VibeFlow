

import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert"; // Import Alert components
import Image from "next/image"; // Import Image component

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { message: string };
}) {
   let supabase;
   let initialError: Error | null = null;
   let user = null;
   let errorMessage: string | null = null;

   try {
     // Await createClient as it's now async
     supabase = await createClient();

     // Check user session *after* confirming Supabase client is created
      const { data } = await supabase.auth.getUser();
      user = data.user;

   } catch (error: any) { // Catch potential errors from client creation or getUser
     // Avoid logging redirects as errors
      if (error.message.includes('NEXT_REDIRECT')) {
        throw error; // Re-throw the redirect error for Next.js to handle
      }
     console.error("Error during Supabase initialization or user check:", error.message);
     initialError = error;

     // Determine the specific error message
     if (error.message.includes("URL or Key is missing")) {
        errorMessage = "Authentication service configuration error: Supabase URL or Key is missing. Please contact the administrator.";
     } else if (error.message.includes("Invalid URL")) {
        errorMessage = "Authentication service configuration error: Invalid Supabase URL format. Please contact the administrator.";
     } else {
         errorMessage = `An unexpected error occurred connecting to the authentication service: ${error.message}`;
     }
   }

   // If client creation failed, show an error and disable login/signup
   if (initialError) {
       return (
         <div className="flex min-h-screen w-full items-center justify-center bg-background relative overflow-hidden p-4">
             <div className="absolute inset-0 z-0 gradient-glow"></div>
             <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
                 <CardHeader className="space-y-1 text-center">
                     {/* Use Image component for logo */}
                      <Link href="/" className="flex justify-center items-center mb-4 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
                         <Image src="/logo.png" alt="VibeFlow Logo" width={40} height={40} className="object-contain" />
                      </Link>
                     <CardTitle className="text-2xl font-bold text-gradient">VibeFlow</CardTitle>
                     <CardDescription className="text-destructive-foreground font-semibold pt-2">
                         {errorMessage}
                     </CardDescription>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground text-center">Please ensure Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`) are correctly configured.</p>
                     <pre className="mt-4 w-full rounded-md bg-muted p-4 overflow-x-auto text-xs text-muted-foreground">
                        {initialError.message}
                    </pre>
                 </CardContent>
             </Card>
         </div>
       );
   }


  // If user is already logged in (and client creation succeeded), redirect to dashboard
  if (user) {
    return redirect("/dashboard");
  }


  // --- Server Actions ---
  // These should ideally also check if supabase client is available,
  // but createClient() will throw if called when vars are missing.

  const signIn = async (formData: FormData) => {
    "use server";

    let supabaseActionClient;
    try {
      // Await createClient as it's now async
      supabaseActionClient = await createClient();
    } catch (error: any) {
       console.error("Sign In Action Error - Supabase client creation failed:", error.message);
        let redirectMessage = "Configuration error prevents sign in. Contact admin.";
        if (error.message.includes("Invalid URL")) {
            redirectMessage = "Configuration error (Invalid URL). Contact admin.";
        }
       return redirect(`/login?message=${encodeURIComponent(redirectMessage)}`);
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

    return redirect("/dashboard"); // Redirect to dashboard on successful sign-in
  };

  const signUp = async (formData: FormData) => {
    "use server";

    let supabaseActionClient;
     try {
       // Await createClient as it's now async
       supabaseActionClient = await createClient();
     } catch (error: any) {
        console.error("Sign Up Action Error - Supabase client creation failed:", error.message);
        let redirectMessage = "Configuration error prevents sign up. Contact admin.";
        if (error.message.includes("Invalid URL")) {
            redirectMessage = "Configuration error (Invalid URL). Contact admin.";
        }
        return redirect(`/login?message=${encodeURIComponent(redirectMessage)}`);
     }

    const origin = headers().get("origin");
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;


    const { error } = await supabaseActionClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${origin}/auth/callback`, // Callback will redirect to dashboard
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
           {/* Use Image component for logo */}
           <Link href="/" className="flex justify-center items-center mb-4 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
              <Image src="/logo.png" alt="VibeFlow Logo" width={40} height={40} className="object-contain" />
           </Link>
          <CardTitle className="text-2xl font-bold text-gradient">VibeFlow</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email below to login or sign up
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Display Server-Side Message */}
           {searchParams?.message && (
                <Alert
                    variant={searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") ? "destructive" : "default"}
                    className={`mb-4 ${searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/10 border-primary/30'}`}
                >
                  <AlertDescription className={`text-center text-sm ${searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
                        {searchParams.message}
                    </AlertDescription>
                </Alert>
           )}
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
           <div className="mt-4 text-center text-sm">
              <Link href="/" className="underline text-muted-foreground hover:text-primary">
                Back to Landing Page
              </Link>
            </div>
        </CardContent>
      </Card>
    </div>
  );
}

