import type { ObjectiveTrackerSnapshot } from "../game/objectives/types";

export interface ObjectiveTrackerController {
  sync(snapshot: ObjectiveTrackerSnapshot): void;
}

export function createObjectiveTracker(parent: HTMLElement): ObjectiveTrackerController {
  const tracker = document.createElement("aside");
  tracker.className = "objective-tracker hidden";
  tracker.innerHTML = `
    <p class="objective-tracker-eyebrow">Tracked Quest</p>
    <h2></h2>
    <p class="objective-tracker-step"></p>
    <footer class="objective-tracker-footer">
      <span class="objective-tracker-status"></span>
      <span class="objective-tracker-count"></span>
    </footer>
  `;
  parent.append(tracker);

  const title = tracker.querySelector<HTMLHeadingElement>("h2")!;
  const step = tracker.querySelector<HTMLElement>(".objective-tracker-step")!;
  const status = tracker.querySelector<HTMLElement>(".objective-tracker-status")!;
  const count = tracker.querySelector<HTMLElement>(".objective-tracker-count")!;

  return {
    sync(snapshot) {
      if (!snapshot.visible) {
        tracker.classList.add("hidden");
        return;
      }

      tracker.classList.remove("hidden");
      title.textContent = snapshot.title;
      step.textContent = snapshot.stepLabel;
      status.textContent = snapshot.statusLabel;
      count.textContent = snapshot.activeCountLabel;
    }
  };
}
