const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url === "/chat.html") {
        try {
            const file = fs.readFileSync(
                path.join(__dirname, "chat.html")
            );

            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-store"
            });

            res.end(file);
        } catch (err) {
            console.error(err);
            res.writeHead(500);
            res.end("Server error");
        }

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({ server });

const users = new Map();

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data, except = null) {
    for (const client of wss.clients) {
        if (client !== except) {
            send(client, data);
        }
    }
}

function makeUser(ws) {
    return {
        id: ws.userId,
        username: ws.username
    };
}

function sendUserList() {
    const list = [];

    for (const ws of wss.clients) {
        if (ws.userId) {
            list.push(makeUser(ws));
        }
    }

    for (const ws of wss.clients) {
        send(ws, {
            type: "user-list",
            users: list
        });
    }
}

function findUser(id) {
    return users.get(String(id));
}

wss.on("connection", (ws) => {
    ws.userId = crypto.randomUUID();
    ws.username = "Anonymous";

    users.set(ws.userId, ws);

    send(ws, {
        type: "your-id",
        id: ws.userId
    });

    sendUserList();

    console.log(`${ws.username} ${ws.userId} connected`);

    ws.on("message", (raw) => {
        let message;

        try {
            message = JSON.parse(raw.toString());
        } catch {
            return;
        }

        /*
         * USERNAME
         */

        if (message.type === "username") {
            let name = String(
                message.username || "Anonymous"
            )
                .trim()
                .replace(/\s+/g, " ")
                .slice(0, 30);

            if (!name) {
                name = "Anonymous";
            }

            ws.username = name;

            sendUserList();
            return;
        }

        /*
         * PUBLIC CHAT
         */

        if (message.type === "public") {
            const text = String(
                message.text || ""
            )
                .trim()
                .slice(0, 2000);

            if (!text) return;

            broadcast({
                type: "public",
                from: ws.username,
                fromId: ws.userId,
                text,
                time: Date.now()
            });

            return;
        }

        /*
         * PRIVATE CHAT
         */

        if (message.type === "private") {
            const text = String(
                message.text || ""
            )
                .trim()
                .slice(0, 2000);

            const targetId = String(
                message.to || ""
            );

            if (!text || !targetId) return;

            const target = findUser(targetId);

            if (!target) return;

            const data = {
                type: "private",
                from: ws.username,
                fromId: ws.userId,
                to: target.username,
                toId: target.userId,
                text,
                time: Date.now()
            };

            send(ws, data);
            send(target, data);

            return;
        }

        /*
         * VOICE SIGNALING
         *
         * voice-offer
         * voice-answer
         * voice-ice
         * voice-hangup
         */

        const voiceTypes = [
            "voice-offer",
            "voice-answer",
            "voice-ice",
            "voice-hangup"
        ];

        if (voiceTypes.includes(message.type)) {
            const targetId = String(
                message.to || ""
            );

            const target = findUser(targetId);

            if (!target) return;

            const packet = {
                ...message,
                from: ws.userId,
                fromUsername: ws.username
            };

            send(target, packet);

            return;
        }
    });

    ws.on("close", () => {
        users.delete(ws.userId);

        broadcast({
            type: "user-left",
            id: ws.userId
        });

        sendUserList();

        console.log(`${ws.username} disconnected`);
    });

    ws.on("error", (err) => {
        console.error("WebSocket error:", err.message);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Chat server running on port ${PORT}`);
});