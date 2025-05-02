'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Twitter, Linkedin, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PreviewMockupProps {
  platform: 'linkedin' | 'twitter' | 'youtube';
  content: string;
  className?: string;
}

const PreviewMockup: React.FC<PreviewMockupProps> = ({ platform, content, className }) => {
  const getIcon = () => {
    switch (platform) {
      case 'linkedin': return <Linkedin className="h-4 w-4 text-blue-600" />;
      case 'twitter': return <Twitter className="h-4 w-4 text-sky-500" />;
      case 'youtube': return <Youtube className="h-4 w-4 text-red-600" />;
      default: return null;
    }
  };

  const getPlatformName = () => {
     switch (platform) {
      case 'linkedin': return "LinkedIn";
      case 'twitter': return "Twitter";
      case 'youtube': return "YouTube";
      default: return "Platform";
    }
  }

  // Basic rendering, can be enhanced with more platform-specific details
  return (
    <div className={cn("mockup-frame", className)}>
      <div className="flex items-center mb-2 gap-2">
        <Avatar className="h-6 w-6">
           <AvatarFallback className="text-xs">U</AvatarFallback> {/* Placeholder */}
         </Avatar>
        <div className="flex flex-col">
             <span className="text-xs font-semibold">Your Name</span>
             <span className="text-xs text-muted-foreground flex items-center gap-1">
                @{platform}user • {getIcon()} {getPlatformName()} Preview
             </span>
         </div>
      </div>
      <p className="text-sm whitespace-pre-wrap line-clamp-4"> {/* Limit lines for preview */}
        {content || "Your generated content will appear here..."}
      </p>
       {/* Add basic action icons (like, comment, share) - simplified */}
      <div className="flex justify-between text-muted-foreground mt-2 pt-2 border-t border-border/20 text-xs">
         <span>Like</span>
         <span>Comment</span>
         <span>Share</span>
      </div>
    </div>
  );
};

export default PreviewMockup;
