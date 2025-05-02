'use client';

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Palette } from 'lucide-react';

// Re-define personas or import from dashboard
const TONES = [
  { value: 'default', label: 'Default' },
  { value: 'tech_ceo', label: 'Tech CEO' },
  { value: 'casual_gen_z', label: 'Casual Gen Z' },
  { value: 'thought_leader', label: 'Thought Leader' },
  { value: 'meme_lord', label: 'Meme Lord' },
  { value: 'formal_pro', label: 'Formal Pro' },
  { value: 'fun_vibes', label: 'Fun Vibes' },
];

interface ToneTunerSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  currentTone: string;
  onApplyTone: (tone: string) => void;
}

const ToneTunerSheet: React.FC<ToneTunerSheetProps> = ({
  isOpen,
  onOpenChange,
  currentTone,
  onApplyTone,
}) => {
  const handleApply = () => {
    // Assuming the selected tone is managed internally or passed via prop
    // For now, let's simulate applying the currently selected value
    const selectedTone = document.querySelector('input[name="tone-group"]:checked') as HTMLInputElement | null;
    if (selectedTone) {
       onApplyTone(selectedTone.value);
    }
    onOpenChange(false); // Close the sheet
  };

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
             <Palette className="h-5 w-5 text-primary" />
             Tune Tone & Style
             </SheetTitle>
          <SheetDescription>
            Select a writing style to apply to the current draft. This will refine the post based on the chosen persona.
          </SheetDescription>
        </SheetHeader>
        <div className="py-6">
          <RadioGroup
            defaultValue={currentTone}
            className="grid gap-4"
            name="tone-group" // Added name for form submission simulation
          >
            {TONES.map((tone) => (
              <div key={tone.value} className="flex items-center space-x-3 border border-border/50 rounded-md p-3 hover:bg-muted/50 transition-colors duration-150">
                <RadioGroupItem value={tone.value} id={`tone-${tone.value}`} />
                <Label htmlFor={`tone-${tone.value}`} className="font-medium cursor-pointer flex-grow">
                  {tone.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </SheetClose>
          <Button type="button" onClick={handleApply}>
            Apply Tone
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default ToneTunerSheet;
