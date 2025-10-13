import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { fetchImageUrl, fetchReadingsByTrap } from "@/services/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Loader2, Bug, Camera, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrapDetailModalProps {
  trapId: string | null;
  open: boolean;
  onClose: () => void;
}

const TrapDetailModal = ({ trapId, open, onClose }: TrapDetailModalProps) => {
  const { data: readings, isLoading } = useQuery({
    queryKey: ["readings", trapId],
    queryFn: () => fetchReadingsByTrap(trapId!),
    enabled: !!trapId && open,
  });

  const latestReading =
    readings && readings.length > 0 ? readings[readings.length - 1] : null;

  const {
    data: imageUrl,
    isLoading: isImageLoading,
    isError: isImageError,
  } = useQuery({
    queryKey: ["imageUrl", latestReading?.sourceImage],
    queryFn: () => fetchImageUrl(latestReading!.sourceImage!),
    enabled: !!latestReading?.sourceImage,
  });

  const trapDisplayId = trapId?.split(":").pop() || trapId;

  const chartData =
    readings?.map((reading) => ({
      time: format(new Date(reading.processed_at), "dd/MM HH:mm", {
        locale: ptBR,
      }),
      count: reading.insect_count || 0,
    })) || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Detalhes da Armadilha: {trapDisplayId}
          </DialogTitle>
          <DialogDescription>
            Histórico de leituras e análise temporal
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        ) : readings && readings.length > 0 ? (
          <div className="space-y-6">
            <div className="bg-muted rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px]">
              {isImageLoading && (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              )}
              {isImageError && (
                <div className="text-center text-destructive">
                  <AlertTriangle className="mx-auto h-8 w-8 mb-2" />
                  <p>Falha ao carregar imagem.</p>
                </div>
              )}
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt={`Imagem da armadilha ${trapDisplayId}`}
                  className="rounded-md max-w-full max-h-[400px]"
                />
              )}
              {!isImageLoading && !imageUrl && !isImageError && (
                <div className="text-center text-muted-foreground">
                  <Camera className="mx-auto h-8 w-8 mb-2" />
                  <p>Sem imagem disponível.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Contagem ao Longo do Tempo
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="time"
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    style={{ fontSize: "12px" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="hsl(var(--accent))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--accent))" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Últimas Leituras</h3>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data e Hora</TableHead>
                      <TableHead className="text-right">Contagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readings
                      .slice(-10)
                      .reverse()
                      .map((reading) => (
                        <TableRow key={reading._id}>
                          <TableCell>
                            {format(
                              new Date(reading.processed_at),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {reading.insect_count || 0}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : (
          <Alert>
            <AlertDescription>
              Nenhuma leitura disponível para esta armadilha.
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TrapDetailModal;
