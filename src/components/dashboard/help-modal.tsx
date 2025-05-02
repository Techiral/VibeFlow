'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { HelpCircle, Command } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + H', description: 'Open/Close Help & Shortcuts' },
  { key: 'Tab', description: 'Navigate between focusable elements' },
  { key: 'Enter', description: 'Activate focused button/link' },
  { key: 'Esc', description: 'Close modals or dialogs' },
  // Add more shortcuts as needed
];

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onOpenChange }) => {
  const isMac = typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlOrCmd = isMac ? <Command className="inline h-3 w-3" /> : 'Ctrl';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="help-modal-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Boost your productivity with these keyboard shortcuts.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <ul>
            {SHORTCUTS.map((shortcut, index) => (
              <li key={index} className="shortcut-item">
                <span className="shortcut-description">{shortcut.description}</span>
                <span className="shortcut-key">
                  {shortcut.key.includes('Ctrl') ? (
                    <>
                      {ctrlOrCmd} + {shortcut.key.split(' + ')[1]}
                    </>
                  ) : (
                    shortcut.key
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <DialogClose asChild>
          <Button type="button" variant="outline" className="mt-4 w-full">
            Close
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
};

export default HelpModal;
