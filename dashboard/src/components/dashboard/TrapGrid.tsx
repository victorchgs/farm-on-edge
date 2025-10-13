import { useQuery } from "@tanstack/react-query";
import { fetchTrapsByFarm } from "@/services/api";
import TrapCard from "./TrapCard";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrapGridProps {
  farmId: string;
  onTrapClick: (trapId: string) => void;
}

const TrapGrid = ({ farmId, onTrapClick }: TrapGridProps) => {
  const {
    data: traps,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["traps", farmId],
    queryFn: () => fetchTrapsByFarm(farmId),
    enabled: !!farmId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Erro ao carregar armadilhas. Tente novamente.
        </AlertDescription>
      </Alert>
    );
  }

  if (!traps || traps.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          Nenhuma armadilha encontrada para esta fazenda.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {traps.map((trap) => (
        <TrapCard
          key={trap._id}
          trap={trap}
          onClick={() => onTrapClick(trap._id)}
        />
      ))}
    </div>
  );
};

export default TrapGrid;
