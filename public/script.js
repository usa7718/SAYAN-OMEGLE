const socket = io();
let localStream;
let peerConnection;
let currentRoom;

const iceServers = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startApp() {
    const name = document.getElementById('nameInput').value;
    const gender = document.getElementById('genderInput').value;
    
    if(!name) return alert("Naam dalo bhai!");

    try {
        // Camera & Mic Permission
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        document.getElementById('localVideo').srcObject = localStream;
        
        document.getElementById('setup-screen').style.display = 'none';
        document.getElementById('chat-screen').style.display = 'flex';
        
        socket.emit('join', { name, gender });
    } catch (e) {
        alert("Camera permission denied!");
    }
}

socket.on('matched', async (data) => {
    currentRoom = data.room;
    document.getElementById('strangerName').innerText = data.partner.name;
    document.getElementById('chatBox').innerHTML += `<p style="color:var(--primary)">System: Connected to ${data.partner.name}</p>`;
    
    initPeer(data.initiator);
});

function initPeer(isInitiator) {
    peerConnection = new RTCPeerConnection(iceServers);
    
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (e) => {
        document.getElementById('remoteVideo').srcObject = e.streams[0];
    };

    peerConnection.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit('signal', { room: currentRoom, signal: { type: 'candidate', candidate: e.candidate } });
        }
    };

    if (isInitiator) {
        peerConnection.createOffer().then(offer => {
            peerConnection.setLocalDescription(offer);
            socket.emit('signal', { room: currentRoom, signal: offer });
        });
    }
}

socket.on('signal', async (data) => {
    if (data.signal.type === 'offer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit('signal', { room: currentRoom, signal: answer });
    } else if (data.signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal));
    } else if (data.signal.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
    }
});

function sendMsg() {
    const text = document.getElementById('msgInput').value;
    if(text) {
        socket.emit('message', { room: currentRoom, text });
        document.getElementById('chatBox').innerHTML += `<p><b>You:</b> ${text}</p>`;
        document.getElementById('msgInput').value = '';
    }
}

socket.on('message', (text) => {
    document.getElementById('chatBox').innerHTML += `<p><b>Stranger:</b> ${text}</p>`;
});

function skipStranger() {
    location.reload(); // Sabse simple way skip karne ka - reconnect.
}

socket.on('partner-left', () => {
    alert("Stranger left the chat.");
    skipStranger();
});
