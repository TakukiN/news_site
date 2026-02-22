import * as cron from "node-cron";
import { crawlAllSites } from "./engine";

let scheduledTask: ReturnType<typeof cron.schedule> | null = null;

export function startScheduler(cronExpression: string = "0 */6 * * *") {
  if (scheduledTask) {
    console.log("[Scheduler] Stopping existing scheduler...");
    scheduledTask.stop();
  }

  console.log(`[Scheduler] Starting with cron: ${cronExpression}`);
  scheduledTask = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] Crawl triggered at ${new Date().toISOString()}`);
    try {
      const results = await crawlAllSites();
      console.log("[Scheduler] Crawl results:", JSON.stringify(results, null, 2));
    } catch (e) {
      console.error("[Scheduler] Crawl failed:", e);
    }
  });

  return scheduledTask;
}

export function stopScheduler() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Scheduler] Stopped");
  }
}
