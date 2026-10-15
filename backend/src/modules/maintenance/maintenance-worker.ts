import type { MaintenanceBlockService } from './maintenance-block.service.js';
// One in-flight scan per process; hotel row locks make multiple API instances safe.
export function startMaintenanceWorker(service: MaintenanceBlockService) {
  let running: Promise<void> | undefined;
  const tick = () => {
    if (running) return;
    running = service
      .activateDue()
      .catch(() => {
        console.error(
          'Scheduled maintenance activation failed; will retry. Date guards remain enforced.',
        );
      })
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 30000).unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
