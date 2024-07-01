const express = require('express');
const cors = require('cors');
const http = require('http');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
dotenv.config();

const app = express();
const corsConfig = {
    origin: 'http://localhost:3000',
    optionsSuccessStatus: 200,
};

app.use(cors(corsConfig));

app.get("/", (req, res) => {
    res.send("Hello World");
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
    }
});

const rooms = {}; // Maps ID to an array of connected clients

io.on('connection', (socket) => {
    console.log('New client connected', socket.id);

    socket.on('join-room', ({ roomID }) => {
        if (!rooms[roomID]) {
            rooms[roomID] = new Set();
        }

        if (rooms[roomID].size === 2) {
            socket.emit('room-busy');
        } else {
            rooms[roomID].add(socket.id);
            socket.join(roomID);
            socket.roomID = roomID;
            console.log(`Socket ${socket.id} joined room ${roomID}`);
        }
    });

    socket.on('offer', ({ roomID, offer }) => {
        socket.to(roomID).emit('offer', { offer });
    });

    socket.on('answer', ({ roomID, answer }) => {
        socket.to(roomID).emit('answer', { answer });
    });

    socket.on('ice-candidate', ({ roomID, candidate }) => {
        socket.to(roomID).emit('ice-candidate', { candidate });
    });

    socket.on('leave-call', () => {
        const { roomID } = socket;
        if (rooms[roomID]) {
            rooms[roomID].delete(socket.id);
            if (rooms[roomID].size === 0) {
                delete rooms[roomID];
            }
            socket.leave(roomID);
            socket.to(roomID).emit('leave-call');
        }
    });

    socket.on('disconnect', () => {
        const { roomID } = socket;
        if (rooms[roomID]) {
            rooms[roomID].delete(socket.id);
            if (rooms[roomID].size === 0) {
                delete rooms[roomID];
            }
        }
        console.log(`Socket ${socket.id} disconnected`);
    });
});

app.use((err, req, res, next) => {
    const errorMessage = err.message || "Something went wrong";
    const errorStatus = err.status || 500;
    return res.status(errorStatus).json({
        success: false,
        status: errorStatus,
        message: errorMessage,
        stack: err.stack,
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server has started on port ${PORT}.`));
