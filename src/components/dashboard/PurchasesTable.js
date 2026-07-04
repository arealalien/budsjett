import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import nb from 'date-fns/locale/nb';
import { api } from '../../lib/api';
import { useAuth } from '../AuthContext';
import Dropdown from '../utils/Dropdown';
import Loader from '../Loader';
import Avatar from '../Avatar';
import { queryKeys } from '../../lib/queryKeys';
import { invalidateBudgetData } from '../../lib/queryInvalidation';

const PAGE_SIZE_FULL = 40;
const PAGE_SIZE_COMPACT = 16;
const HEADER_HEIGHT = 58;
const ROW_HEIGHT_FULL = 104;
const ROW_HEIGHT_COMPACT = 86;
const OVERSCAN_ROWS = 8;

const SORT_OPTIONS = [
    { value: 'paidAt', label: 'Date' },
    { value: 'amount', label: 'Amount' },
    { value: 'itemName', label: 'Purchase' },
    { value: 'category', label: 'Category' },
];

const SORT_DIR_OPTIONS = [
    { value: 'desc', label: 'Descending' },
    { value: 'asc', label: 'Ascending' },
];

const DEFAULT_FILTERS = {
    q: '',
    categoryId: '',
    shared: '',
    paidById: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'paidAt',
    sortDir: 'desc',
};

const ALL_COLUMN_DEFS = [
    { id: 'date', label: 'Date', sortable: 'paidAt', width: 150, min: 120, max: 240 },
    { id: 'purchase', label: 'Purchase', sortable: 'itemName', width: 380, min: 230, max: 680 },
    { id: 'paidBy', label: 'Paid by', width: 88, min: 76, max: 120 },
    { id: 'amount', label: 'Amount', sortable: 'amount', width: 145, min: 120, max: 240, align: 'right' },
    { id: 'balance', label: 'Your balance', width: 205, min: 150, max: 320, align: 'right' },
    { id: 'status', label: 'Status', width: 160, min: 130, max: 260 },
    { id: 'actions', label: 'Actions', width: 170, min: 150, max: 240, align: 'right' },
];

const fmtCurrency = (n) =>
    (Number.isFinite(n) ? n : Number(n))
        .toLocaleString(undefined, { style: 'currency', currency: 'EUR' });

const fmtDate = (isoOrDate) => {
    try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        return format(d, 'd. MMM yyyy', { locale: nb });
    } catch {
        return '';
    }
};

