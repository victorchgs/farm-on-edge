import { useQuery } from "@tanstack/react-query";
import { fetchFarms } from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface FarmSelectorProps {
  selectedFarm: string | null;
  onFarmChange: (farmId: string) => void;
}

const FarmSelector = ({ selectedFarm, onFarmChange }: FarmSelectorProps) => {
  const { data: farms, isLoading } = useQuery({
    queryKey: ["farms"],
    queryFn: fetchFarms,
  });

  return (
    <div className="space-y-2">
      <Label htmlFor="farm-select">Selecione a Fazenda</Label>
      <Select
        value={selectedFarm || ""}
        onValueChange={onFarmChange}
        disabled={isLoading}
      >
        <SelectTrigger id="farm-select" className="w-full md:w-[300px]">
          <SelectValue
            placeholder={isLoading ? "Carregando..." : "Selecione uma fazenda"}
          />
        </SelectTrigger>
        <SelectContent>
          {farms?.map((farm) => (
            <SelectItem key={farm.id} value={farm.id}>
              {farm.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default FarmSelector;
