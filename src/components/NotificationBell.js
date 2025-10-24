import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function NotificationBell() {
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);

    const recomputeUnread = (arr) =>
        (arr || []).filter(n => !n.readAt).length;

    const load = async (onlyUnread = false) => {
        const { data } = await api.get('/notifications', { params: { onlyUnread } });
        const list = data.items || [];
        setItems(list);
        setUnread(recomputeUnread(list));
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await api.get('/notifications', { params: { onlyUnread: false } });
                if (cancelled) return;
                const list = data.items || [];
                setItems(list);
                setUnread(list.filter(n => !n.readAt).length);
                } catch {}
            })();
        return () => { cancelled = true; };
    }, []);

    // optimistic mark-read lives here
    const onMarkRead = async (id) => {
        await api.patch(`/notifications/${id}/read`);
        setItems(curr => {
            const next = curr.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n);
            setUnread(recomputeUnread(next));
            return next;
        });
    };

    return (
        <div className="sidebar-left-inner-notifications">
            <button
                className="sidebar-left-inner-notifications-button"
                type="button"
                onClick={async () => {
                    const next = !open;
                    setOpen(next);
                    if (next) await load(false);
                }}
                aria-label="Notifications"
            >
                <svg id="Xnix_Line_Notification_13" data-name="Xnix/Line/Notification 13" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                    <path id="Vector" d="M1.474,7.963A5.757,5.757,0,0,1,7,2a5.757,5.757,0,0,1,5.526,5.963c0,1.317,1.431,2.6,1.473,3.92q0,.028,0,.056a1.535,1.535,0,0,1-1.474,1.59H9.333a2.546,2.546,0,0,1-.683,1.747,2.243,2.243,0,0,1-3.3,0,2.546,2.546,0,0,1-.683-1.747H1.474A1.535,1.535,0,0,1,0,11.939q0-.028,0-.056C.043,10.567,1.474,9.281,1.474,7.963Z" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                    <path id="Vector-2" data-name="Vector" d="M4.667,13.529H9.333M8,0H6" transform="translate(5 4)" fill="none" stroke="#000" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
                </svg>
                {unread > 0 && (
                    <span style={{
                        position: 'absolute', top: -4, right: -6, background: 'crimson',
                        color: '#fff', borderRadius: 10, fontSize: 12, padding: '1px 5px'
                    }}>{unread}</span>
                )}
            </button>

            {open && (
                <Panel
                    items={items}
                    onMarkRead={onMarkRead}
                    onRefresh={() => load(false)}
                />
            )}
        </div>
    );
}

function Panel({ items, onMarkRead, onRefresh }) {
    const navigate = useNavigate();
    const [busyId, setBusyId] = useState(null);
    const mountedRef = React.useRef(true);
    useEffect(() => () => { mountedRef.current = false; }, []);

    async function accept(inviteId) {
        try {
            setBusyId(inviteId);
            const { data } = await api.post(`/invites/${inviteId}/accept`);
            await onRefresh();
            if (data?.slug) navigate(`/${data.slug}`);
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            if (mountedRef.current) setBusyId(null);
        }
    }

    async function decline(inviteId) {
        try {
            setBusyId(inviteId);
            await api.post(`/invites/${inviteId}/decline`);
            await onRefresh();
        } catch (err) {
            alert(err.response?.data?.error || err.message);
        } finally {
            if (mountedRef.current) setBusyId(null);
        }
    }

    return (
        <div style={{
            position: 'absolute', right: 0, top: '100%', width: 360, maxHeight: 420, overflowY: 'auto',
            background: '#000', border: '1px solid #ddd', boxShadow: '0 6px 20px rgba(0,0,0,.1)',
            borderRadius: 12, padding: 8, zIndex: 50
        }}>
            <h4 style={{ margin: '4px 8px 8px' }}>Notifications</h4>
            {items.length === 0 ? (
                <p style={{ margin: '8px' }}>No notifications.</p>
            ) : items.map(n => {
                if (n.type === 'INVITE') {
                    const d = n.data || {};
                    return (
                        <div key={n.id} style={{ borderTop: '1px solid #eee', padding: '8px 8px 10px' }}>
                            <div style={{ marginBottom: 6 }}>
                                You’ve been invited to <b>{d.ownerUsername}</b>’s <b>{d.budgetName}</b> budget.
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={() => accept(d.inviteId)} className="btn ba-purple" disabled={busyId === d.inviteId}>Accept</button>
                                <button type="button" onClick={() => decline(d.inviteId)} className="btn ba-gray" disabled={busyId === d.inviteId}>Decline</button>
                                {!n.readAt && (
                                    <button type="button" onClick={() => onMarkRead(n.id)} className="btn ba-white" style={{ marginLeft:'auto' }}>
                                        Mark read
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                }
                return (
                    <div key={n.id} style={{ borderTop: '1px solid #eee', padding: '8px' }}>
                        <div>New notification</div>
                        {!n.readAt && <button type="button" onClick={() => onMarkRead(n.id)} className="btn ba-white">Mark read</button>}
                    </div>
                );
            })}
        </div>
    );
}
