import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Filters {
  assets: string[];
  focuses: string[];
  timeHorizons: string[];
  timeFrames: string[];
  strategyTypes: string[];
  minCAGR: number;
}

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableAssets: string[];
  availableFocuses: string[];
  availableTimeFrames: string[];
  availableStrategyTypes: string[];
  onClose?: () => void;
}

export const FilterSidebar = ({
  filters,
  onFiltersChange,
  availableAssets,
  availableFocuses,
  availableTimeFrames,
  availableStrategyTypes,
  onClose,
}: FilterSidebarProps) => {
  const handleArrayFilterChange = (
    key: keyof Pick<Filters, 'assets' | 'focuses' | 'timeHorizons' | 'timeFrames' | 'strategyTypes'>,
    value: string,
    checked: boolean
  ) => {
    const currentValues = filters[key];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    onFiltersChange({ ...filters, [key]: newValues });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      assets: [],
      focuses: [],
      timeHorizons: [],
      timeFrames: [],
      strategyTypes: [],
      minCAGR: 0,
    });
  };

  const hasActiveFilters = 
    filters.assets.length > 0 ||
    filters.focuses.length > 0 ||
    filters.timeHorizons.length > 0 ||
    filters.timeFrames.length > 0 ||
    filters.strategyTypes.length > 0 ||
    filters.minCAGR > 0;

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border border-border shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filters</h2>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearAllFilters}
              className="h-8 text-xs"
            >
              Clear All
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Asset Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Asset</Label>
        <div className="space-y-2">
          {availableAssets.map(asset => (
            <div key={asset} className="flex items-center space-x-2">
              <Checkbox
                id={`asset-${asset}`}
                checked={filters.assets.includes(asset)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('assets', asset, checked as boolean)
                }
              />
              <label
                htmlFor={`asset-${asset}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {asset}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Focus Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Focus</Label>
        <div className="space-y-2">
          {availableFocuses.map(focus => (
            <div key={focus} className="flex items-center space-x-2">
              <Checkbox
                id={`focus-${focus}`}
                checked={filters.focuses.includes(focus)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('focuses', focus, checked as boolean)
                }
              />
              <label
                htmlFor={`focus-${focus}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {focus}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Time Horizon Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Time Horizon</Label>
        <div className="space-y-2">
          {['STH', 'LTH'].map(horizon => (
            <div key={horizon} className="flex items-center space-x-2">
              <Checkbox
                id={`horizon-${horizon}`}
                checked={filters.timeHorizons.includes(horizon)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('timeHorizons', horizon, checked as boolean)
                }
              />
              <label
                htmlFor={`horizon-${horizon}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {horizon === 'STH' ? 'Short Term' : 'Long Term'}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Time Frame Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Time Frame</Label>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {availableTimeFrames.map(frame => (
            <div key={frame} className="flex items-center space-x-2">
              <Checkbox
                id={`frame-${frame}`}
                checked={filters.timeFrames.includes(frame)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('timeFrames', frame, checked as boolean)
                }
              />
              <label
                htmlFor={`frame-${frame}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {frame}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Strategy Type Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Strategy Type</Label>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {availableStrategyTypes.map(strategy => (
            <div key={strategy} className="flex items-center space-x-2">
              <Checkbox
                id={`strategy-${strategy}`}
                checked={filters.strategyTypes.includes(strategy)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('strategyTypes', strategy, checked as boolean)
                }
              />
              <label
                htmlFor={`strategy-${strategy}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {strategy}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* CAGR Slider */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Minimum CAGR</Label>
          <span className="text-sm text-muted-foreground">{filters.minCAGR}%</span>
        </div>
        <Slider
          value={[filters.minCAGR]}
          onValueChange={([value]) => onFiltersChange({ ...filters, minCAGR: value })}
          max={150}
          step={5}
          className="w-full"
        />
      </div>
    </div>
  );
};