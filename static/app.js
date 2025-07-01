class KafkaMonitor {
    constructor() {
        this.ws = null;
        this.messages = [];
        this.init();
    }

    init() {
        this.elements = {
            connection: document.getElementById('connection'),
            monitoring: document.getElementById('monitoring'),
            count: document.getElementById('count'),
            messages: document.getElementById('messages'),
            startBtn: document.getElementById('start'),
            stopBtn: document.getElementById('stop'),
            clearBtn: document.getElementById('clear')
        };

        this.setupEvents();
        this.connect();
    }

    setupEvents() {
        this.elements.startBtn.onclick = () => this.send({ type: 'start' });
        this.elements.stopBtn.onclick = () => this.send({ type: 'stop' });
        this.elements.clearBtn.onclick = () => this.send({ type: 'clear' });
    }

    connect() {
        this.ws = new WebSocket('ws://localhost:8080');
        
        this.ws.onopen = () => {
            this.updateConnection(true);
            this.send({ type: 'status' });
            this.send({ type: 'recent' });
        };

        this.ws.onclose = () => {
            this.updateConnection(false);
            setTimeout(() => this.connect(), 3000);
        };

        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
        };

        this.ws.onerror = () => {
            this.updateConnection(false);
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'connected':
                console.log('Connected to server');
                break;
            case 'message':
                this.addMessage(message.data);
                break;
            case 'status':
                this.updateStatus(message.data);
                break;
            case 'recent':
                this.loadMessages(message.data);
                break;
            case 'cleared':
                this.clearMessages();
                break;
            case 'error':
                console.error('Server error:', message.data.message);
                break;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    updateConnection(connected) {
        this.elements.connection.textContent = connected ? 'Connected' : 'Disconnected';
        this.elements.connection.className = connected ? 'connected' : 'disconnected';
    }

    updateStatus(data) {
        this.elements.monitoring.textContent = data.monitoring ? 'Active' : 'Stopped';
        this.elements.monitoring.className = data.monitoring ? 'active' : 'stopped';
        
        if (data.messageCount !== undefined) {
            this.elements.count.textContent = `${data.messageCount} messages`;
        }
    }

    addMessage(message) {
        this.messages.unshift(message);
        if (this.messages.length > 100) {
            this.messages.pop();
        }
        this.renderMessages();
    }

    loadMessages(messages) {
        this.messages = messages || [];
        this.renderMessages();
    }

    clearMessages() {
        this.messages = [];
        this.renderMessages();
    }

    renderMessages() {
        if (this.messages.length === 0) {
            this.elements.messages.innerHTML = '<div class="empty">No messages yet</div>';
            return;
        }

        this.elements.messages.innerHTML = this.messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <span class="topic">${msg.topic}</span>
                    <span class="time">${new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <div class="content">${this.formatData(msg.data)}</div>
                <div class="meta">
                    <span>Node: ${msg.orgUsrNode}</span>
                    <span>Partition: ${msg.partition}</span>
                    <span>Offset: ${msg.offset}</span>
                    ${msg.messageKey ? `<span>Key: ${msg.messageKey}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    formatData(data) {
        if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        return String(data);
    }
}

// Start the monitor
new KafkaMonitor();