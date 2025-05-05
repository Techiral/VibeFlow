# ✨ VibeFlow: My Story of Building Your AI Social Media Wingman ✨

[![VibeFlow Landing Page](./public/og-image-vibeflow.png)](/) _(Click to see VibeFlow in action!)_

## 👋 Hey there!

Let me tell you a quick story about why I created VibeFlow.

Like you, I get the pressure of social media. It's how we connect, share, and build our brands. But honestly, coming up with fresh, engaging content every single day? It's exhausting! I was tired of staring at a blank screen, feeling uninspired, and wondering if my posts were even making a difference.

That's when I had an idea: What if there was a tool that could take the pain out of social media? What if we could use AI to make content creation fun, fast, and effective?

## 🚀 That's how VibeFlow was born!

Think of VibeFlow as your friendly AI sidekick for social media.

### What VibeFlow Can Do For You:

*   **Conquer writer's block:** Just share a few thoughts, and VibeFlow will whip up amazing drafts for LinkedIn, X (Twitter), and YouTube.
*   **Find your unique voice:** Want to sound like a cool Gen Z influencer, a respected industry leader, or a hilarious meme master? VibeFlow lets you choose an AI persona that fits your brand.
*   **Create content that actually connects:** VibeFlow understands what works on each platform and will help you optimize your posts for maximum engagement.
*   **Save time and reclaim your life:** Stop wasting hours on social media and start focusing on what truly matters.

## 🛠️ How I Built VibeFlow: A Passion Project

I poured my heart and soul into building VibeFlow, using a combination of powerful and user-friendly technologies:

*   **Next.js:** For a lightning-fast and intuitive web experience.
*   **Supabase:** To handle user accounts and data securely.
*   **Google Gemini:** The AI engine that powers VibeFlow's content generation and optimization capabilities.
*   **ShadCN UI & Tailwind CSS:** For a clean, modern, and responsive design that looks great on any device.

But more than just the tech, VibeFlow is built with a deep understanding of the challenges that social media creators face every day.

## 🌟 Why VibeFlow is Different (and Why You'll Love It!)

I know there are other AI content creation tools out there, but VibeFlow is special because:

*   **It's incredibly easy to use:** You don't need to be a tech whiz to get started with VibeFlow.
*   **It's laser-focused on social media:** We're not trying to be a jack-of-all-trades. We're experts in helping you create amazing social media content.
*   **It's designed to be fun and engaging:** Earn XP and unlock badges as you create content, turning social media into a game.
*   **It puts you in control:** VibeFlow provides AI-powered suggestions, but you always have the final say. You can tweak, edit, and refine your content until it's perfect.

## 🚀 Unleash Your Social Media Superpower with VibeFlow

Here's a glimpse of what VibeFlow can do:

| Feature             | Description                                                                    |
| ------------------- | ------------------------------------------------------------------------------ |
| AI Content Magic    | Transform your raw ideas into polished drafts in seconds.                      |
| Persona Power       | Choose from a variety of AI writing styles to match your brand.                |
| Platform Perfection | Optimize your posts for LinkedIn, X, and YouTube effortlessly.                 |
| AI Advisor          | Get instant feedback on your drafts and identify areas for improvement.        |
| Easy Editing        | Tweak your content with AI-powered suggestions or your own creative touch.     |
| Level Up Your Game  | Earn XP and unlock badges as you create content.                               |
| Track Your Progress | See how many AI requests you have left each month.                             |
| Secure API Key      | Your Google Gemini API key is stored safely.                                  |
| Modern UI           | Enjoy a beautiful and intuitive user interface.                                |
| Dark Mode           | Because it's easier on the eyes.                                              |
| Speedy Shortcuts    | Get things done faster with keyboard shortcuts.                                |

## 🏁 Ready to Transform Your Social Media Presence? Here's How to Get Started:

1.  **Explore the Landing Page:** Get a feel for what VibeFlow can do.
2.  **Sign Up / Log In:** Create an account or log in with Supabase.
3.  **Dashboard:**
    *   **Add Your Gemini Key:** Go to Profile Settings (👤 icon) and add your Google Gemini API Key.
    *   **Share Your Wisdom:** Paste your text into the input box.
    *   **Choose Your Voice:** Pick an AI persona.
    *   **Let the AI Work Its Magic:** Click "Generate Posts."
    *   **Review and Remix:** Edit your drafts.
    *   **Fine-Tune with AI:** Use the tuning buttons or the "Tune Tone & Style" sidebar.
    *   **Get Expert Advice:** Click the AI Advisor (✨ icon).
    *   **Add Some Spice:** Use the Boost Panel (⚙️ icon).
    *   **Copy and Conquer:** Share your post with the world!
    *   **(Coming Soon!) One-Click Publishing:** Connect your social media accounts and publish directly.
