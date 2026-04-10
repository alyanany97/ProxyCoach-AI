"use client";

import { useEffect } from "react";
import { ApplicationInsights, DistributedTracingModes } from "@microsoft/applicationinsights-web";

let appInsights: ApplicationInsights | null = null;

export function getAppInsights() {
  return appInsights;
}

export default function AppInsightsInit() {
  useEffect(() => {
    const cs = process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;
    if (!cs || appInsights) return;

    appInsights = new ApplicationInsights({
      config: {
        connectionString: cs,
        enableAutoRouteTracking: true, // SPA route changes
        distributedTracingMode: DistributedTracingModes.AI_AND_W3C, // correlation headers
      },
    });

    appInsights.loadAppInsights();
    appInsights.trackPageView(); // first page load
  }, []);

  return null;
}
