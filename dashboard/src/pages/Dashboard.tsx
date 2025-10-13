import { useState } from "react";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import FarmSelector from "@/components/dashboard/FarmSelector";
import TrapGrid from "@/components/dashboard/TrapGrid";
import TrapDetailModal from "@/components/dashboard/TrapDetailModal";

const Dashboard = () => {
  const [selectedFarm, setSelectedFarm] = useState<string | null>(null);
  const [selectedTrap, setSelectedTrap] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex bg-background">
      <DashboardSidebar />
      
      <main className="flex-1 overflow-auto">
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard de Monitoramento</h1>
            <p className="text-muted-foreground">
              Acompanhe em tempo real as armadilhas de insetos nas fazendas
            </p>
          </div>

          <FarmSelector
            selectedFarm={selectedFarm}
            onFarmChange={setSelectedFarm}
          />

          {selectedFarm ? (
            <TrapGrid
              farmId={selectedFarm}
              onTrapClick={setSelectedTrap}
            />
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              Selecione uma fazenda para visualizar as armadilhas
            </div>
          )}
        </div>
      </main>

      <TrapDetailModal
        trapId={selectedTrap}
        open={!!selectedTrap}
        onClose={() => setSelectedTrap(null)}
      />
    </div>
  );
};

export default Dashboard;