const fmtTime = (isoOrDate) => {
    try {
        const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
        return format(d, 'HH:mm');
    } catch {
        return '';
    }
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function cleanParam(value) {
    return String(value ?? '').trim();
}

function readFilters(searchParams) {
    const sortBy = cleanParam(searchParams.get('sortBy'));
    const sortDir = cleanParam(searchParams.get('sortDir'));
    const shared = cleanParam(searchParams.get('shared'));

    return {
        q: cleanParam(searchParams.get('q')),
        categoryId: cleanParam(searchParams.get('categoryId')),
        shared: ['true', 'false'].includes(shared) ? shared : '',
        paidById: cleanParam(searchParams.get('paidById')),
        dateFrom: cleanParam(searchParams.get('dateFrom')),
        dateTo: cleanParam(searchParams.get('dateTo')),
        sortBy: SORT_OPTIONS.some((option) => option.value === sortBy) ? sortBy : DEFAULT_FILTERS.sortBy,
        sortDir: SORT_DIR_OPTIONS.some((option) => option.value === sortDir) ? sortDir : DEFAULT_FILTERS.sortDir,
    };
}

function paramsForApi(filters) {
    const params = {
        sortBy: filters.sortBy,
        sortDir: filters.sortDir,
    };

    ['q', 'categoryId', 'shared', 'paidById', 'dateFrom', 'dateTo'].forEach((key) => {
        if (filters[key]) params[key] = filters[key];
    });

    return params;
}

function applySettleLocal(row, nextValue) {
    const paidById = row.paidBy?.id;
    const shares = (row.shares || []).map((share) => {
        if (paidById && share.userId !== paidById && share.percent > 0) {
            return {
                ...share,
                isSettled: nextValue,
                settledAt: nextValue ? new Date().toISOString() : null,
            };
        }

        return share;
    });

    return { ...row, shares };
}

function myNetForPurchase(row, myUserId, nameOf) {
    const amount = Math.abs(Number(row.amount) || 0);
    const payerId = row.paidBy?.id;

    if (!myUserId || !payerId || !row.shared) return null;

    const shares = Array.isArray(row.shares) ? row.shares : [];

    if (payerId === myUserId) {
        const lines = shares
            .filter((share) => share.userId !== myUserId && (Number(share.percent) || 0) > 0 && !share.isSettled)
            .map((share) => ({
                from: nameOf(share.userId),
                to: nameOf(myUserId),
                amount: round2(amount * (Number(share.percent) || 0) / 100),
            }))
            .filter((line) => line.amount > 0);

        const total = round2(lines.reduce((sum, line) => sum + line.amount, 0));

        return {
            dir: total > 0 ? 'OWED_TO_ME' : 'SETTLED',
            amount: total,
            lines,
        };
    }

    const myShare = shares.find((share) => share.userId === myUserId);
    if (!myShare || (Number(myShare.percent) || 0) <= 0) return null;

    const myAmount = myShare.isSettled ? 0 : round2(amount * (Number(myShare.percent) || 0) / 100);

    return {
        dir: myAmount > 0 ? 'I_OWE' : 'SETTLED',
        amount: myAmount,
        lines: myAmount > 0 ? [{
            from: nameOf(myUserId),
            to: nameOf(payerId),
            amount: myAmount,
        }] : [],
    };
}

async function toggleSettle(purchaseId, nextValue) {
    await api.patch(`/purchases/${purchaseId}/settle`, { settled: nextValue }, { withCredentials: true });
}

function getCategoryName(category, categories = []) {
    if (Array.isArray(categories) && categories.length) {
        const names = categories
            .map((item) => item?.name)
            .filter(Boolean);

        if (names.length) return names.join(', ');
    }

    if (!category) return '-';
    if (typeof category === 'string') return category;
    return category.name || '-';
}

function getPaidByName(paidBy) {
    if (!paidBy) return '-';
    return paidBy.name || paidBy.displayName || paidBy.username || '-';
}

function avatarVersionOf(user) {
    return user?.avatarStorageKey || user?.avatarUpdatedAt || undefined;
}

function getNotePreview(notes) {
    if (!notes) return '';
    if (notes.length <= 80) return notes;
    return `${notes.slice(0, 80)}...`;
}

function flattenPages(data) {
    return data?.pages?.flatMap((page) => page.items || []) || [];
}

function totalFromPages(data) {
    return Number(data?.pages?.[0]?.total || 0);
}

function readStoredWidths(storageKey, columns) {
    const defaults = Object.fromEntries(columns.map((column) => [column.id, column.width]));

    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return defaults;

        const parsed = JSON.parse(raw);
        return columns.reduce((next, column) => {
            const value = Number(parsed[column.id]);
            next[column.id] = Number.isFinite(value)
                ? Math.max(column.min, Math.min(column.max, value))
                : column.width;
            return next;
        }, {});
    } catch {
        return defaults;
    }
}

function getScrollParent(node) {
    let parent = node?.parentElement;

    while (parent && parent !== document.body) {
        const overflowY = window.getComputedStyle(parent).overflowY;

        if (['auto', 'scroll', 'overlay'].includes(overflowY)) {
            return parent;
        }

        parent = parent.parentElement;
    }

    return window;
}

function getScrollParentHeight(scrollParent) {
    return scrollParent === window
        ? window.innerHeight || document.documentElement.clientHeight || 640
        : scrollParent.clientHeight || 640;
}

function getScrollParentTop(scrollParent) {
    return scrollParent === window
        ? 0
        : scrollParent.getBoundingClientRect().top;
}

function getScrollTopForNode(node, scrollParent) {
    return Math.max(0, getScrollParentTop(scrollParent) - node.getBoundingClientRect().top);
}

function scrollNodeToTop(node, scrollParent) {
    const delta = node.getBoundingClientRect().top - getScrollParentTop(scrollParent);

    if (scrollParent === window) {
        window.scrollBy({ top: delta });
    } else {
        scrollParent.scrollTop += delta;
    }
}

function CheckIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12.121" height="12.121" viewBox="0 0 12.121 12.121">
            <path
                d="M0,10,5,5M5,5l5-5M5,5l5,5M5,5,0,0"
                transform="translate(1.061 1.061)"
                fill="none"
                stroke="#000"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
            />
        </svg>
    );
}

