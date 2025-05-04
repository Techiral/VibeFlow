import Link from "next/link";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SubmitButton } from "./submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Image from "next/image"; // Import Image component
import { AlertCircle } from "lucide-react";

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
     supabase = await createClient();

     // Check user session *after* confirming Supabase client is created
      const { data, error: authError } = await supabase.auth.getUser();

      if (authError) {
          console.info("Auth error while checking user on login page:", authError.message);
          // Don't necessarily treat "Auth session missing" as a blocking error on the login page itself
          if (!authError.message.includes("Auth session missing")) {
              errorMessage = `Authentication check failed: ${authError.message}`;
          }
      } else {
          user = data.user;
      }

   } catch (error: any) {
      // Catch errors from createClient itself
      if (error.message?.includes('NEXT_REDIRECT')) {
        // Don't log redirect errors, just re-throw them
        throw error;
      }
     console.error("Error during Supabase initialization or user check on login page:", error.message);
     initialError = error;

     // Determine the specific error message for configuration issues
     if (error.message?.includes("URL or Key is missing")) {
        errorMessage = "Authentication service configuration error: Supabase URL or Key is missing. Please contact the administrator.";
     } else if (error.message?.includes("Invalid URL")) {
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
                      <Link href="/" className="flex justify-center items-center mb-4 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
                         {/* Use Image component for logo, adjust size */}
                         <Image src="/logo.png" alt="VibeFlow Logo" width={168} height={168} className="object-contain" />
                      </Link>
                     <CardTitle className="text-2xl font-bold text-gradient sr-only">VibeFlow</CardTitle>
                     <CardDescription className="text-destructive-foreground font-semibold pt-2">
                         Configuration Error
                     </CardDescription>
                 </CardHeader>
                 <CardContent>
                    <p className="text-sm text-muted-foreground text-center mb-4">{errorMessage}</p>
                    <p className="text-sm text-muted-foreground text-center">Please ensure Supabase environment variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`) are correctly configured.</p>
                     <pre className="mt-4 w-full rounded-md bg-muted p-4 overflow-x-auto text-xs text-muted-foreground">
                        {initialError.stack}
                    </pre>
                     <div className="mt-6 text-center">
                         <Link href="/" className="text-sm underline text-muted-foreground hover:text-primary">
                             Back to Landing Page
                         </Link>
                    </div>
                 </CardContent>
             </Card>
         </div>
       );
   }


  // If user is already logged in (and client creation succeeded), redirect to dashboard
  if (user) {
    console.log("User already logged in, redirecting to dashboard.");
    return redirect("/dashboard");
  }


  // --- Server Actions ---
  const signIn = async (formData: FormData) => {
    "use server";

    let supabaseActionClient;
    try {
      supabaseActionClient = await createClient();
    } catch (error: any) {
       console.error("Sign In Action Error - Supabase client creation failed:", error.message);
        let redirectMessage = "Configuration error prevents sign in. Contact admin.";
        if (error.message?.includes("Invalid URL")) {
            redirectMessage = "Configuration error (Invalid URL). Contact admin.";
        } else if (error.message?.includes("URL or Key is missing")) {
             redirectMessage = "Configuration error (Missing URL/Key). Contact admin.";
        }
       return redirect(`/login?message=${encodeURIComponent(redirectMessage)}`);
    }

    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    let response;
    try {
      console.log(`Attempting sign in for: ${email}`);
      const { error } = await supabaseActionClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
         console.warn(`Sign in failed for ${email}: ${error.message}`);
         // Provide more specific error feedback
         let message = `Could not authenticate user.`;
         if (error.message.includes("Invalid login credentials")) {
             message = "Invalid email or password.";
         } else if (error.message.includes("Email not confirmed")) {
             message = "Please confirm your email address first.";
         } else {
             message = `Authentication failed: ${error.message}`;
         }
         response = redirect(`/login?message=${encodeURIComponent(message)}`);
      } else {
         console.log(`Sign in successful for ${email}, redirecting to /dashboard`);
         // Revalidate path or tag if needed after sign in, though redirect handles session update
         // revalidatePath('/dashboard');
         response = redirect("/dashboard"); // Redirect to dashboard on successful sign-in
      }
    } catch (serverActionError: any) {
        console.error("Server Action Error (signIn):", serverActionError);
        let message = "An unexpected server error occurred during sign in.";
        // Check if it's a Next.js internal error or something else
        if (serverActionError.message?.includes('NEXT_')) {
            // Handle specific Next.js errors if necessary, otherwise keep generic
        } else {
            message = `Server error: ${serverActionError.message}`;
        }
        response = redirect(`/login?message=${encodeURIComponent(message)}`);
    }
    return response;
  };

  const signUp = async (formData: FormData) => {
    "use server";

    let supabaseActionClient;
     try {
       supabaseActionClient = await createClient();
     } catch (error: any) {
        console.error("Sign Up Action Error - Supabase client creation failed:", error.message);
        let redirectMessage = "Configuration error prevents sign up. Contact admin.";
        if (error.message?.includes("Invalid URL")) {
            redirectMessage = "Configuration error (Invalid URL). Contact admin.";
        } else if (error.message?.includes("URL or Key is missing")) {
             redirectMessage = "Configuration error (Missing URL/Key). Contact admin.";
        }
        return redirect(`/login?message=${encodeURIComponent(redirectMessage)}`);
     }

    const origin = headers().get("origin");
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    let response;
    try {
        console.log(`Attempting sign up for: ${email}`);
        const { error } = await supabaseActionClient.auth.signUp({
            email,
            password,
            options: {
              // Ensure emailRedirectTo is correctly configured in Supabase Auth settings as well
              emailRedirectTo: `${origin}/auth/callback`,
            },
        });

        if (error) {
            console.warn(`Sign up failed for ${email}: ${error.message}`);
            let message = `Could not sign up user.`;
            if (error.message.includes("Email rate limit exceeded")) {
               message = "Sign up limit reached. Please try again later.";
            } else if (error.message.includes("User already registered")) {
              message = "User already exists. Please try signing in.";
            } else {
              message = `Sign up failed: ${error.message}`;
            }
            response = redirect(`/login?message=${encodeURIComponent(message)}`);
        } else {
            console.log(`Sign up successful for ${email}, confirmation email sent.`);
            // Important: Redirect the user to a page informing them to check their email.
            response = redirect("/login?message=Check email to continue sign in process");
        }
    } catch (serverActionError: any) {
        console.error("Server Action Error (signUp):", serverActionError);
        let message = "An unexpected server error occurred during sign up.";
         if (serverActionError.message?.includes('NEXT_')) {
             // Handle specific Next.js errors if needed
         } else {
            message = `Server error during sign up: ${serverActionError.message}`;
         }
        response = redirect(`/login?message=${encodeURIComponent(message)}`);
    }
    return response;
  };


  // Render the login form if no initial error and no user logged in
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background relative overflow-hidden p-4">
       <div className="absolute inset-0 z-0 gradient-glow"></div>

      <Card className="mx-auto max-w-sm w-full z-10 bg-card/80 backdrop-blur-sm border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center">
           <Link href="/" className="flex justify-center items-center mb-4 focus:outline-none focus:ring-2 focus:ring-ring rounded-md">
              {/* Use Image component for logo, adjust size */}
              <Image src="/logo.png" alt="VibeFlow Logo" width={168} height={168} className="object-contain" />
           </Link>
          <CardTitle className="text-2xl font-bold text-gradient sr-only">VibeFlow</CardTitle>
          <CardDescription className="text-muted-foreground">
            Enter your email below to login or sign up
          </CardDescription>
        </CardHeader>
        <CardContent>
           {searchParams?.message && (
                <Alert
                    variant={searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") || searchParams.message.toLowerCase().includes("invalid") || searchParams.message.toLowerCase().includes("failed") ? "destructive" : "default"}
                    className={`mb-4 ${searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") || searchParams.message.toLowerCase().includes("invalid") || searchParams.message.toLowerCase().includes("failed") ? 'bg-destructive/10 border-destructive/30' : 'bg-primary/10 border-primary/30'}`}
                >
                 {searchParams.message.toLowerCase().includes("check email") ? null : <AlertCircle className="h-4 w-4" />}
                  <AlertDescription className={`text-center text-sm ${searchParams.message.toLowerCase().includes("error") || searchParams.message.toLowerCase().includes("could not") || searchParams.message.toLowerCase().includes("limit reached") || searchParams.message.toLowerCase().includes("configuration") || searchParams.message.toLowerCase().includes("invalid") || searchParams.message.toLowerCase().includes("failed") ? 'text-destructive-foreground' : 'text-primary-foreground'}`}>
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
