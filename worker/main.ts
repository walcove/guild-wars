// Readiness is local and side-effect free until durable jobs are configured.
if (process.env.GW_LIVE_PREPARATION_ENABLED === "true") {
  throw new Error("Live preparation has not passed release gates");
}
console.info(JSON.stringify({ component: "worker", ready: true, livePreparation: false }));
if (!process.argv.includes("--check")) {
  const timer = setInterval(() => {}, 60000);
  for (const signal of ["SIGTERM", "SIGINT"] as const) process.once(signal, () => { clearInterval(timer); process.exitCode = 0; });
}
