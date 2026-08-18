import { Container } from "@cloudflare/containers";

declare global {
  interface Env {
    OPENROUTER_API_KEY: string;
  }
}

export class KaiwaContainer extends Container {
  defaultPort = 8080;
  requiredPorts = [8080];
  sleepAfter = "30m";
  enableInternet = true;
  pingEndpoint = "/health";
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path === "/health" || path.startsWith("/api/")) {
      const container = env.KAIWA_CONTAINER.getByName("singleton");
      await container.startAndWaitForPorts({
        startOptions: {
          envVars: { OPENROUTER_API_KEY: env.OPENROUTER_API_KEY },
        },
      });
      return container.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
