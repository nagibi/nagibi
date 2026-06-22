import { lazy, Suspense, useState } from 'react';
import { QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const EquipamentoQrScannerModal = lazy(() =>
  import('@/pages/equipamentos/components/equipamento-qr-scanner-modal').then(
    (module) => ({
      default: module.EquipamentoQrScannerModal,
    }),
  ),
);

export function EquipamentoQrButton({ className }: { className?: string }) {
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('size-9 shrink-0', className)}
        aria-label="Escanear QR Code"
        onClick={() => setScannerOpen(true)}
      >
        <QrCode className="size-4" />
      </Button>

      {scannerOpen ? (
        <Suspense fallback={null}>
          <EquipamentoQrScannerModal
            open={scannerOpen}
            onOpenChange={setScannerOpen}
          />
        </Suspense>
      ) : null}
    </>
  );
}
