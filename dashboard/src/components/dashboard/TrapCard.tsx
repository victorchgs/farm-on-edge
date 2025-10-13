import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bug, Clock } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trap } from "@/lib/schemas";

interface TrapCardProps {
  trap: Trap;
  onClick: () => void;
}

const TrapCard = ({ trap, onClick }: TrapCardProps) => {
  const trapId = trap._id.split(":").pop() || trap._id;
  const count = trap.last_insect_count || 0;
  const isAlert = count >= 10;

  return (
    <Card 
      className="cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">{trapId}</CardTitle>
          <Badge variant={isAlert ? "destructive" : "default"} className={isAlert ? "" : "bg-success text-success-foreground"}>
            {isAlert ? "Alerta" : "Normal"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Bug className="h-6 w-6 text-muted-foreground" />
          {count} insetos
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground w-full">
          <Clock className="h-4 w-4" />
          <span className="truncate">
            {format(new Date(trap.last_reading_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
};

export default TrapCard;
