# Telegram Integration Setup

## 1. Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot`
3. Choose a display name (e.g. `iHelp Support`)
4. Choose a username (must end with `bot`, e.g. `ihelp_support_bot`)
5. BotFather will give you a **bot token** like `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`
6. Save this token — you'll need it for the `.env` file

## 2. Configure the Telegram Login Widget

The Login Widget lets users authenticate on your website via Telegram.

1. Send `/mybots` to BotFather, select your bot
2. Go to **Bot Settings** > **Domain** > **Edit domain**
3. Set the domain where your frontend runs (e.g. `ihelp.example.com`)
   - For local development: `localhost` works but HTTPS is recommended

## 3. Set Up the Webhook

The webhook lets Telegram forward incoming messages from users to your backend.

```bash
# Replace <BOT_TOKEN> with your bot token
# Replace <DOMAIN> with your public backend URL
# Replace <SECRET> with a random string for webhook verification

curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<DOMAIN>/webhooks/telegram",
    "secret_token": "<SECRET>",
    "allowed_updates": ["message", "edited_message"]
  }'
```

For local development, use a tunnel like `ngrok`:

```bash
ngrok http 3000
# Then set webhook URL to: https://<ngrok-id>.ngrok-free.app/webhooks/telegram
```

## 4. Environment Variables

Add these to your `.env` file:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_WEBHOOK_SECRET=your-random-secret-string
```

| Variable | Description |
|----------|------------|
| `TELEGRAM_BOT_TOKEN` | Bot token from BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | Random string used to verify incoming webhooks (must match the `secret_token` from step 3) |

## 5. Frontend: Add Telegram Login Button

Add the Telegram Login Widget to your login page. The widget redirects users to your backend callback.

```html
<script
  async
  src="https://telegram.org/js/telegram-widget.js?22"
  data-telegram-login="ihelp_support_bot"
  data-size="large"
  data-auth-url="https://your-backend.com/auth/telegram/callback"
  data-request-access="write"
></script>
```

Replace `ihelp_support_bot` with your bot's username and update the `data-auth-url`.

## How It Works

### Authentication Flow

1. User clicks the Telegram Login Widget on the frontend
2. Telegram authenticates the user and redirects to `GET /auth/telegram/callback` with query params: `id`, `first_name`, `last_name`, `username`, `photo_url`, `auth_date`, `hash`
3. Backend validates the hash using HMAC-SHA-256 with the bot token (no passport-telegram dependency needed)
4. Backend creates/updates the user account and a ProviderLink record with `provider=telegram` and `providerAccountId=<telegram_user_id>`
5. Backend issues JWT tokens and redirects to the frontend

### Chat Message Delivery

**Person -> Consultant (from Telegram):**
1. Person sends a message in the Telegram chat with the bot
2. Telegram sends a webhook to `POST /webhooks/telegram`
3. Backend creates a Message record with `channel=TELEGRAM` and `channelChatId=<telegram_chat_id>`
4. WebSocket broadcasts the message to the consultant's chat window

**Consultant -> Person (to Telegram):**
1. Consultant sends a message in the web chat
2. Backend saves the message and broadcasts via WebSocket
3. Backend checks if the person has a linked Telegram account (ProviderLink where `provider=telegram`)
4. If yes, sends the message to Telegram via the Bot API using `TelegramAdapter`
5. Person receives the message in their Telegram chat with the bot

### Architecture

```
Person (Telegram app)
    |
    v
Telegram Bot API
    |
    v
POST /webhooks/telegram --> TelegramService --> MessageService --> DB
                                                    |
                                                    v
                                              ChatGateway (WebSocket)
                                                    |
                                                    v
                                          Consultant (web browser)
                                                    |
                                                    v
                                POST /chat/staff/conversations/:id/messages
                                                    |
                                                    v
                                              DB + WebSocket + TelegramAdapter
                                                    |
                                                    v
                                          Person (Telegram app)
```
