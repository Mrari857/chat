const http = require("http");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = 3000;

// The startup script tells us which JSON file to use.
const chatFile = process.env.CHAT_FILE || "./chats/chat.json";


// Make sure the chats folder exists
fs.mkdirSync("./chats", { recursive: true });


// Create the JSON file if it doesn't exist
if (!fs.existsSync(chatFile)) {
    fs.writeFileSync(chatFile, "[]");
}


// Save a message to the current chat's JSON file
function saveMessage(message) {

    let messages = [];

    try {
        messages = JSON.parse(
            fs.readFileSync(chatFile, "utf8")
        );
    } catch {
        messages = [];
    }

    messages.push({
        time: new Date().toISOString(),
        ...message
    });

    fs.writeFileSync(
        chatFile,
        JSON.stringify(messages, null, 2)
    );
}


// HTTP server
const server = http.createServer((req, res) => {

    if (req.url === "/") {

        res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8"
        });

        res.end(
            fs.readFileSync("chat.html")
        );

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});


// WebSocket server
const wss = new WebSocket.Server({
    server
});


function sendTo(socket, data) {

    if (
        socket &&
        socket.readyState === WebSocket.OPEN
    ) {
        socket.send(
            JSON.stringify(data)
        );
    }
}


wss.on("connection", (socket) => {

    socket.username = "Anonymous";

    console.log("Someone connected!");

    socket.on("message", (data) => {

        try {

            const message =
                JSON.parse(data.toString());


            // -------------------------
            // USERNAME
            // -------------------------

            if (message.type === "username") {

                socket.username =
                    message.username ||
                    "Anonymous";

                console.log(
                    `${socket.username} joined`
                );

                return;
            }


            // -------------------------
            // PUBLIC MESSAGE
            // -------------------------

            if (message.type === "public") {

                const saved = {

                    type: "public",

                    from: socket.username,

                    text: String(
                        message.text || ""
                    )
                };


                // Save it
                saveMessage(saved);


                // Send to EVERYONE
                for (const client of wss.clients) {

                    sendTo(
                        client,
                        saved
                    );
                }

                console.log(
                    `[PUBLIC] ${socket.username}: ${saved.text}`
                );

                return;
            }


            // -------------------------
            // PRIVATE REPLY
            // -------------------------

            if (message.type === "private") {

                const target =
                    String(message.to || "");

                const saved = {

                    type: "private",

                    from: socket.username,

                    to: target,

                    text: String(
                        message.text || ""
                    )
                };


                // Save it
                saveMessage(saved);


                // Send ONLY to:
                // 1. sender
                // 2. recipient

                for (const client of wss.clients) {

                    if (
                        client === socket ||
                        client.username === target
                    ) {

                        sendTo(
                            client,
                            saved
                        );
                    }
                }


                console.log(
                    `[PRIVATE] ${socket.username} -> ${target}: ${saved.text}`
                );

                return;
            }

        } catch (error) {

            console.log(
                "Invalid message received."
            );
        }
    });


    socket.on("close", () => {

        console.log(
            `${socket.username} disconnected.`
        );
    });
});


// Start server
server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `Chat server running on port ${PORT}`
        );

        console.log(
            `Saving messages to ${chatFile}`
        );
    }
);
