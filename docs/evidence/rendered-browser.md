# Rendered local browser evidence

`npm run test:e2e:container` passed six cases: shell reflow at 320, 390, 768 and 1360px; authenticated, synthetic research and numeric outcomes at 390 and 1360px. The final research target also passed with a valid four-round schedule and a full first-viewport primary-action assertion at 390×844. Screenshots were visually inspected; selected captures are in [screenshots](screenshots/).

The runner uses the matching [official Playwright Docker image](https://playwright.dev/docs/docker), pinned by digest, running as pwuser with no source/profile mounts and only a random loopback listener. BrowserType.connect’s supported exposeNetwork loopback forwarding reaches the host’s local app. It forces the guarded PostgreSQL test database/app role, blanks service credentials, disables all external data, Telegram sending and live preparation, and stops only its own disposable container. Synthetic records are original test data, not licensed quotes or provider evidence.

The earlier host Chromium MachPort launch failure and unavailable CUA browser host remain reproducible constraints. Container rendering resolves the automated local browser requirement; native Telegram and live provider gates remain unverified.
