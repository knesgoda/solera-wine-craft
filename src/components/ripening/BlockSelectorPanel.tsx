import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, TrendingUp, Grape, Filter } from "lucide-react";
import type { BlockWithMeta } from "@/pages/operations/RipeningComparison";

export interface SelectedBlock {
  id: string;
  name: string;
  variety: string | null;
  clone: string | null;
  rootstock: string | null;
  vineyardId: string;
  vineyardName: string;
  vineyardCoordinates: string | null;
  color: string;
}

interface Props {
  allBlocks: BlockWithMeta[];
  selectedBlocks: SelectedBlock[];
  onSelectionChange: (blocks: SelectedBlock[]) => void;
  onCompare: () => void;
  colors: string[];
}

export function BlockSelectorPanel({ allBlocks, selectedBlocks, onSelectionChange, onCompare, colors }: Props) {
  const [varietyFilter, setVarietyFilter] = useState<string>("all");
  const [vineyardFilter, setVineyardFilter] = useState<string>("all");

  const varieties = useMemo(
    () => [...new Set(allBlocks.map((b) => b.variety).filter(Boolean))] as string[],
    [allBlocks]
  );
  const vineyards = useMemo(
    () => [...new Map(allBlocks.map((b) => [b.vineyard_id, b.vineyard_name])).entries()].map(([id, name]) => ({ id, name })),
    [allBlocks]
  );

  const filteredBlocks = useMemo(() => {
    return allBlocks.filter((b) => {
      if (varietyFilter !== "all" && b.variety !== varietyFilter) return false;
      if (vineyardFilter !== "all" && b.vineyard_id !== vineyardFilter) return false;
      return true;
    });
  }, [allBlocks, varietyFilter, vineyardFilter]);

  const selectedIds = new Set(selectedBlocks.map((b) => b.id));

  const toggleBlock = (block: BlockWithMeta) => {
    if (selectedIds.has(block.id)) {
      onSelectionChange(selectedBlocks.filter((b) => b.id !== block.id));
    } else if (selectedBlocks.length < 10) {
      const color = colors[selectedBlocks.length % colors.length];
      onSelectionChange([
        ...selectedBlocks,
        {
          id: block.id,
          name: block.name,
          variety: block.variety,
          clone: block.clone,
          rootstock: block.rootstock,
          vineyardId: block.vineyard_id,
          vineyardName: block.vineyard_name,
          vineyardCoordinates: block.vineyard_coordinates,
          color,
        },
      ]);
    }
  };

  const selectAllOfVariety = (variety: string) => {
    const blocksOfVariety = allBlocks.filter((b) => b.variety === variety);
    const alreadySelected = selectedBlocks.filter((b) => b.variety !== variety);
    const newSelection = blocksOfVariety.slice(0, 10 - alreadySelected.length).map((block, i) => ({
      id: block.id,
      name: block.name,
      variety: block.variety,
      clone: block.clone,
      rootstock: block.rootstock,
      vineyardId: block.vineyard_id,
      vineyardName: block.vineyard_name,
      vineyardCoordinates: block.vineyard_coordinates,
      color: colors[(alreadySelected.length + i) % colors.length],
    }));
    onSelectionChange([...alreadySelected, ...newSelection]);
  };

  const removeBlock = (id: string) => {
    const updated = selectedBlocks.filter((b) => b.id !== id);
    // Re-assign colors to maintain consistency
    onSelectionChange(updated.map((b, i) => ({ ...b, color: colors[i % colors.length] })));
  };

  return (
    <Card className="border-none shadow-md">
      <CardContent className="pt-5 space-y-4">
        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={varietyFilter} onValueChange={setVarietyFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Varieties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Varieties</SelectItem>
              {varieties.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={vineyardFilter} onValueChange={setVineyardFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All Vineyards" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vineyards</SelectItem>
              {vineyards.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {varietyFilter !== "all" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectAllOfVariety(varietyFilter)}
              className="text-xs"
            >
              <Grape className="h-3.5 w-3.5 mr-1" />
              All {varietyFilter} blocks
            </Button>
          )}
        </div>

        {/* Block list */}
        <ScrollArea className="max-h-[200px]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredBlocks.map((block) => {
              const isSelected = selectedIds.has(block.id);
              return (
                <label
                  key={block.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  } ${!isSelected && selectedBlocks.length >= 10 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleBlock(block)}
                    disabled={!isSelected && selectedBlocks.length >= 10}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{block.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[block.variety, block.clone && `Clone: ${block.clone}`, block.rootstock && `RS: ${block.rootstock}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground/70 truncate">{block.vineyard_name}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </ScrollArea>

        {/* Selected chips + compare button */}
        {selectedBlocks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
            {selectedBlocks.map((block) => (
              <Badge
                key={block.id}
                variant="secondary"
                className="pl-1 pr-1 gap-1.5 text-xs font-medium"
                style={{ borderLeft: `3px solid ${block.color}` }}
              >
                <span className="pl-1">{block.name}</span>
                <button
                  onClick={() => removeBlock(block.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button
              onClick={onCompare}
              disabled={selectedBlocks.length < 2}
              size="sm"
              className="ml-auto"
            >
              <TrendingUp className="h-4 w-4 mr-1.5" />
              Compare ({selectedBlocks.length})
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
