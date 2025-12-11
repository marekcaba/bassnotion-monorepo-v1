'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { usePatternSelector } from '../hooks/usePatternSelector';
import { Pattern } from '../repositories/pattern.repository';
import { Music, Drum, RotateCcw, Lock } from 'lucide-react';

interface PatternSelectorProps {
  tutorialId: string;
  onPatternChange?: (type: 'drums' | 'harmony', pattern: Pattern) => void;
  className?: string;
}

export function PatternSelector({
  tutorialId,
  onPatternChange,
  className,
}: PatternSelectorProps) {
  const {
    selectedDrumPattern,
    selectedHarmonyPattern,
    availableDrumPatterns,
    availableHarmonyPatterns,
    selectDrumPattern,
    selectHarmonyPattern,
    resetToDefaults,
    allowPatternSwitching,
    isLoading,
    isSaving,
  } = usePatternSelector({ tutorialId, onPatternChange });

  const [activeTab, setActiveTab] = useState<'drums' | 'harmony'>('drums');

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            Loading patterns...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!allowPatternSwitching) {
    return (
      <Card className={className}>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm">
              Pattern switching is disabled for this tutorial
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg">Pattern Selection</CardTitle>
        <CardDescription>
          Choose different drum and harmony patterns to customize your practice
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'drums' | 'harmony')}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="drums" className="flex items-center gap-2">
              <Drum className="h-4 w-4" />
              Drums
            </TabsTrigger>
            <TabsTrigger value="harmony" className="flex items-center gap-2">
              <Music className="h-4 w-4" />
              Harmony
            </TabsTrigger>
          </TabsList>

          <TabsContent value="drums" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Drum Pattern</label>
              <Select
                value={selectedDrumPattern?.id}
                onValueChange={(id) => {
                  const pattern = availableDrumPatterns.find(
                    (p) => p.id === id,
                  );
                  if (pattern) selectDrumPattern(pattern);
                }}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a drum pattern">
                    {selectedDrumPattern?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableDrumPatterns.map((pattern) => (
                    <SelectItem key={pattern.id} value={pattern.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{pattern.name}</span>
                        <div className="flex gap-1">
                          {pattern.genre && (
                            <Badge variant="secondary" className="text-xs">
                              {pattern.genre}
                            </Badge>
                          )}
                          {pattern.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDrumPattern?.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedDrumPattern.description}
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="harmony" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Harmony Pattern</label>
              <Select
                value={selectedHarmonyPattern?.id}
                onValueChange={(id) => {
                  const pattern = availableHarmonyPatterns.find(
                    (p) => p.id === id,
                  );
                  if (pattern) selectHarmonyPattern(pattern);
                }}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a harmony pattern">
                    {selectedHarmonyPattern?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableHarmonyPatterns.map((pattern) => (
                    <SelectItem key={pattern.id} value={pattern.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{pattern.name}</span>
                        <div className="flex gap-1">
                          {pattern.genre && (
                            <Badge variant="secondary" className="text-xs">
                              {pattern.genre}
                            </Badge>
                          )}
                          {pattern.isDefault && (
                            <Badge variant="outline" className="text-xs">
                              Default
                            </Badge>
                          )}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedHarmonyPattern?.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedHarmonyPattern.description}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={resetToDefaults}
            disabled={isSaving}
            className="flex items-center gap-2"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
