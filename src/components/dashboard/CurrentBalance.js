import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Loader from "../Loader";
import { useParams } from 'react-router-dom';
import Avatar from "../Avatar";
import { queryKeys } from '../../lib/queryKeys';

const avatarVersionOf = (user) =>
    user?.avatarUpdatedAt || user?.avatarStorageKey || undefined;

const fmtCurrency = (n) =>
    (Number(n) || 0).toLocaleString(undefined, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const fmtSignedCurrency = (n) => {
    const value = Number(n) || 0;
    if (value > 0) return `+${fmtCurrency(value)}`;
    if (value < 0) return `-${fmtCurrency(Math.abs(value))}`;
    return fmtCurrency(0);
};

// eslint-disable-next-line no-unused-vars
const formatDateRange = (from, to) => {
    if (!from && !to) return 'All time';
    if (from && to) return `${from} → ${to}`;
    if (from) return `From ${from}`;
    return `Until ${to}`;
};

export default function CurrentBalance() {
    const { slug } = useParams();

    const params = useMemo(() => ({}), []);

    const {
        data = null,
        error,
        isLoading: loading,
    } = useQuery({
        queryKey: queryKeys.reports.currentBalance(slug, params),
        enabled: !!slug,
        queryFn: async () => {
            const { data } = await api.get(
                `/reports/${encodeURIComponent(slug)}/reports/current-balance`,
                { params, withCredentials: true }
            );
            return data;
        },
    });

    const members = useMemo(() => data?.members ?? [], [data?.members]);
    const settlements = useMemo(() => data?.settlements ?? [], [data?.settlements]);
    const net = data?.netBetweenTwoUsers ?? null;
    const err = error?.response?.data?.error || error?.message || '';

    const totalSettlementAmount = useMemo(
        () => settlements.reduce((sum, s) => sum + Number(s.amount || 0), 0),
        [settlements]
    );

    const hero = useMemo(() => {
        if (!members.length) {
            return {
                title: "No balance data yet",
                subtitle: "Add some shared purchases to see who owes who.",
                tone: "neutral",
            };
        }

        if (net && members.length === 2) {
            if (Number(net.amount) === 0) {
                return {
                    title: "Everyone is settled 🎉",
                    subtitle: "Neither person owes the other anything right now.",
                    tone: "positive",
                };
            }

            return {
                title: `${net.from?.name ?? 'User'} owes ${net.to?.name ?? 'User'} ${fmtCurrency(net.amount)}`,
                subtitle: "This is the simplest current settlement between both members.",
                tone: "negative",
            };
        }

        if (!settlements.length) {
            return {
                title: "Everyone is settled 🎉",
                subtitle: "There are no unsettled debts in the selected period.",
                tone: "positive",
            };
        }

        if (settlements.length === 1) {
            const s = settlements[0];
            return {
                title: `${s.from?.name ?? 'User'} pays ${s.to?.name ?? 'User'} ${fmtCurrency(s.amount)}`,
                subtitle: "One transfer would settle everything.",
                tone: "negative",
            };
        }

        return {
            title: `${settlements.length} transfers would settle ${fmtCurrency(totalSettlementAmount)}`,
            subtitle: "Use the suggested settlements below to clear the group balance.",
            tone: "neutral",
        };
    }, [members, settlements, net, totalSettlementAmount]);

    return (
        <div className={`dashboard-balance is-${hero.tone}`}>
            <div className="dashboard-balance-inner">
                <div className="dashboard-balance-top">
                    <div className="dashboard-balance-heading">
                        <h3 className="dashboard-balance-title">
                            Current balance
                        </h3>
                    </div>
                </div>

                {loading ? (
                    <Loader />
                ) : err ? (
                    <div className="dashboard-balance-error">
                        {err}
                    </div>
                ) : (
                    <>
                        <div className="dashboard-balance-grid">
                            <div className="dashboard-balance-card dashboard-balance-card-summary">
                                <div>
                                    <p className="dashboard-balance-card-label">Summary</p>

                                    <h2 className="dashboard-balance-card-title">
                                        {hero.title}
                                    </h2>

                                    <p className="dashboard-balance-card-text">
                                        {hero.subtitle}
                                    </p>
                                </div>
                            </div>

                            <div className="dashboard-balance-card dashboard-balance-card-settlements">
                                <p className="dashboard-balance-card-label">Suggested settlements</p>

                                <div className="dashboard-balance-settlements">
                                    {settlements.length === 0 ? (
                                        <div className="dashboard-balance-settled">
                                            Everyone is settled.
                                        </div>
                                    ) : (
                                        settlements.map((s, i) => (
                                            <div
                                                key={`${s.from.id}-${s.to.id}-${i}`}
                                                className="dashboard-balance-settlement"
                                            >
                                                <div className="dashboard-balance-settlement-text">
                                                    <strong>{s.from.name}</strong> pays <strong>{s.to.name}</strong>
                                                </div>

                                                <strong className="dashboard-balance-settlement-amount">
                                                    {fmtCurrency(s.amount)}
                                                </strong>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="dashboard-balance-members">
                            {members.map((m) => {
                                const netValue = Number(m.netBalance || 0);
                                const netTone =
                                    netValue > 0 ? 'is-positive' :
                                        netValue < 0 ? 'is-negative' :
                                            'is-neutral';

                                return (
                                    <div key={m.user.id} className="dashboard-balance-member">
                                        <div className="dashboard-balance-member-top">
                                            <div className="dashboard-balance-member-avatar">
                                                <Avatar
                                                    user={m.user}
                                                    n={3}
                                                    version={avatarVersionOf(m.user)}
                                                    alt={m.user.name}
                                                    fallbackSrc="/images/avatar-placeholder.jpg"
                                                />
                                            </div>

                                            <div className="dashboard-balance-member-heading">
                                                <div className="dashboard-balance-member-name">
                                                    {m.user.name}
                                                </div>

                                                <div className="dashboard-balance-member-subtitle">
                                                    Net balance
                                                </div>
                                            </div>

                                            <div className={`dashboard-balance-member-net ${netTone}`}>
                                                {fmtSignedCurrency(netValue)}
                                            </div>
                                        </div>

                                        <div className="dashboard-balance-member-stats">
                                            <div className="dashboard-balance-stat">
                                                <div className="dashboard-balance-stat-label">Paid</div>
                                                <strong>{fmtCurrency(m.totalPaid)}</strong>
                                            </div>

                                            <div className="dashboard-balance-stat is-receive">
                                                <div className="dashboard-balance-stat-label">To receive</div>
                                                <strong>{fmtCurrency(m.totalOwedToThem)}</strong>
                                            </div>

                                            <div className="dashboard-balance-stat is-pay">
                                                <div className="dashboard-balance-stat-label">To pay</div>
                                                <strong>{fmtCurrency(m.totalTheyOwe)}</strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
