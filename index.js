const { Server } = require('socket.io');
const express = require('express');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const app = express();
const WebSocket = require('ws');
dotenv.config();


const corsConfig = {
    origin: 'http://localhost:3000',
    credentials: true,
};

app.use(cors(corsConfig));

app.get("/", (req, res) => {
    res.send("Hello World");
});

// Start server

// WebRTC setup using Socket.io
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const rooms = {}; // Maps ID to an array of connected clients

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        let msg = null;
        try {
            msg = JSON.parse(message);
        } catch (e) {
            console.log('Invalid JSON', e);
            return;
        }

        const { type, roomID } = msg;
        switch (type) {
            case 'join-room':
                if (!rooms[roomID]) {
                    rooms[roomID] = new Set();
                }
                if (rooms[roomID].size === 2) {
                    // Room is full, send busy message
                    ws.send(JSON.stringify({ type: 'room-busy' }));
                } else {
                    rooms[roomID].add(ws);
                    ws.roomID = roomID;
                }
                break;
            case 'offer':
                // Send offer to the other peer in the room
                broadcastToRoom(roomID, ws, JSON.stringify(msg));
                break;
            case 'answer':
                // Send answer to the other peer in the room
                broadcastToRoom(roomID, ws, JSON.stringify(msg));
                break;
            case 'ice-candidate':
                // Send new ICE candidate to the other peer in the room
                broadcastToRoom(roomID, ws, JSON.stringify(msg));
                break;
            case 'leave-call':
                // Broadcast the 'leave-call' message to other peer in the room
                broadcastToRoom(roomID, ws, JSON.stringify({ type: 'leave-call' }));
                break;
        }
    });

    ws.on('close', () => {
        // Remove the WebSocket from the room it was in
        const { roomID } = ws;
        if (rooms[roomID]) {
            rooms[roomID].delete(ws);
            if (rooms[roomID].size === 0) {
                // Clean up room if empty
                delete rooms[roomID];
            }
        }
    });
});



//Common function for handling the message broadcast to another peer in the room
function broadcastToRoom(roomID, senderSocket, message) {
    const peers = rooms[roomID];
    if (peers) {
        for (const peerSocket of peers) {
            if (peerSocket !== senderSocket) {
                peerSocket.send(message);
            }
        }
    }
}

//error handling
app.use((err, req, res, next) => {
    const errorMessage = err.message || "Something went wrong";
    const errorStatus = err.status || 500;
    return res.status(errorStatus).json({
        success: false,
        status: errorStatus,
        message: errorMessage,
        stack: err.stack,
    });
})

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server has started on port ${PORT}.`));
