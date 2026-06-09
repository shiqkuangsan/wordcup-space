export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <section className="w-full max-w-3xl space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-sm text-muted-foreground">
            Phase 1 scaffold
          </p>
          <h1 className="text-3xl font-semibold tracking-normal">
            世界杯决策工作台
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            本地 Web 系统正在搭建中：User / Codex 逻辑账本、下注生命周期、赔率录入和结算复盘会在后续任务逐步接入。
          </p>
        </div>
      </section>
    </main>
  );
}
