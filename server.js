const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
let rooms = {};

wss.on("connection", ws => {
  ws.id = Math.random().toString(36).slice(2, 7);

  ws.on("message", msg => {
    const data = JSON.parse(msg);

    if (!rooms[data.room]) rooms[data.room] = [];
    if (!rooms[data.room].includes(ws)) rooms[data.room].push(ws);

    rooms[data.room].forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(msg);
      }
    });
  });

  ws.on("close", () => {
    for (const r in rooms) {
      rooms[r] = rooms[r].filter(c => c !== ws);
    }
  });
});

console.log("WebSocket server běží na portu 8080");
