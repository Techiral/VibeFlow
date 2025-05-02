'use client';

import { useState } from 'react';
import { Hash, Smile, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface BoostPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  onInsertText: (text: string) => void; // Callback to insert text into the main textarea
}

// Example data (replace with dynamic fetching if needed)
const TRENDING_HASHTAGS = {
  "Technology": ["#AI", "#MachineLearning", "#WebDev", "#CloudComputing", "#Cybersecurity"],
  "Marketing": ["#SocialMediaMarketing", "#ContentMarketing", "#SEO", "#DigitalMarketing", "#Branding"],
  "Business": ["#Entrepreneurship", "#Startups", "#Leadership", "#Innovation", "#FutureOfWork"],
  "General": ["#Motivation", "#Productivity", "#News", "#Trending", "#Tips"],
};

const EMOJIS = [
  '😀', '😂', '😍', '🤔', '👍', '👎', '🔥', '🚀', '💡', '✨', '✅', '❌', '➡️', '⬇️', '⬆️', '⬅️', '🔗', '📈', '📉', '🎯', '📢', '👥', '💬', '💼', '💻', '📱', '🎉', '💯', '⏳', '🗓️', '❓', '❗'
];

const EMOJI_TOOLTIPS: { [key: string]: string } = {
  '😀': 'Grinning Face', '😂': 'Face with Tears of Joy', '😍': 'Smiling Face with Heart-Eyes', '🤔': 'Thinking Face',
  '👍': 'Thumbs Up', '👎': 'Thumbs Down', '🔥': 'Fire (Hot/Trending)', '🚀': 'Rocket (Launch/Growth)',
  '💡': 'Light Bulb (Idea)', '✨': 'Sparkles (New/Special)', '✅': 'Check Mark Button', '❌': 'Cross Mark',
  '➡️': 'Right Arrow', '⬇️': 'Down Arrow', '⬆️': 'Up Arrow', '⬅️': 'Left Arrow', '🔗': 'Link',
  '📈': 'Chart Increasing', '📉': 'Chart Decreasing', '🎯': 'Direct Hit (Target/Goal)', '📢': 'Loudspeaker (Announcement)',
  '👥': 'Busts in Silhouette (Community/Team)', '💬': 'Speech Bubble (Comment/Discussion)', '💼': 'Briefcase (Business/Work)',
  '💻': 'Laptop', '📱': 'Mobile Phone', '🎉': 'Party Popper (Celebration)', '💯': 'Hundred Points (Perfect/Agree)',
  '⏳': 'Hourglass Not Done (Time/Waiting)', '🗓️': 'Spiral Calendar (Date/Event)', '❓': 'Question Mark', '❗': 'Exclamation Mark'
};

const BoostPanel: React.FC<BoostPanelProps> = ({ isOpen, onToggle, onInsertText }) => {
  const [hashtagFilter, setHashtagFilter] = useState('');

  const filteredHashtags = Object.entries(TRENDING_HASHTAGS).reduce((acc, [category, tags]) => {
    const filtered = tags.filter(tag => tag.toLowerCase().includes(hashtagFilter.toLowerCase()));
    if (filtered.length > 0) {
      acc[category] = filtered;
    }
    return acc;
  }, {} as typeof TRENDING_HASHTAGS);

  return (
    <Card className={ `w-full max-w-xs lg:max-w-sm border-l border-border/50 rounded-l-none flex flex-col h-full bg-card/90 backdrop-blur-sm shadow-lg transition-all duration-300 ease-in-out ${isOpen ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0 absolute right-0 top-0 pointer-events-none'}` }>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Hash className="h-5 w-5 text-cyan-400" /> / <Smile className="h-5 w-5 text-yellow-400" />
          Boost
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="p-4 flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-3">
          {/* Hashtags Section */}
          <div className="mb-6">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-1"><Hash className="h-4 w-4"/> Trending Hashtags</h4>
            <Input
              type="text"
              placeholder="Filter hashtags..."
              value={hashtagFilter}
              onChange={(e) => setHashtagFilter(e.target.value)}
              className="mb-3 h-8 text-xs"
            />
            <Accordion type="multiple" className="w-full">
              {Object.entries(filteredHashtags).map(([category, tags]) => (
                <AccordionItem value={category} key={category}>
                  <AccordionTrigger className="text-xs py-2">{category}</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-wrap gap-1">
                      {tags.map(tag => (
                        <Button
                          key={tag}
                          variant="outline"
                          size="sm"
                          className="text-xs h-6 px-1.5 py-0.5"
                          onClick={() => onInsertText(` ${tag} `)} // Add spaces
                        >
                          {tag}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          <Separator className="my-4" />

          {/* Emoji Picker Section */}
          <div>
            <h4 className="font-semibold text-sm mb-3 flex items-center gap-1"><Smile className="h-4 w-4"/> Quick Emojis</h4>
            <TooltipProvider>
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map(emoji => (
                  <Tooltip key={emoji}>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-lg h-9 w-9"
                        onClick={() => onInsertText(emoji)}
                      >
                        {emoji}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{EMOJI_TOOLTIPS[emoji] || 'Emoji'}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default BoostPanel;
