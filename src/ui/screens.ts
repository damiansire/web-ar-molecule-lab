/**
 * Vistas simples (permiso / cargando / error) como funciones que construyen
 * DOM. No usan innerHTML con datos dinámicos y devuelven los nodos relevantes
 * para que `main.ts` enganche los listeners.
 */
export interface PermissionScreen {
  root: HTMLElement;
  button: HTMLButtonElement;
}

export function permissionScreen(): PermissionScreen {
  const root = card(
    "Permisos de cámara",
    "Necesitamos acceso a tu cámara para detectar tu mano y dibujar figuras 3D sobre ella. El video nunca sale de tu dispositivo.",
  );
  const button = primaryButton("Activar cámara");
  root.appendChild(button);
  return { root, button };
}

export function loadingScreen(): HTMLElement {
  const root = card(
    "Cargando el modelo de IA…",
    "Descargando el detector de manos. Esto puede tardar unos segundos la primera vez.",
  );
  root.appendChild(spinner());
  return root;
}

export interface ErrorScreen {
  root: HTMLElement;
  button: HTMLButtonElement;
}

export function errorScreen(message: string, retryLabel = "Reintentar"): ErrorScreen {
  const root = card("Algo salió mal", message);
  const button = primaryButton(retryLabel);
  root.appendChild(button);
  return { root, button };
}

// --- helpers de construcción ---

function card(title: string, description: string): HTMLElement {
  const root = document.createElement("section");
  root.className = "screen";
  const h = document.createElement("h1");
  h.textContent = title;
  const p = document.createElement("p");
  p.textContent = description;
  root.append(h, p);
  return root;
}

function primaryButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "primary";
  button.textContent = label;
  return button;
}

function spinner(): HTMLElement {
  const s = document.createElement("div");
  s.className = "spinner";
  s.setAttribute("role", "status");
  s.setAttribute("aria-label", "Cargando");
  return s;
}
