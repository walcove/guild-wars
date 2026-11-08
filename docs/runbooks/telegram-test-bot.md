# Regular Telegram bot development

No bot token or HTTPS test webhook has been supplied, so native Telegram checks remain unavailable. Current tests inject synthetic updates and an in-memory transport; they make no Telegram network requests. This is a regular community bot, not a Mini App, and it never emits `web_app` buttons.

For an authorized native check, use a separate development bot and group, set its token/username and a random 32–256-character webhook secret in local secret configuration, and explicitly enable `GW_TELEGRAM_SENDING_ENABLED=true` for that bot only. Default is false. HTTPS webhook setup is an operator step; no production webhook is configured by install, build or tests. The webhook is `/api/telegram/webhook` and authenticates Telegram's secret header before parsing a bounded body. Do not put production tokens into local fixture runs.

Ordinary commands commit a minimal operation and Graphile job. Only explicit selected commands are retained; raw link nonces are hashed before queueing, and ordinary chat is ignored. The worker derives current bot identity at execution; queued work for another bot stops. `/start`, `/help`, `/privacy` use ordinary URLs. A link callback proves the authenticated sender in the bot's private chat in a short, bounded database transaction. Deduplication and receipt are committed together, then callback feedback is attempted. A feedback failure never undoes the saved record or reports a new trade.

A send timeout is Unknown and cannot be blindly retried. A definitive 429 observes Retry-After through the supported queue, with a five-attempt application budget. Known acknowledgements are stored before Complete. Bot permission failures remain visible; later publication/ballot services reuse canonical IDs and their own delivery records. No financial provider call occurs while a ballot or link lock is held.

Native evidence still required: private start/confirm/return in the original browser, wrong-browser recovery, group administration and removal, exact proposal/version return, ballot changes/receipts and deadline behavior on desktop/mobile Telegram. Local fixtures and native evidence are never conflated.
