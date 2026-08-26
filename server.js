const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        res.end(fs.readFileSync("chat.html"));
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

const wss = new WebSocket.Server({ server });

function sendTo(socket, data) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data));
    }
}

wss.on("connection", (socket) => {
    socket.username = "Anonymous";

    console.log("Someone connected!");

    socket.on("message", (data) => {
        try {
            const message = JSON.parse(data.toString());

            if (message.type === "username") {
                socket.username = message.username || "Anonymous";
                return;
            }

            if (message.type === "public") {
                const saved = {
                    type: "public",
                    from: socket.username,
                    text: String(message.text || "")
                };

                for (const client of wss.clients) {
                    sendTo(client, saved);
                }

                return;
            }

            if (message.type === "private") {
                const saved = {
                    type: "private",
                    from: socket.username,
                    to: String(message.to || ""),
                    text: String(message.text || "")
                };

                for (const client of wss.clients) {
                    if (
                        client === socket ||
                        client.username === saved.to
                    ) {
                        sendTo(client, saved);
                    }
                }

                return;
            }

        } catch {
            console.log("Invalid message received.");
        }
    });

    socket.on("close", () => {
        console.log(`${socket.username} disconnected.`);
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Chat server running on port ${PORT}`);
});
