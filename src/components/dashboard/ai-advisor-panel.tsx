'use client';

import { X, Lightbulb, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import type { AnalyzePostOutput } from '@/ai/flows/analyze-post';
import { cn } from '@/lib/utils'; // Import cn

interface AiAdvisorPanelProps {
  isOpen: boolean;
  isLoading: boolean;
  analysis: AnalyzePostOutput | null | undefined;
  onApplySuggestion: (start: number, end: number, suggestion: string) => void;
  onClose: () => void;
}

const AiAdvisorPanel: React.FC<AiAdvisorPanelProps> = ({
  isOpen,
  isLoading,
  analysis,
  onApplySuggestion,
  onClose,
}) => {
  // Don't render anything if closed, but allow placeholder on large screens
  if (!isOpen) {
    return null;
  }

  return (
    // Removed fixed width, added flex-grow and min-height
    <Card className={cn(
        "w-full border-l border-border/50 rounded-l-none flex flex-col h-full bg-card/90 backdrop-blur-sm shadow-lg",
        "lg:min-h-[300px]" // Ensure it has some height on large screens
    )}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-purple-400" />
          AI Advisor
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <Separator />
      <CardContent className="p-4 flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-3"> {/* Added pr-3 for scrollbar spacing */}
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
               <Separator />
               <Skeleton className="h-4 w-1/3" />
               <Skeleton className="h-4 w-full" />
               <Skeleton className="h-4 w-3/4" />
            </div>
          )}
          {!isLoading && !analysis && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Click the ✨ icon on a post to get feedback.
            </p>
          )}
          {!isLoading && analysis && analysis.flags && analysis.flags.length === 0 && (
             <div className="text-sm text-muted-foreground text-center py-10 flex flex-col items-center gap-2">
                <Check className="h-6 w-6 text-green-500" />
                <span>Looks good! No major issues found.</span>
             </div>
          )}
          {!isLoading && analysis && analysis.flags && analysis.flags.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold text-sm mb-2">Suggestions:</h4>
              {analysis.flags.map((flag, index) => (
                <div key={index} className="border border-border/50 rounded-md p-3 bg-background/50 text-xs">
                  <p className="font-medium mb-1">{flag.issue}</p>
                  <p className="text-muted-foreground mb-2 italic">"{flag.originalText}"</p>
                  <p className="mb-2">Suggestion: <span className="font-medium text-primary">{flag.suggestion}</span></p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onApplySuggestion(flag.start, flag.end, flag.suggestion)}
                    className="text-xs"
                  >
                    Apply Suggestion
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AiAdvisorPanel;
