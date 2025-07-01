class KafkaMonitor {
    constructor() {
        this.ws = null;
        this.autoScroll = true;
        this.messages = [];
        this.topicStats = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.connect();
    }

    initializeElements() {
        // Status elements
        this.connectionStatus = document.getElementById('connection-status');
        this.monitoringStatus = document.getElementById('monitoring-status');
        this.topicCount = document.getElementById('topic-count');
        this.messageCount = document.getElementById('message-count');

        // Control buttons
        this.startBtn = document.getElementById('start-btn');
        this.stopBtn = document.getElementById('stop-btn');
        this.clearBtn = document.getElementById('clear-btn');
        this.refreshBtn = document.getElementById('refresh-btn');
        this.autoScrollBtn = document.getElementById('auto-scroll-btn');

        // Content containers
        this.topicStatsContainer = document.getElementById('topic-stats');
        this.messagesContainer = document.getElementById('messages');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startMonitoring());
        this.stopBtn.addEventListener('click', () => this.stopMonitoring());
        this.clearBtn.addEventListener('click', () => this.clearData());
        this.refreshBtn.addEventListener('click', () => this.refresh());
        this.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
    }

    connect() {
        try {
            this.ws = new WebSocket('ws://localhost:8080');
            
            this.ws.onopen = () => {
                console.log('🔗 Connected to WebSocket');
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            };

            this.ws.onclose = () => {
                console.log('🔌 Disconnected from WebSocket');
                this.updateConnectionStatus(false);
                // Attempt to reconnect after 3 seconds
                setTimeout(() => this.connect(), 3000);
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('❌ Failed to connect:', error);
            this.updateConnectionStatus(false);
        }
    }

    handleMessage(message) {
        switch (message.type) {
            case 'status':
                this.updateStatus(message.data);
                break;
            case 'topic-stats':
                this.updateTopicStats(message.data);
                break;
            case 'recent-outputs':
                this.updateMessages(message.data);
                break;
            case 'new-output':
                this.addNewMessage(message.data);
                break;
            case 'monitoring-started':
                this.onMonitoringStarted(message.data);
                break;
            case 'monitoring-stopped':
                this.onMonitoringStopped();
                break;
            case 'monitor-connected':
                this.onMonitorConnected();
                break;
            case 'error':
                this.showError(message.data.message);
                break;
        }
    }

    updateConnectionStatus(connected) {
        this.connectionStatus.textContent = connected ? 'Connected' : 'Disconnected';
        this.connectionStatus.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
    }

    updateStatus(status) {
        this.monitoringStatus.textContent = status.isMonitoring ? 'Active' : 'Stopped';
        this.monitoringStatus.className = `status-value ${status.isMonitoring ? 'monitoring' : ''}`;
        this.topicCount.textContent = status.topicCount;
        this.messageCount.textContent = status.totalOutputs;

        // Update button states
        this.startBtn.disabled = status.isMonitoring;
        this.stopBtn.disabled = !status.isMonitoring;
    }

    updateTopicStats(stats) {
        this.topicStats = stats;
        
        if (stats.length === 0) {
            this.topicStatsContainer.innerHTML = '<div class="empty-state">No topics being monitored</div>';
            return;
        }

        this.topicStatsContainer.innerHTML = stats.map(stat => `
            <div class="topic-stat">
                <div class="topic-name">${stat.topic}</div>
                <div class="topic-details">
                    <div class="topic-detail">
                        <span>Messages:</span>
                        <span>${stat.messageCount}</span>
                    </div>
                    <div class="topic-detail">
                        <span>First:</span>
                        <span>${stat.firstMessageTime ? this.formatTime(stat.firstMessageTime) : 'N/A'}</span>
                    </div>
                    <div class="topic-detail">
                        <span>Latest:</span>
                        <span>${stat.lastMessageTime ? this.formatTime(stat.lastMessageTime) : 'N/A'}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    updateMessages(messages) {
        this.messages = messages;
        this.renderMessages();
    }

    addNewMessage(message) {
        this.messages.unshift(message);
        // Keep only the latest 50 messages
        if (this.messages.length > 50) {
            this.messages = this.messages.slice(0, 50);
        }
        this.renderMessages();
    }

    renderMessages() {
        if (this.messages.length === 0) {
            this.messagesContainer.innerHTML = '<div class="empty-state">No messages received yet</div>';
            return;
        }

        this.messagesContainer.innerHTML = this.messages.map(msg => `
            <div class="message">
                <div class="message-header">
                    <span class="message-topic">${msg.topic}</span>
                    <span class="message-time">${this.formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-content">${this.formatMessageData(msg.data)}</div>
                <div class="message-meta">
                    <span>Org-User-Node: ${msg.orgUsrNode}</span>
                    <span>Partition: ${msg.partition}</span>
                    <span>Offset: ${msg.offset}</span>
                    ${msg.messageKey ? `<span>Key: ${msg.messageKey}</span>` : ''}
                </div>
            </div>
        `).join('');

        if (this.autoScroll) {
            this.messagesContainer.scrollTop = 0;
        }
    }

    formatMessageData(data) {
        if (typeof data === 'object') {
            return JSON.stringify(data, null, 2);
        }
        return String(data);
    }

    formatTime(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    startMonitoring() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'start-monitoring' }));
        }
    }

    stopMonitoring() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'stop-monitoring' }));
        }
    }

    clearData() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'clear-outputs' }));
        }
        this.messages = [];
        this.renderMessages();
    }

    refresh() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'get-status' }));
        }
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        this.autoScrollBtn.classList.toggle('active', this.autoScroll);
        this.autoScrollBtn.textContent = this.autoScroll ? 'Auto Scroll' : 'Manual Scroll';
    }

    onMonitoringStarted(data) {
        console.log('✅ Monitoring started:', data);
        this.refresh();
    }

    onMonitoringStopped() {
        console.log('🛑 Monitoring stopped');
        this.refresh();
    }

    onMonitorConnected() {
        console.log('🔗 Monitor connected to Kafka');
    }

    showError(message) {
        console.error('❌ Error:', message);
        // You could add a toast notification here
    }
}

// Initialize the monitor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new KafkaMonitor();
});