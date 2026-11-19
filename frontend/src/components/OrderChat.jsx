import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import socket from '../services/socket';
import { useAuth } from '../context/AuthContext';
import { Send, Image, Lock } from 'lucide-react';

export default function OrderChat({ orderId, orderStatus }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [isArchived, setIsArchived] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!orderId) return;

    // Load initial messages
    api.get(`/chats/${orderId}/messages`).then((res) => {
      setMessages(res.data.messages);
      setIsArchived(res.data.is_archived);
      scrollToBottom();
    });

    // Join WebSocket room untuk pesanan ini
    socket.emit('join_order_room', orderId);

    // Listen incoming messages
    const handleNewMessage = (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
      scrollToBottom();
    };

    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.emit('leave_order_room', orderId);
    };
  }, [orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!inputText.trim() && !photoFile) || sending || isArchived) return;

    setSending(true);
    const formData = new FormData();
    if (inputText.trim()) formData.append('message_text', inputText);
    if (photoFile) formData.append('photo', photoFile);

    try {
      await api.post(`/chats/${orderId}/messages`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setInputText('');
      setPhotoFile(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal mengirim pesan');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[480px]">
      {/* Header Chat */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Ruang Chat Pesanan</h3>
          <p className="text-[11px] text-slate-500">
            Komunikasi langsung antara Pelanggan, Toko, dan Pegawai
          </p>
        </div>
        {isArchived ? (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
            <Lock className="w-3 h-3" /> Arsip Hanya-Baca
          </span>
        ) : (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            ● Aktif
          </span>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-slate-400 py-8">
            Belum ada obrolan. Gunakan chat untuk koordinasi lokasi atau mengirim foto bagian kendaraan.
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-400 mb-0.5 px-1 font-medium">
                  {msg.sender_name} ({msg.sender_role})
                </span>
                <div
                  className={`max-w-[75%] rounded-2xl p-3 text-xs shadow-sm ${
                    isMe
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  {msg.photo_url && (
                    <img
                      src={msg.photo_url}
                      alt="Foto Terkirim"
                      className="rounded-lg mb-2 max-h-48 object-cover cursor-pointer"
                      onClick={() => window.open(msg.photo_url, '_blank')}
                    />
                  )}
                  {msg.message_text && <p className="whitespace-pre-wrap">{msg.message_text}</p>}
                </div>
                <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input */}
      {isArchived ? (
        <div className="p-3 bg-slate-100 text-center text-xs text-slate-500 font-medium border-t border-slate-200">
          Chat telah diarsipkan dan tidak menerima pesan baru karena pesanan telah selesai.
        </div>
      ) : (
        <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200 bg-white space-y-2">
          {photoFile && (
            <div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded-lg text-xs text-blue-800">
              <span className="truncate max-w-[200px]">📷 {photoFile.name}</span>
              <button
                type="button"
                onClick={() => setPhotoFile(null)}
                className="text-red-500 hover:font-bold ml-2"
              >
                Hapus
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="p-2 text-slate-500 hover:text-blue-600 cursor-pointer rounded-lg hover:bg-slate-100">
              <Image className="w-5 h-5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setPhotoFile(e.target.files[0])}
              />
            </label>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tulis pesan ke toko / pegawai..."
              className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-blue-600"
            />

            <button
              type="submit"
              disabled={sending || (!inputText.trim() && !photoFile)}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
