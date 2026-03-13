const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Public folder ko serve karo
app.use(express.static('public'));

let waitingUsers = [];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userData) => {
        socket.userData = userData;
        
        if (waitingUsers.length > 0) {
            // Match found
            const partner = waitingUsers.pop();
            const roomName = `room_${socket.id}_${partner.id}`;
            
            socket.join(roomName);
            partner.join(roomName);

            socket.partnerId = partner.id;
            partner.partnerId = socket.id;

            // Dono ko batao ki match mil gaya
            io.to(socket.id).emit('matched', { initiator: true, room: roomName, partner: partner.userData });
            io.to(partner.id).emit('matched', { initiator: false, room: roomName, partner: socket.userData });
        } else {
            // Wait queue mein daalo
            waitingUsers.push(socket);
            socket.emit('waiting');
        }
    });

    // WebRTC Signaling
    socket.on('offer', (data) => socket.to(data.room).emit('offer', data.offer));
    socket.on('answer', (data) => socket.to(data.room).emit('answer', data.answer));
    socket.on('ice-candidate', (data) => socket.to(data.room).emit('ice-candidate', data.candidate));

    // Chat Message
    socket.on('chat-message', (data) => {
        socket.to(data.room).emit('chat-message', data);
    });

    // Skip functionality
    socket.on('skip', () => {
        handleDisconnect(socket);
    });

    socket.on('disconnect', () => {
        handleDisconnect(socket);
    });

    function handleDisconnect(socketToDisconnect) {
        // Agar waiting list mein tha toh hatao
        waitingUsers = waitingUsers.filter(u => u.id !== socketToDisconnect.id);
        
        if (socketToDisconnect.partnerId) {
            const partner = io.sockets.sockets.get(socketToDisconnect.partnerId);
            if (partner) {
                partner.emit('partner-skipped');
                partner.partnerId = null;
            }
            socketToDisconnect.partnerId = null;
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
