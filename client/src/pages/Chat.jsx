import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const ROOMS = ['General', 'Tech Support', 'Random', 'Gaming', 'Music'];
const SOCKET_URL = 'http://localhost:5000';

export default function Chat() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [currentRoom, setCurrentRoom] = useState('General');
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [typingUser, setTypingUser] = useState('');

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');

  // Delete confirm state
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const editInputRef = useRef(null);

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      auth: { token: user.token }
    });
    setSocket(newSocket);
    return () => { newSocket.disconnect(); };
  }, [user.token]);

  // Join room and listen for events
  useEffect(() => {
    if (!socket) return;

    setMessages([]);
    setEditingId(null);
    setDeleteConfirmId(null);
    socket.emit('join_room', { room: currentRoom, username: user.username });

    socket.on('previous_messages', (msgs) => setMessages(msgs));

    socket.on('receive_message', (msg) => {
      setMessages(prev => [...prev, msg]);
    });

    socket.on('user_typing', ({ username }) => setTypingUser(username));
    socket.on('user_stop_typing', () => setTypingUser(''));

    // Real-time edit: replace the message in state
    socket.on('message_edited', (updatedMsg) => {
      setMessages(prev =>
        prev.map(m => (m._id === updatedMsg._id ? updatedMsg : m))
      );
    });

    // Real-time delete: remove the message from state
    socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });

    return () => {
      socket.off('previous_messages');
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('message_edited');
      socket.off('message_deleted');
    };
  }, [socket, currentRoom, user.username]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUser]);

  // Focus edit input when edit mode starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      // Put cursor at end
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [editingId]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !socket) return;
    socket.emit('send_message', { sender: user.username, content: messageInput.trim(), room: currentRoom });
    socket.emit('stop_typing', { room: currentRoom, username: user.username });
    setMessageInput('');
    clearTimeout(typingTimeoutRef.current);
  };

  const handleInputChange = (e) => {
    setMessageInput(e.target.value);
    if (!socket) return;
    socket.emit('typing', { room: currentRoom, username: user.username });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { room: currentRoom, username: user.username });
    }, 1500);
  };

  // Start editing a message
  const startEdit = (msg) => {
    setEditingId(msg._id);
    setEditContent(msg.content);
    setDeleteConfirmId(null);
  };

  // Submit edit
  const submitEdit = (e) => {
    e.preventDefault();
    if (!editContent.trim() || !socket) return;
    if (editContent.trim() === messages.find(m => m._id === editingId)?.content) {
      setEditingId(null);
      return;
    }
    socket.emit('edit_message', {
      messageId: editingId,
      newContent: editContent.trim(),
      room: currentRoom
    });
    setEditingId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // Show delete confirmation
  const askDelete = (msgId) => {
    setDeleteConfirmId(msgId);
    setEditingId(null);
  };

  const confirmDelete = (msgId) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId: msgId, room: currentRoom });
    setDeleteConfirmId(null);
  };

  const cancelDelete = () => setDeleteConfirmId(null);

  const switchRoom = (room) => {
    setCurrentRoom(room);
    setMessages([]);
    setTypingUser('');
    setEditingId(null);
    setDeleteConfirmId(null);
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="chat-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo-icon-small">💬</span>
          <span className="brand-name">NexChat</span>
        </div>
        <div className="user-info">
          <div className="user-avatar">{user.username[0].toUpperCase()}</div>
          <div className="user-details">
            <span className="user-name">{user.username}</span>
            <span className="user-status">● Online</span>
          </div>
        </div>
        <nav className="rooms-nav">
          <p className="rooms-label">CHANNELS</p>
          {ROOMS.map(room => (
            <button
              key={room}
              className={`room-btn ${currentRoom === room ? 'active' : ''}`}
              onClick={() => switchRoom(room)}
            >
              <span className="room-hash">#</span>
              {room}
            </button>
          ))}
        </nav>
        <button className="logout-btn" onClick={handleLogout}>Sign Out</button>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-main">
        <header className="chat-header">
          <div className="chat-header-left">
            <span className="chat-room-hash">#</span>
            <h2 className="chat-room-name">{currentRoom}</h2>
          </div>
          <p className="chat-room-desc">Chat with the community in #{currentRoom}</p>
        </header>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-chat">
              <p>🚀 Be the first to say something in <strong>#{currentRoom}</strong>!</p>
            </div>
          )}

          {messages.map((msg) => {
            const isOwn = msg.sender === user.username;
            const isSystem = msg.sender === 'System';
            const isEditing = editingId === msg._id;
            const isDeleteConfirm = deleteConfirmId === msg._id;

            return (
              <div
                key={msg._id || msg.timestamp}
                className={`message-wrapper ${isOwn ? 'own' : ''} ${isSystem ? 'system' : ''}`}
              >
                {!isSystem && (
                  <div className={`message-outer ${isOwn ? 'own' : ''}`}>
                    {/* Action buttons — shown on hover, only for own messages */}
                    {isOwn && !isEditing && !isDeleteConfirm && (
                      <div className="msg-actions">
                        <button
                          className="action-btn edit-btn"
                          title="Edit"
                          onClick={() => startEdit(msg)}
                        >
                          ✏️
                        </button>
                        <button
                          className="action-btn delete-btn"
                          title="Delete"
                          onClick={() => askDelete(msg._id)}
                        >
                          🗑️
                        </button>
                      </div>
                    )}

                    {/* Delete confirmation */}
                    {isDeleteConfirm ? (
                      <div className="delete-confirm">
                        <span>Delete this message?</span>
                        <button className="confirm-yes" onClick={() => confirmDelete(msg._id)}>Delete</button>
                        <button className="confirm-no" onClick={cancelDelete}>Cancel</button>
                      </div>
                    ) : isEditing ? (
                      /* Inline edit form */
                      <form className="edit-form" onSubmit={submitEdit}>
                        <input
                          ref={editInputRef}
                          className="edit-input"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                          maxLength={500}
                          onKeyDown={e => e.key === 'Escape' && cancelEdit()}
                        />
                        <div className="edit-actions">
                          <button type="submit" className="edit-save">Save</button>
                          <button type="button" className="edit-cancel" onClick={cancelEdit}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      /* Normal message bubble */
                      <div className={`message-bubble ${isOwn ? 'bubble-own' : 'bubble-other'}`}>
                        {!isOwn && <span className="msg-sender">{msg.sender}</span>}
                        <p className="msg-content">{msg.content}</p>
                        <div className="msg-meta">
                          {msg.edited && <span className="edited-tag">(edited)</span>}
                          <span className="msg-time">{formatTime(msg.timestamp)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isSystem && (
                  <div className="system-msg">{msg.content}</div>
                )}
              </div>
            );
          })}

          {typingUser && (
            <div className="typing-indicator">
              <div className="typing-dots">
                <span></span><span></span><span></span>
              </div>
              <span className="typing-text">{typingUser} is typing...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="message-form" onSubmit={sendMessage}>
          <input
            className="message-input"
            type="text"
            placeholder={`Message #${currentRoom}`}
            value={messageInput}
            onChange={handleInputChange}
            maxLength={500}
            autoComplete="off"
          />
          <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </main>
    </div>
  );
}
