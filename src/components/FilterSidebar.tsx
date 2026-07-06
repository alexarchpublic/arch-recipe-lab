import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ASSET_CLASSES, DEFAULT_ASSET_CLASSES, getAlgorithmLabel } from "@/lib/algorithms";

export interface Filters {
  assetClasses: string[];
  assets: string[];
  focuses: string[];
  timeHorizons: string[];
  algorithms: string[];
  minCAGR: number;
}

const isDefaultAssetClassSelection = (assetClasses: string[]) =>
  assetClasses.length === DEFAULT_ASSET_CLASSES.length &&
  DEFAULT_ASSET_CLASSES.every((c) => assetClasses.includes(c));

interface FilterSidebarProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  availableAssets: string[];
  availableFocuses: string[];
  availableTimeFrames: string[];
  availableAlgorithms: string[];
  onClose?: () => void;
}

export const FilterSidebar = ({
  filters,
  onFiltersChange,
  availableAssets,
  availableFocuses,
  availableTimeFrames,
  availableAlgorithms,
  onClose,
}: FilterSidebarProps) => {
  const handleArrayFilterChange = (
    key: keyof Pick<Filters, 'assetClasses' | 'assets' | 'focuses' | 'timeHorizons' | 'algorithms'>,
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
      assetClasses: [...DEFAULT_ASSET_CLASSES],
      assets: [],
      focuses: [],
      timeHorizons: [],
      algorithms: [],
      minCAGR: 0,
    });
  };

  const hasActiveFilters = 
    !isDefaultAssetClassSelection(filters.assetClasses) ||
    filters.assets.length > 0 ||
    filters.focuses.length > 0 ||
    filters.timeHorizons.length > 0 ||
    filters.algorithms.length > 0 ||
    filters.minCAGR > 0;

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border border-border shadow-card texture-overlay">
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

      {/* Asset Class Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Asset Class</Label>
        <div className="space-y-2">
          {ASSET_CLASSES.map((assetClass) => (
            <div key={assetClass} className="flex items-center space-x-2">
              <Checkbox
                id={`asset-class-${assetClass}`}
                checked={filters.assetClasses.includes(assetClass)}
                onCheckedChange={(checked) =>
                  handleArrayFilterChange('assetClasses', assetClass, checked as boolean)
                }
              />
              <label
                htmlFor={`asset-class-${assetClass}`}
                className="text-sm cursor-pointer hover:text-primary transition-colors"
              >
                {assetClass}
              </label>
            </div>
          ))}
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

      {/* Algorithm Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Algorithm</Label>
        <div className="space-y-2">
          {availableAlgorithms && availableAlgorithms.length > 0 ? (
            availableAlgorithms.map(algorithm => (
              <div key={algorithm} className="flex items-center space-x-2">
                <Checkbox
                  id={`algorithm-${algorithm}`}
                  checked={filters.algorithms.includes(algorithm)}
                  onCheckedChange={(checked) =>
                    handleArrayFilterChange('algorithms', algorithm, checked as boolean)
                  }
                />
                <label
                  htmlFor={`algorithm-${algorithm}`}
                  className="text-sm cursor-pointer hover:text-primary transition-colors"
                >
                  {getAlgorithmLabel(algorithm)}
                </label>
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No algorithms available</div>
          )}
        </div>
      </div>

      <Separator />

      {/* Time Frame and Strategy Type filters removed per requirements */}

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