4.  **Manage Your Profile:** Track your usage and view your badges.

## 🚀 Let's Get You Started on Your Social Media Journey!

### 🚨 Important! Database Setup Required!

If you see any error messages, just follow **Step 3** below.

### 1. Install the Goodies:

```bash
npm install
```

### 2. Tell VibeFlow Where to Find Your Supabase Stuff:

Create a `.env.local` file and add your Supabase API keys:

```plaintext
# Replace these with your actual Supabase URL and Anon Key
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# You'll add your Google Gemini API Key in the app itself.
```

**Important:** Keep your API keys secret!

### 3. Set Up Your Supabase Database (Super Important!)

Run these SQL commands in your Supabase project:

a.  Go to the **SQL Editor**.
b.  Click **+ New query**.
c.  Copy and paste the contents of `supabase/schema.sql`.
d.  Run the script!

**Don't Worry, It's Safe!** This script can be run multiple times.

### 4. Fire Up the Engines!

```bash
npm run dev
```

This will start VibeFlow, usually at `http://localhost:9002`.

### 5. (Optional) Peek Behind the Curtain with Genkit:

```bash
npm run genkit:watch
```

### 6. Launch VibeFlow!

Open your browser and go to `http://localhost:9002`.

### 7. Add Your Gemini API Key:

Click the user icon 👤 and add your Google Gemini API Key. Get one for free from [Google AI Studio](https://aistudio.google.com/app/apikey).

## ⚙️ Under the Hood: VibeFlow's Secret Sauce

```
.
├── public/
├── supabase/
│   └── schema.sql
├── src/
│   ├── actions/
│   ├── ai/
│   │   ├── flows/
│   │   ├── ai-instance.ts
│   │   └── dev.ts
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── page.tsx
│   │   │   └── about-vibeflow.tsx
│   │   ├── api/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── login/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── dashboard.tsx
│   │   │   ├── profile-dialog.tsx
│   │   │   ├── ai-advisor-panel.tsx
│   │   │   ├── boost-panel.tsx
│   │   │   ├── tone-tuner-sheet.tsx
│   │   │   ├── badge-collection.tsx
│   │   │   ├── help-modal.tsx
│   │   │   └── preview-mockup.tsx
│   │   └── ui/
│   ├── hooks/
│   ├── lib/
│   │   ├── supabase/
│   │   └── utils.ts
│   ├── services/
│   └── types/
│       └── supabase.ts
├── .env.local
├── .gitignore
├── components.json
├── middleware.ts
├── next.config.js
├── package.json
├── README.md
└── tsconfig.json
```

## 🔑 The Supabase Schema (`supabase/schema.sql`): The Key to VibeFlow's Power

This file is super important! It tells Supabase how to store your data. **You MUST run this script in the Supabase SQL Editor** (see Step 3 in Getting Started). If you don't, VibeFlow won't work!

**What's an "idempotent script?"** It's a fancy way of saying that you can run this script over and over again without breaking anything. It will only make changes if they're needed.

```sql
-- Supabase Schema Setup V3.1 - Composio Removed, Idempotent Script
-- This script can be run multiple times safely.

-- Drop dependent objects in the correct order
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
DROP FUNCTION IF EXISTS public.handle_profile_update(); -- Now safe to drop
DROP FUNCTION IF EXISTS public.get_user_profile(uuid);
DROP FUNCTION IF EXISTS public.increment_quota(uuid, integer);
DROP FUNCTION IF EXISTS public.get_remaining_quota(uuid);

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at timestamp with time zone,
  username text UNIQUE,
  full_name text,
  phone_number text,
  gemini_api_key text, -- Consider encrypting this column in a real application
  xp integer DEFAULT 0, -- Added XP column
  badges text[] DEFAULT ARRAY[]::text[], -- Added badges column (array of text)
  -- Add length constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini_api_key_length CHECK (char_length(gemini_api_key) <= 255)
);

-- Add required columns if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gemini_api_key text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS badges text[] DEFAULT ARRAY[]::text[];

-- Add constraints if they don't exist
  CONSTRAINT username_length CHECK (char_length(username) <= 50),
  CONSTRAINT full_name CHECK (char_length(full_name) <= 100),
  CONSTRAINT phone_number_length CHECK (char_length(phone_number) <= 20),
  CONSTRAINT gemini
