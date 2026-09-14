/**
 * pm2 설정. fork 1인스턴스 고정 — node-cron 잡과 메모리 리미터가 프로세스 단일 전제.
 *   pm2 start ecosystem.config.js
 *   pm2 save && pm2 startup   # 재부팅 시 자동 시작
 * .env.local 은 next start 가 직접 읽는다 (AUTH_URL, 키 등). 여기엔 프로세스 플래그만.
 */
module.exports = {
  apps: [
    {
      name: "maple-board",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000 -H 127.0.0.1",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "600M",
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        CRON_ENABLED: "1",
        TZ: "Asia/Seoul",
      },
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
