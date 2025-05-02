'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { BrainCircuit, Lock, Star, Trophy, Zap } from "lucide-react";

// Re-define BADGES here or import from dashboard
const BADGES = [
  { xp: 50, name: 'Vibe Starter ✨', description: 'Generated 5 posts!', icon: Star },
  { xp: 100, name: 'Content Ninja 🥷', description: 'Generated 10 posts!', icon: Trophy },
  { xp: 200, name: 'Social Samurai ⚔️', description: 'Generated 20 posts!', icon: Zap },
  { xp: 500, name: 'AI Maestro 🧑‍🔬', description: 'Mastered 50 generations!', icon: BrainCircuit },
];

interface BadgeCollectionProps {
  userBadges: string[];
}

const BadgeCollection: React.FC<BadgeCollectionProps> = ({ userBadges = [] }) => {
  return (
    <TooltipProvider>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {BADGES.map((badge) => {
          const isUnlocked = userBadges.includes(badge.name);
          const Icon = isUnlocked ? badge.icon : Lock;

          return (
            <Tooltip key={badge.name}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center p-4 border rounded-lg aspect-square transition-all duration-200 ease-in-out cursor-default badge-hover",
                    isUnlocked
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/30 bg-muted/50 text-muted-foreground opacity-60"
                  )}
                >
                  <Icon className="h-8 w-8 mb-2" />
                  <span className="text-xs font-medium text-center line-clamp-2">{badge.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs font-semibold">{badge.name}</p>
                <p className="text-xs">{badge.description}</p>
                {!isUnlocked && (
                  <p className="text-xs italic mt-1">(Reach {badge.xp} XP to unlock)</p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};

export default BadgeCollection;