export default function PurchasesTable({ size = 'full' }) {
    const isCompact = size === 'compact';
    const usesPageScroll = !isCompact;
    const navigate = useNavigate();
    const { slug } = useParams();
    const { budget } = useOutletContext();
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const scrollRef = useRef(null);
    const scrollParentRef = useRef(null);
    const didMountFiltersRef = useRef(false);

    const filters = useMemo(() => readFilters(searchParams), [searchParams]);
    const apiParams = useMemo(() => paramsForApi(filters), [filters]);
    const pageSize = isCompact ? PAGE_SIZE_COMPACT : PAGE_SIZE_FULL;
    const rowHeight = isCompact ? ROW_HEIGHT_COMPACT : ROW_HEIGHT_FULL;

    const users = useMemo(() => {
        const ids = new Set([budget.owner?.id, ...budget.members.map((member) => member.userId)]);
        const arr = Array.from(ids).map((id) => {
            const member = budget.members.find((item) => item.userId === id);
            const memberUser = member?.user || (budget.owner?.id === id ? budget.owner : null);
            return { id, name: memberUser?.displayName || memberUser?.username || id };
        });

        return arr.sort((a, b) => a.name.localeCompare(b.name));
    }, [budget]);

    const categories = useMemo(() => budget.categories || [], [budget.categories]);
    const visibleColumns = useMemo(
        () => ALL_COLUMN_DEFS.filter((column) => !isCompact || column.id !== 'status'),
        [isCompact]
    );
    const columnStorageKey = `purchases-columns:${slug || 'global'}:${isCompact ? 'compact' : 'full'}`;
    const columnKey = visibleColumns.map((column) => column.id).join('|');

    const [columnWidths, setColumnWidths] = useState(() => readStoredWidths(columnStorageKey, visibleColumns));

    useEffect(() => {
        setColumnWidths(readStoredWidths(columnStorageKey, visibleColumns));
    }, [columnKey, columnStorageKey, visibleColumns]);

    useEffect(() => {
        try {
            window.localStorage.setItem(columnStorageKey, JSON.stringify(columnWidths));
        } catch {
            // Ignore private-mode storage failures.
        }
    }, [columnStorageKey, columnWidths]);

    const gridTemplateColumns = useMemo(
        () => visibleColumns.map((column) => `${columnWidths[column.id] || column.width}px`).join(' '),
        [columnWidths, visibleColumns]
    );

    const tableMinWidth = useMemo(
        () => visibleColumns.reduce((sum, column) => sum + (columnWidths[column.id] || column.width), 0),
        [columnWidths, visibleColumns]
    );

    const resetColumnWidths = useCallback(() => {
        setColumnWidths(Object.fromEntries(visibleColumns.map((column) => [column.id, column.width])));
    }, [visibleColumns]);

    const startColumnResize = useCallback((event, column) => {
        event.preventDefault();
        event.stopPropagation();

        const startX = event.clientX;
        const startWidth = columnWidths[column.id] || column.width;
        const previousCursor = document.body.style.cursor;
        const previousUserSelect = document.body.style.userSelect;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        function onPointerMove(moveEvent) {
            const nextWidth = Math.max(
                column.min,
                Math.min(column.max, startWidth + moveEvent.clientX - startX)
            );

            setColumnWidths((current) => ({
                ...current,
                [column.id]: nextWidth,
            }));
        }

        function onPointerUp() {
            document.body.style.cursor = previousCursor;
            document.body.style.userSelect = previousUserSelect;
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        }

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    }, [columnWidths]);

    const categoryOptions = useMemo(() => [
        { value: '', label: 'All categories', searchText: 'all categories' },
        ...categories.map((category) => ({
            value: category.id,
            label: category.name,
            searchText: category.name,
            color: category.color ? (String(category.color).includes(',') ? `rgb(${category.color})` : category.color) : undefined,
            variant: category.color ? 'custom' : 'default',
        })),
    ], [categories]);

    const paidByOptions = useMemo(() => [
        { value: '', label: 'Anyone', searchText: 'anyone' },
        ...users.map((currentUser) => ({
            value: currentUser.id,
            label: currentUser.name,
            searchText: currentUser.name,
        })),
    ], [users]);

    const updateUrlParams = useCallback((patch) => {
        const next = new URLSearchParams(searchParams);

        Object.entries(patch).forEach(([key, value]) => {
            const normalized = cleanParam(value);
            const defaultValue = DEFAULT_FILTERS[key] ?? '';

            if (!normalized || normalized === defaultValue) {
                next.delete(key);
            } else {
                next.set(key, normalized);
            }
        });

        setSearchParams(next, { replace: true });
    }, [searchParams, setSearchParams]);

    const filterSignature = useMemo(() => JSON.stringify(apiParams), [apiParams]);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return;

        if (!didMountFiltersRef.current) {
            didMountFiltersRef.current = true;
            if (!usesPageScroll) node.scrollTo({ top: 0 });
            return;
        }

        if (usesPageScroll) {
            scrollNodeToTop(node, scrollParentRef.current || getScrollParent(node));
        } else {
            node.scrollTo({ top: 0 });
        }
    }, [filterSignature, usesPageScroll]);

    const purchasesQueryKey = queryKeys.budgets.purchases(slug, {
        ...apiParams,
        infinite: true,
        pageSize,
    });

    const {
        data,
        error,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
    } = useInfiniteQuery({
        queryKey: purchasesQueryKey,
        enabled: !!slug,
        initialPageParam: 1,
        queryFn: async ({ pageParam, signal }) => {
            const { data: response } = await api.get(`/budgets/${encodeURIComponent(slug)}/purchases`, {
                params: {
                    ...apiParams,
                    page: pageParam,
                    pageSize,
                },
                signal,
                withCredentials: true,
            });
            return response;
        },
        getNextPageParam: (lastPage, allPages) => {
            const loaded = allPages.reduce((sum, page) => sum + (page.items?.length || 0), 0);
            const total = Number(lastPage?.total || 0);
            return loaded < total ? allPages.length + 1 : undefined;
        },
    });

    const rows = useMemo(() => flattenPages(data), [data]);
    const total = totalFromPages(data);
    const loadedCount = rows.length;
    const err = error?.response?.data?.error || error?.message || '';

    const [scrollState, setScrollState] = useState({ top: 0, height: 640 });

    const measureScroll = useCallback(() => {
        const node = scrollRef.current;
        if (!node) return;
        const scrollParent = usesPageScroll
            ? scrollParentRef.current || getScrollParent(node)
            : node;

        if (usesPageScroll) {
            scrollParentRef.current = scrollParent;
        }

        const nextState = usesPageScroll
            ? {
                top: getScrollTopForNode(node, scrollParent),
                height: getScrollParentHeight(scrollParent),
            }
            : {
                top: node.scrollTop,
                height: node.clientHeight || 640,
            };

        setScrollState((current) => (
            current.top === nextState.top && current.height === nextState.height
                ? current
                : nextState
        ));
    }, [usesPageScroll]);

    useEffect(() => {
        const node = scrollRef.current;
        if (!node) return undefined;

        const scrollParent = usesPageScroll ? getScrollParent(node) : node;
        scrollParentRef.current = scrollParent;
        measureScroll();

        if (usesPageScroll) {
            scrollParent.addEventListener('scroll', measureScroll, { passive: true });
            window.addEventListener('resize', measureScroll);

            return () => {
                scrollParent.removeEventListener('scroll', measureScroll);
                window.removeEventListener('resize', measureScroll);
            };
        }

        node.addEventListener('scroll', measureScroll, { passive: true });
        window.addEventListener('resize', measureScroll);

        return () => {
            node.removeEventListener('scroll', measureScroll);
            window.removeEventListener('resize', measureScroll);
        };
    }, [measureScroll, usesPageScroll]);

    useEffect(() => {
        measureScroll();
    }, [measureScroll, rows.length, isFetchingNextPage]);

    const virtualCount = rows.length + (isFetchingNextPage ? 1 : 0);
    const bodyViewportHeight = Math.max(rowHeight, scrollState.height - HEADER_HEIGHT);
    const bodyScrollTop = Math.max(0, scrollState.top - HEADER_HEIGHT);
    const startIndex = virtualCount
        ? Math.max(0, Math.floor(bodyScrollTop / rowHeight) - OVERSCAN_ROWS)
        : 0;
    const endIndex = virtualCount
        ? Math.min(
            virtualCount - 1,
            Math.ceil((bodyScrollTop + bodyViewportHeight) / rowHeight) + OVERSCAN_ROWS
        )
        : -1;

    const visibleIndexes = useMemo(() => {
        if (endIndex < startIndex) return [];

        return Array.from(
            { length: endIndex - startIndex + 1 },
            (_, offset) => startIndex + offset
        );
    }, [endIndex, startIndex]);

    useEffect(() => {
        if (!hasNextPage || isFetchingNextPage || isLoading) return;
        if (endIndex >= rows.length - 8) fetchNextPage();
    }, [endIndex, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, rows.length]);

    const myUserId = user?.id;

    const userNameById = useMemo(() => {
        const names = new Map();
        users.forEach((currentUser) => names.set(currentUser.id, currentUser.name));
        return names;
    }, [users]);

    const nameOf = useCallback((id) => userNameById.get(id) || id || '-', [userNameById]);

    const onHeaderSort = useCallback((column) => {
        if (!column.sortable) return;

        const nextDir = filters.sortBy === column.sortable && filters.sortDir === 'asc' ? 'desc' : 'asc';
        updateUrlParams({ sortBy: column.sortable, sortDir: nextDir });
    }, [filters.sortBy, filters.sortDir, updateUrlParams]);

    const resetFilters = useCallback(() => {
        setSearchParams(new URLSearchParams(), { replace: true });
    }, [setSearchParams]);

    const setCurrentPurchaseItems = useCallback((updater) => {
        queryClient.setQueryData(purchasesQueryKey, (current) => {
            if (!current?.pages) return current;

            return {
                ...current,
                pages: current.pages.map((page) => ({
                    ...page,
                    items: updater(page.items || [], page),
                })),
            };
        });
    }, [purchasesQueryKey, queryClient]);

    const settleMutation = useMutation({
        mutationFn: ({ purchaseId, nextValue }) => toggleSettle(purchaseId, nextValue),
        onMutate: async ({ purchaseId, nextValue }) => {
            await queryClient.cancelQueries({ queryKey: purchasesQueryKey });
            const previous = queryClient.getQueryData(purchasesQueryKey);

            setCurrentPurchaseItems((items) => items.map((row) => (
                row.id === purchaseId ? applySettleLocal(row, nextValue) : row
            )));

            return { previous };
        },
        onError: (e, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(purchasesQueryKey, context.previous);
            }
            alert(e.response?.data?.error || e.message);
        },
        onSettled: () => {
            invalidateBudgetData(queryClient, slug);
        },
    });

    const deletePurchaseMutation = useMutation({
        mutationFn: async (id) => {
            await api.delete(`/budgets/purchases/${id}`, { withCredentials: true });
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: purchasesQueryKey });
            const previous = queryClient.getQueryData(purchasesQueryKey);

            queryClient.setQueryData(purchasesQueryKey, (current) => {
                if (!current?.pages) return current;

                return {
                    ...current,
                    pages: current.pages.map((page) => ({
                        ...page,
                        total: Math.max(0, Number(page.total || 0) - 1),
                        items: (page.items || []).filter((row) => row.id !== id),
                    })),
                };
            });

            return { previous };
        },
        onError: (e, _id, context) => {
            if (context?.previous) {
                queryClient.setQueryData(purchasesQueryKey, context.previous);
            }
            alert(e.response?.data?.error || e.message);
        },
        onSettled: () => {
            invalidateBudgetData(queryClient, slug);
        },
    });

    function deletePurchase(id) {
        const ok = window.confirm('Are you sure you want to delete this purchase?');
        if (!ok) return;

        deletePurchaseMutation.mutate(id);
    }

    const goToPurchase = (purchaseId) => {
        navigate(`/${slug}/purchases/${purchaseId}`, {
            state: { purchasesSearch: searchParams.toString() },
        });
    };

    const goToEditPurchase = (purchaseId) => {
        navigate(`/${slug}/purchases/${purchaseId}/edit`, {
            state: { purchasesSearch: searchParams.toString() },
        });
    };

    const isFiltered = Object.keys(DEFAULT_FILTERS).some((key) => filters[key] !== DEFAULT_FILTERS[key]);
    const totalHeight = Math.max(virtualCount * rowHeight, rows.length ? rowHeight : 0);

    return (
        <div className={`purchases-wrap ${isCompact ? 'compact' : ''}`}>
            {!isCompact && (
                <div className="purchases-toolbar">
                    <div className="purchases-toolbar-head">
                        <div>
                            <h2>Purchases</h2>
                            <p>
                                {isLoading && !rows.length
                                    ? 'Loading purchases...'
                                    : `Showing ${loadedCount} of ${total} purchase${total === 1 ? '' : 's'}`}
                            </p>
                        </div>

                        <div className="purchases-toolbar-actions">
                            <button className="purchases-action-button" type="button" onClick={resetColumnWidths}>
                                Reset columns
                            </button>
                            <button className="purchases-action-button purchases-action-button-primary" type="button" onClick={resetFilters} disabled={!isFiltered}>
                                Reset filters
                            </button>
                        </div>
                    </div>

                    <div className="purchases-wrap-filters">
                        <div className="purchases-wrap-filters-item">
                            <span>Category</span>
                            <Dropdown
                                value={filters.categoryId}
                                onValueChange={(categoryId) => updateUrlParams({ categoryId })}
                                options={categoryOptions}
                                placeholder="All categories"
                                variant="gray"
                                className="purchases-filter-dropdown"
                                searchable
                                searchPlaceholder="Search categories..."
                            />
                        </div>

                        <div className="purchases-wrap-filters-item">
                            <span>Shared?</span>
                            <div className="purchases-wrap-filters-item-shared-toggle">
                                {[
                                    { value: '', label: 'All' },
                                    { value: 'true', label: 'Shared' },
                                    { value: 'false', label: 'Personal' },
                                ].map((option) => {
                                    const active = filters.shared === option.value;

                                    return (
                                        <button
                                            key={option.label}
                                            type="button"
                                            className={`toggle-btn ${active ? 'active' : ''}`}
                                            aria-pressed={active}
                                            onClick={() => updateUrlParams({ shared: option.value })}
                                        >
                                            {active ? <CheckIcon /> : null}
                                            <span>{option.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="purchases-wrap-filters-item">
                            <span>Paid by</span>
                            <Dropdown
                                value={filters.paidById}
                                onValueChange={(paidById) => updateUrlParams({ paidById })}
                                options={paidByOptions}
                                placeholder="Anyone"
                                variant="gray"
                                className="purchases-filter-dropdown"
                                searchable={paidByOptions.length > 6}
                                searchPlaceholder="Search members..."
                            />
                        </div>

                        <label className="purchases-wrap-filters-item">
                            <span>From</span>
                            <input
                                className="purchases-wrap-filters-item-date"
                                type="date"
                                value={filters.dateFrom}
                                onChange={(event) => updateUrlParams({ dateFrom: event.target.value })}
                            />
                        </label>

                        <label className="purchases-wrap-filters-item">
                            <span>To</span>
                            <input
                                className="purchases-wrap-filters-item-date"
                                type="date"
                                value={filters.dateTo}
                                onChange={(event) => updateUrlParams({ dateTo: event.target.value })}
                            />
                        </label>

                        <div className="purchases-wrap-filters-item">
                            <span>Sort by</span>
                            <Dropdown
                                value={filters.sortBy}
                                onValueChange={(sortBy) => updateUrlParams({ sortBy })}
                                options={SORT_OPTIONS}
                                placeholder="Sort by"
                                variant="gray"
                                className="purchases-filter-dropdown"
                            />
                        </div>

                        <div className="purchases-wrap-filters-item">
                            <span>Direction</span>
                            <Dropdown
                                value={filters.sortDir}
                                onValueChange={(sortDir) => updateUrlParams({ sortDir })}
                                options={SORT_DIR_OPTIONS}
                                placeholder="Direction"
                                variant="gray"
                                className="purchases-filter-dropdown"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="purchases-wrap-table">
                <div
                    ref={scrollRef}
                    className="purchases-virtual-scroll"
                >
                    <div
                        className="purchases-virtual-table"
                        role="table"
                        aria-rowcount={total}
                        style={{ width: tableMinWidth, minWidth: '100%' }}
                    >
                        <div
                            className="purchases-virtual-header"
                            role="row"
                            style={{ gridTemplateColumns }}
                        >
                            {visibleColumns.map((column) => {
                                const active = filters.sortBy === column.sortable;

                                return (
                                    <div
                                        key={column.id}
                                        role="columnheader"
                                        aria-sort={column.sortable ? (active ? (filters.sortDir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
                                        className={[
                                            'purchases-virtual-header-cell',
                                            column.align === 'right' ? 'align-right' : '',
                                            column.sortable ? 'is-sortable' : '',
                                            active ? 'is-active' : '',
                                        ].filter(Boolean).join(' ')}
                                        onClick={() => onHeaderSort(column)}
                                    >
                                        <span>
                                            {column.label}
                                            {active && (
                                                <b
                                                    className="material-symbols-rounded purchases-sort-icon"
                                                    aria-hidden="true"
                                                >
                                                    {filters.sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                                                </b>
                                            )}
                                        </span>

                                        <button
                                            type="button"
                                            className="purchases-column-resizer"
                                            aria-label={`Resize ${column.label} column`}
                                            onClick={(event) => event.stopPropagation()}
                                            onPointerDown={(event) => startColumnResize(event, column)}
                                        />
                                    </div>
                                );
                            })}
                        </div>

                        {isLoading && !rows.length ? (
                            <div className="purchases-wrap-table-state">
                                <Loader />
                            </div>
                        ) : err ? (
                            <div className="purchases-wrap-table-state is-error">{err}</div>
                        ) : rows.length === 0 ? (
                            <div className="purchases-wrap-table-state">
                                {isFiltered ? 'No purchases match these filters.' : 'No purchases found.'}
                            </div>
                        ) : (
                            <div
                                className="purchases-virtual-body"
                                role="rowgroup"
                                style={{
                                    height: totalHeight,
                                    minHeight: rowHeight,
                                }}
                            >
                                {visibleIndexes.map((index) => {
                                    const row = rows[index];

                                    if (!row) {
                                        return (
                                            <div
                                                key={`loading-${index}`}
                                                className="purchases-virtual-row purchases-virtual-row-loading"
                                                style={{
                                                    gridTemplateColumns,
                                                    height: rowHeight,
                                                    transform: `translateY(${index * rowHeight}px)`,
                                                }}
                                            >
                                                <div className="purchases-cell purchases-cell-span">
                                                    Loading more purchases...
                                                </div>
                                            </div>
                                        );
                                    }

                                    const paidByIdRow = row.paidBy?.id;
                                    const debtor = (row.shares || []).find((share) => share.userId !== paidByIdRow && share.percent > 0);
                                    const isSettled = debtor?.isSettled ?? false;
                                    const hasDebtor = !!debtor;
                                    const net = myNetForPurchase(row, myUserId, nameOf);

                                    return (
                                        <div
                                            key={row.id}
                                            className="purchases-virtual-row"
                                            role="row"
                                            tabIndex={0}
                                            onClick={() => goToPurchase(row.id)}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter' || event.key === ' ') {
                                                    event.preventDefault();
                                                    goToPurchase(row.id);
                                                }
                                            }}
                                            style={{
                                                gridTemplateColumns,
                                                height: rowHeight,
                                                transform: `translateY(${index * rowHeight}px)`,
                                            }}
                                        >
                                            {visibleColumns.map((column) => {
                                                if (column.id === 'date') {
                                                    return (
                                                        <div key={column.id} className="purchases-cell date" role="cell">
                                                            <div className="purchase-date-cell">
                                                                <span>{fmtDate(row.paidAt)}</span>
                                                                {!isCompact && <small>{fmtTime(row.paidAt)}</small>}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                if (column.id === 'purchase') {
                                                    return (
                                                        <div key={column.id} className="purchases-cell purchase-main" role="cell">
                                                            <div className="purchase-main-title">{row.itemName}</div>
                                                            <div className="purchase-main-meta">
                                                                <span className="purchase-pill purchase-pill-category">
                                                                    {getCategoryName(row.category, row.categories)}
                                                                </span>
                                                                <span className={`purchase-pill ${row.shared ? 'is-shared' : 'is-personal'}`}>
                                                                    {row.shared ? 'Shared' : 'Personal'}
                                                                </span>
                                                                {row.notes && (
                                                                    <span className="purchase-pill has-note">Note</span>
                                                                )}
                                                            </div>
                                                            {row.notes && !isCompact && (
                                                                <div className="purchase-main-note">
                                                                    {getNotePreview(row.notes)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                if (column.id === 'paidBy') {
                                                    const paidByName = getPaidByName(row.paidBy);

                                                    return (
                                                        <div
                                                            key={column.id}
                                                            className="purchases-cell paidBy"
                                                            role="cell"
                                                            title={`Paid by ${paidByName}`}
                                                        >
                                                            <span className="purchase-user-avatar" aria-label={`Paid by ${paidByName}`}>
                                                                <Avatar
                                                                    user={row.paidBy}
                                                                    alt={paidByName}
                                                                    size="2.35em"
                                                                    n={3}
                                                                    version={avatarVersionOf(row.paidBy)}
                                                                    fallbackSrc="/images/avatar-placeholder.jpg"
                                                                />
                                                            </span>
                                                        </div>
                                                    );
                                                }

                                                if (column.id === 'amount') {
                                                    return (
                                                        <div key={column.id} className="purchases-cell amount align-right" role="cell">
                                                            {fmtCurrency(Number(row.amount))}
                                                        </div>
                                                    );
                                                }

                                                if (column.id === 'balance') {
                                                    return (
                                                        <div key={column.id} className="purchases-cell balance align-right" role="cell">
                                                            {!net ? (
                                                                <span className="purchase-balance-pill is-neutral">-</span>
                                                            ) : net.dir === 'I_OWE' ? (
                                                                <span
                                                                    className="purchase-balance-pill is-negative"
                                                                    title={net.lines?.map((line) => `${line.from} owes ${line.to}: ${fmtCurrency(line.amount)}`).join('\n')}
                                                                >
                                                                    You owe {fmtCurrency(net.amount)}
                                                                </span>
                                                            ) : net.dir === 'OWED_TO_ME' ? (
                                                                <span
                                                                    className="purchase-balance-pill is-positive"
                                                                    title={net.lines?.map((line) => `${line.from} owes ${line.to}: ${fmtCurrency(line.amount)}`).join('\n')}
                                                                >
                                                                    Owes you {fmtCurrency(net.amount)}
                                                                </span>
                                                            ) : (
                                                                <span className="purchase-balance-pill is-neutral">Settled</span>
                                                            )}
                                                        </div>
                                                    );
                                                }

                                                if (column.id === 'status') {
                                                    return (
                                                        <div key={column.id} className="purchases-cell status" role="cell">
                                                            <div className="purchase-status-group">
                                                                <span className={`purchase-pill ${row.shared ? 'is-shared' : 'is-personal'}`}>
                                                                    {row.shared ? 'Shared' : 'Personal'}
                                                                </span>
                                                                {row.shared && hasDebtor && (
                                                                    <span className={`purchase-pill ${isSettled ? 'is-settled' : 'is-open'}`}>
                                                                        {isSettled ? 'Settled' : 'Open'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div
                                                        key={column.id}
                                                        className="purchases-cell actions align-right"
                                                        role="cell"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        <div className="purchase-actions">
                                                            {row.shared && hasDebtor ? (
                                                                <label className="purchase-checkbox">
                                                                    <input
                                                                        className="check-purple"
                                                                        type="checkbox"
                                                                        checked={!!isSettled}
                                                                        disabled={settleMutation.isPending}
                                                                        onChange={(event) => {
                                                                            settleMutation.mutate({
                                                                                purchaseId: row.id,
                                                                                nextValue: event.target.checked,
                                                                            });
                                                                        }}
                                                                    />
                                                                </label>
                                                            ) : (
                                                                <span className="purchase-actions-spacer" />
                                                            )}

                                                            <button
                                                                type="button"
                                                                className="purchase-action-icon is-edit"
                                                                onClick={() => goToEditPurchase(row.id)}
                                                                title="Edit this purchase"
                                                                aria-label="Edit this purchase"
                                                            >
                                                                <span className="material-symbols-rounded" aria-hidden="true">
                                                                    edit
                                                                </span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                className="purchase-action-icon is-delete"
                                                                onClick={() => deletePurchase(row.id)}
                                                                title="Delete this purchase"
                                                                aria-label="Delete this purchase"
                                                            >
                                                                <span className="material-symbols-rounded" aria-hidden="true">
                                                                    delete
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!isLoading && !!rows.length && (
                            <div className="purchases-virtual-footer">
                                {hasNextPage || isFetchingNextPage
                                    ? 'Scroll to load more'
                                    : `All ${total} purchases loaded`}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
