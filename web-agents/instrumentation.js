import { useAzureMonitor } from "@azure/monitor-opentelemetry";

export function register() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- useAzureMonitor is Azure Monitor, not a React Hook
  useAzureMonitor();
}