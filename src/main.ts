import "./styles.css";

import { GameApp } from "./game/GameApp";

async function bootstrap(): Promise<void> {
  const mount = document.querySelector<HTMLElement>("#app");

  if (!mount) {
    throw new Error("Missing #app mount node.");
  }

  const app = await GameApp.create(mount);
  app.start();
}

void bootstrap().catch((error: unknown) => {
  console.error(error);

  const message = error instanceof Error ? error.message : "Unknown startup error";
  document.body.innerHTML = `
    <main class="fatal-error">
      <h1>Prototype failed to boot</h1>
      <p>${message}</p>
      <p>Check the browser console for additional details.</p>
    </main>
  `;
});

